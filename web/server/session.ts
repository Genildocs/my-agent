import { randomUUID } from "node:crypto";
import type { WSClient, ChatMessage } from "./types.js";
import { AgentSession, type ImagePart } from "./ai-client.js";
import { chatStore } from "./chat-store.js";

// Session manages a single chat conversation with a long-lived agent
export class Session {
  public readonly chatId: string;
  public readonly model: string;
  private subscribers: Set<WSClient> = new Set();
  private agentSession: AgentSession;
  private isListening = false;
  // histórico a injetar na 1ª mensagem (quando a sessão é (re)criada com conversa prévia)
  private pendingHistory?: ChatMessage[];
  // aprovações de tool pendentes (human-in-the-loop via canUseTool)
  private pendingApprovals = new Map<string, (ok: boolean) => void>();

  constructor(chatId: string, model = "claude-sonnet-4-6", history?: ChatMessage[]) {
    this.chatId = chatId;
    this.model = model;
    this.agentSession = new AgentSession(model, (req) => this.requestApproval(req));
    this.pendingHistory = history && history.length ? history : undefined;
  }

  // Pergunta ao usuário (browser) e espera a resposta antes de liberar a tool.
  private requestApproval(req: { tool: string; input: any }): Promise<boolean> {
    return new Promise((resolve) => {
      const id = randomUUID();
      this.pendingApprovals.set(id, resolve);
      this.broadcast({ type: "approval_request", id, tool: req.tool, input: req.input, chatId: this.chatId });
    });
  }

  respondApproval(id: string, approved: boolean) {
    const resolve = this.pendingApprovals.get(id);
    if (resolve) {
      resolve(approved);
      this.pendingApprovals.delete(id);
    }
  }

  // Start listening to agent output (call once)
  private async startListening() {
    if (this.isListening) return;
    this.isListening = true;

    try {
      for await (const message of this.agentSession.getOutputStream()) {
        this.handleSDKMessage(message);
      }
    } catch (error) {
      console.error(`Error in session ${this.chatId}:`, error);
      this.broadcastError((error as Error).message);
    }
  }

  // Send a user message to the agent
  sendMessage(content: string, images?: ImagePart[]) {
    // Store user message (texto; a imagem fica só na sessão atual)
    chatStore.addMessage(this.chatId, { role: "user", content });

    // Broadcast user message to subscribers (texto original, sem o contexto injetado)
    this.broadcast({
      type: "user_message",
      content,
      hasImages: !!images?.length,
      chatId: this.chatId,
    });

    // Na 1ª mensagem após (re)criar com histórico, prepend o contexto para o agente.
    let toAgent = content;
    if (this.pendingHistory) {
      const ctx = this.pendingHistory
        .map((m) => `${m.role === "user" ? "Usuário" : "Assistente"}: ${m.content}`)
        .join("\n");
      toAgent = `[Contexto da conversa até aqui:\n${ctx}\n]\n\n${content}`;
      this.pendingHistory = undefined;
    }

    // Send to agent (texto + imagens) — inicia a sessão se necessário
    this.agentSession.sendMessage(toAgent, images);

    if (!this.isListening) {
      this.startListening();
    }
  }

  private handleSDKMessage(message: any) {
    if (message.type === "assistant") {
      const content = message.message.content;

      if (typeof content === "string") {
        chatStore.addMessage(this.chatId, {
          role: "assistant",
          content,
        });
        this.broadcast({
          type: "assistant_message",
          content,
          chatId: this.chatId,
        });
      } else if (Array.isArray(content)) {
        for (const block of content) {
          if (block.type === "text") {
            chatStore.addMessage(this.chatId, {
              role: "assistant",
              content: block.text,
            });
            this.broadcast({
              type: "assistant_message",
              content: block.text,
              chatId: this.chatId,
            });
          } else if (block.type === "tool_use") {
            this.broadcast({
              type: "tool_use",
              toolName: block.name,
              toolId: block.id,
              toolInput: block.input,
              chatId: this.chatId,
            });
          }
        }
      }
    } else if (message.type === "result") {
      this.broadcast({
        type: "result",
        success: message.subtype === "success",
        chatId: this.chatId,
        cost: message.total_cost_usd,
        duration: message.duration_ms,
      });
    }
  }

  subscribe(client: WSClient) {
    this.subscribers.add(client);
    client.sessionId = this.chatId;
  }

  unsubscribe(client: WSClient) {
    this.subscribers.delete(client);
  }

  hasSubscribers(): boolean {
    return this.subscribers.size > 0;
  }

  private broadcast(message: any) {
    const messageStr = JSON.stringify(message);
    for (const client of this.subscribers) {
      try {
        if (client.readyState === client.OPEN) {
          client.send(messageStr);
        }
      } catch (error) {
        console.error("Error broadcasting to client:", error);
        this.subscribers.delete(client);
      }
    }
  }

  private broadcastError(error: string) {
    this.broadcast({
      type: "error",
      error,
      chatId: this.chatId,
    });
  }

  // Interrompe o turno atual (botão parar)
  async stop() {
    await this.agentSession.interrupt();
  }

  // Close the session
  close() {
    this.agentSession.close();
  }
}
