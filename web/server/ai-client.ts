// TRANSPORTE de sessão (streaming-input mode), herdado do simple-chatapp da Anthropic:
// a MessageQueue (fila async consumida pelo query()) + a AgentSession que mantém o
// turno vivo. A DEFINIÇÃO do agente (system prompt, tools, subagentes, política de
// aprovação) vive em src/agents/main-agent.ts e é injetada via buildMainAgentOptions.
import { query } from '@anthropic-ai/claude-agent-sdk';
import { buildMainAgentOptions, type ApprovalFn, type QuestionFn, type AskQuestionItem } from '../../src/agents/main-agent.ts';

export type { ApprovalFn, QuestionFn, AskQuestionItem }; // re-export p/ quem importa daqui

export interface ImagePart {
  media_type: string;
  data: string; // base64 puro (sem o prefixo data:...;base64,)
}
type UserMessage = { type: 'user'; message: { role: 'user'; content: any } };

// Fila assíncrona: push() de fora, consumida via async iteration pelo query().
class MessageQueue {
  private messages: UserMessage[] = [];
  private waiting: ((msg: UserMessage) => void) | null = null;
  private closed = false;

  push(content: string, images?: ImagePart[]) {
    // multimodal: se houver imagens, content vira um array texto + blocos image.
    const body =
      images && images.length
        ? [
            { type: 'text', text: content },
            ...images.map((img) => ({
              type: 'image',
              source: { type: 'base64', media_type: img.media_type, data: img.data },
            })),
          ]
        : content;
    const msg: UserMessage = { type: 'user', message: { role: 'user', content: body } };
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
  private q: ReturnType<typeof query>;
  private outputIterator: AsyncIterator<any>;

  constructor(model = 'claude-sonnet-4-6', onApproval?: ApprovalFn, onQuestion?: QuestionFn, cwd = process.cwd(), effort?: string) {
    // a config do agente vem do domínio; aqui só plugamos a fila (transporte).
    this.q = query({
      prompt: this.queue as any,
      options: buildMainAgentOptions({ model, cwd, effort, onApproval, onQuestion }),
    });
    this.outputIterator = this.q[Symbol.asyncIterator]();
  }

  sendMessage(content: string, images?: ImagePart[]) {
    this.queue.push(content, images);
  }

  // Interrompe o turno atual sem encerrar a sessão (streaming input mode).
  async interrupt() {
    try {
      await this.q.interrupt();
    } catch {
      /* já parado / entre turnos: ignora */
    }
  }

  async *getOutputStream() {
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
