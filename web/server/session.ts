import { randomUUID } from "node:crypto";
import type { WSClient, ChatMessage } from "./types.js";
import { AgentSession, type ImagePart, type AskQuestionItem } from "./ai-client.js";
import { runTester } from "../../src/agents/tester.ts";
import { chatStore } from "./chat-store.js";
import { saveImages } from "./uploads.js";

// Session manages a single chat conversation with a long-lived agent
export class Session {
  public readonly chatId: string;
  public readonly model: string;
  public readonly cwd: string;
  public readonly effort?: string;
  private subscribers: Set<WSClient> = new Set();
  private agentSession: AgentSession;
  private isListening = false;
  // histórico a injetar na 1ª mensagem (quando a sessão é (re)criada com conversa prévia)
  private pendingHistory?: ChatMessage[];
  // aprovações de tool pendentes (human-in-the-loop via canUseTool)
  private pendingApprovals = new Map<string, (ok: boolean) => void>();
  // perguntas de esclarecimento pendentes (AskUserQuestion via canUseTool)
  private pendingQuestions = new Map<string, (answers: Record<string, string>) => void>();

  constructor(chatId: string, model = "claude-sonnet-4-6", history?: ChatMessage[], cwd = process.cwd(), effort?: string) {
    this.chatId = chatId;
    this.model = model;
    this.cwd = cwd;
    this.effort = effort;
    this.agentSession = new AgentSession(
      model,
      (req) => this.requestApproval(req),
      (qs) => this.requestQuestion(qs),
      cwd,
      effort,
    );
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

  // Transmite as perguntas (AskUserQuestion) ao browser e espera as respostas.
  private requestQuestion(questions: AskQuestionItem[]): Promise<Record<string, string>> {
    return new Promise((resolve) => {
      const id = randomUUID();
      this.pendingQuestions.set(id, resolve);
      this.broadcast({ type: "question_request", id, questions, chatId: this.chatId });
    });
  }

  respondQuestion(id: string, answers: Record<string, string>) {
    const resolve = this.pendingQuestions.get(id);
    if (resolve) {
      resolve(answers);
      this.pendingQuestions.delete(id);
    }
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
    // Persiste as imagens coladas em disco (web/uploads) e guarda as URLs no SQLite.
    const imageUrls = saveImages(images);
    chatStore.addMessage(this.chatId, { role: "user", content, images: imageUrls });

    // Broadcast user message to subscribers (texto original, sem o contexto injetado)
    this.broadcast({
      type: "user_message",
      content,
      images: imageUrls,
      chatId: this.chatId,
    });

    // Na 1ª mensagem após (re)criar com histórico, prepend o contexto para o agente.
    let toAgent = content;
    if (this.pendingHistory) {
      const ctx = this.pendingHistory
        .filter((m) => m.role !== "thinking") // raciocínio não volta como contexto
        .map((m) => {
          const who = m.role === "user" ? "Usuário" : m.role === "tester" ? "Tester" : "Assistente";
          return `${who}: ${m.content}`;
        })
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

  // id do bloco em streaming + tipo do bloco aberto (texto ou raciocínio)
  private streamingId: string | null = null;
  private activeBlock: "text" | "thinking" | null = null;

  private handleSDKMessage(message: any) {
    // Eventos parciais (includePartialMessages): texto/raciocínio token a token.
    if (message.type === "stream_event") {
      const ev = message.event;
      if (ev?.type === "content_block_start") {
        const t = ev.content_block?.type;
        if (t === "text") {
          this.streamingId = randomUUID();
          this.activeBlock = "text";
          this.broadcast({ type: "assistant_start", id: this.streamingId, chatId: this.chatId });
        } else if (t === "thinking") {
          this.streamingId = randomUUID();
          this.activeBlock = "thinking";
          this.broadcast({ type: "thinking_start", id: this.streamingId, chatId: this.chatId });
        }
      } else if (ev?.type === "content_block_delta" && this.streamingId) {
        const d = ev.delta;
        if (d?.type === "text_delta") {
          this.broadcast({ type: "assistant_delta", id: this.streamingId, text: d.text, chatId: this.chatId });
        } else if (d?.type === "thinking_delta") {
          this.broadcast({ type: "thinking_delta", id: this.streamingId, text: d.thinking, chatId: this.chatId });
        }
      } else if (ev?.type === "content_block_stop" && this.streamingId) {
        const evt = this.activeBlock === "thinking" ? "thinking_end" : "assistant_end";
        this.broadcast({ type: evt, id: this.streamingId, chatId: this.chatId });
        this.streamingId = null;
        this.activeBlock = null;
      }
      return;
    }

    if (message.type === "assistant") {
      const content = message.message.content;

      if (typeof content === "string") {
        // sem streaming desse bloco (caminho raro): persiste e envia inteiro
        chatStore.addMessage(this.chatId, { role: "assistant", content });
        this.broadcast({ type: "assistant_message", content, chatId: this.chatId });
      } else if (Array.isArray(content)) {
        for (const block of content) {
          if (block.type === "thinking") {
            // raciocínio já foi transmitido via stream_event; aqui só PERSISTE
            // (antes do texto, preservando a ordem no histórico)
            if (block.thinking) chatStore.addMessage(this.chatId, { role: "thinking", content: block.thinking });
          } else if (block.type === "text") {
            // o texto já foi transmitido via stream_event; aqui só PERSISTE no SQLite
            chatStore.addMessage(this.chatId, { role: "assistant", content: block.text });
          } else if (block.type === "tool_use") {
            // AskUserQuestion é resolvida no canUseTool (vira question_request);
            // não emitir card de tool genérico para ela.
            if (block.name === "AskUserQuestion") continue;
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
    } else if (message.type === "system" && message.subtype === "compact_boundary") {
      // compactação concluída -> avisa a UI (toast)
      this.broadcast({ type: "notice", level: "success", text: "Contexto compactado", chatId: this.chatId });
    } else if (message.type === "result") {
      const u = message.usage || {};
      this.broadcast({
        type: "result",
        success: message.subtype === "success",
        chatId: this.chatId,
        cost: message.total_cost_usd,
        duration: message.duration_ms,
        inputTokens: (u.input_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0),
        outputTokens: u.output_tokens || 0,
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

  // Comandos que falam com o backend.
  // - compact: envia o slash-command nativo pela fila de input do agente principal.
  // - test: dispara o tester num query() PRÓPRIO (não passa pela conversa principal).
  runCommand(name: "compact" | "test", args?: string) {
    if (name === "compact") {
      this.agentSession.sendMessage("/compact");
      if (!this.isListening) this.startListening();
    } else if (name === "test") {
      void this.runTesterFlow(args);
    }
  }

  // Roda o tester (agente que só o usuário dispara) e transmite o progresso como
  // um card próprio no fluxo do chat. Bash liberado no runner (ver tester.ts).
  private async runTesterFlow(instruction?: string) {
    const id = randomUUID();
    this.broadcast({ type: "tester_start", id, chatId: this.chatId, instruction: instruction ?? "" });
    let report = "";
    try {
      for await (const msg of runTester(this.cwd, instruction)) {
        if (msg.type === "stream_event") {
          const ev = msg.event;
          if (ev?.type === "content_block_delta" && ev.delta?.type === "text_delta") {
            report += ev.delta.text;
            this.broadcast({ type: "tester_delta", id, text: ev.delta.text, chatId: this.chatId });
          }
        } else if (msg.type === "assistant" && Array.isArray(msg.message.content)) {
          for (const block of msg.message.content) {
            if (block.type === "tool_use" && block.name === "Bash") {
              const command = String((block.input as any)?.command ?? "");
              this.broadcast({ type: "tester_tool", id, command, chatId: this.chatId });
            }
          }
        }
      }
      if (report.trim()) chatStore.addMessage(this.chatId, { role: "tester", content: report });
      this.broadcast({ type: "tester_end", id, chatId: this.chatId, success: true });
    } catch (error) {
      const text = (error as Error).message;
      console.error(`Tester error in session ${this.chatId}:`, error);
      this.broadcast({ type: "tester_end", id, chatId: this.chatId, success: false, error: text });
      this.broadcastError(`Tester: ${text}`);
    }
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
