// Adaptado do simple-chatapp da Anthropic: mantém a MessageQueue (streaming input
// mode), mas pluga a NOSSA config — agente-revisor capaz com guardião ancorado nas
// docs (consultar_guardian) + guard hook vetando o perigoso.
import { query } from '@anthropic-ai/claude-agent-sdk';
import { consultorServer, CONSULTOR_TOOL } from '../../src/agents/consultor.ts';
import { guardedHooks } from '../../src/core/guard.ts';

const SYSTEM = `Você é um assistente de engenharia trabalhando NESTE projeto (mini-NotebookLM em TypeScript).
Capacidades: ler (Read, Glob, Grep), editar/criar arquivos (Edit, Write), rodar comandos (Bash) e
consultar o guardião (consultar_guardian) — que responde ancorado na documentação OFICIAL do Claude Agent SDK.
Regras:
- Para QUALQUER afirmação sobre a API do Agent SDK, consulte o guardião antes — não confie na memória.
- Você pode corrigir o código diretamente (Edit/Write) quando fizer sentido.
- Um guard bloqueia ações destrutivas (rm -rf, escrita fora do projeto, .env). Se algo for bloqueado, explique e siga outro caminho.
- Responda em português do Brasil, de forma objetiva.`;

type UserMessage = { type: 'user'; message: { role: 'user'; content: string } };

// Fila assíncrona: push() de fora, consumida via async iteration pelo query().
class MessageQueue {
  private messages: UserMessage[] = [];
  private waiting: ((msg: UserMessage) => void) | null = null;
  private closed = false;

  push(content: string) {
    const msg: UserMessage = { type: 'user', message: { role: 'user', content } };
    if (this.waiting) {
      this.waiting(msg);
      this.waiting = null;
    } else {
      this.messages.push(msg);
    }
  }

  async *[Symbol.asyncIterator](): AsyncIterableIterator<UserMessage> {
    while (!this.closed) {
      if (this.messages.length > 0) yield this.messages.shift()!;
      else yield await new Promise<UserMessage>((resolve) => (this.waiting = resolve));
    }
  }

  close() {
    this.closed = true;
  }
}

export class AgentSession {
  private queue = new MessageQueue();
  private outputIterator: AsyncIterator<any> | null = null;

  constructor() {
    this.outputIterator = query({
      prompt: this.queue as any,
      options: {
        model: 'claude-sonnet-4-6',
        maxTurns: 200,
        mcpServers: { consultor: consultorServer },
        allowedTools: ['Read', 'Glob', 'Grep', 'Edit', 'Write', 'Bash', CONSULTOR_TOOL],
        permissionMode: 'acceptEdits',
        systemPrompt: { type: 'preset', preset: 'claude_code', append: SYSTEM },
        hooks: guardedHooks,
      },
    })[Symbol.asyncIterator]();
  }

  sendMessage(content: string) {
    this.queue.push(content);
  }

  async *getOutputStream() {
    if (!this.outputIterator) throw new Error('Session not initialized');
    while (true) {
      const { value, done } = await this.outputIterator.next();
      if (done) break;
      yield value;
    }
  }

  close() {
    this.queue.close();
  }
}
