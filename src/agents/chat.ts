// Chat interativo com o agente-revisor capaz.
// Streaming input mode: um único query() roda o tempo todo consumindo uma fila
// de mensagens (mantém o contexto da conversa). O agente lê código, consulta o
// guardião (docs ancoradas) e CORRIGE — com guard hook vetando o perigoso.
//
// Uso: npm run chat
import { query } from '@anthropic-ai/claude-agent-sdk';
import * as readline from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { consultorServer, CONSULTOR_TOOL } from './consultor.ts';
import { guardedHooks } from '../core/guard.ts';
import { log } from '../core/logger.ts';

// Fila assíncrona: push() de fora, consumida via async iteration pelo query().
// (mesmo padrão do demo simple-chatapp da Anthropic)
class MessageQueue {
  private messages: { type: 'user'; message: { role: 'user'; content: string } }[] = [];
  private waiting: ((m: MessageQueue['messages'][number]) => void) | null = null;
  private closed = false;

  push(content: string) {
    const msg = { type: 'user' as const, message: { role: 'user' as const, content } };
    if (this.waiting) {
      this.waiting(msg);
      this.waiting = null;
    } else {
      this.messages.push(msg);
    }
  }

  async *[Symbol.asyncIterator]() {
    while (!this.closed) {
      if (this.messages.length > 0) yield this.messages.shift()!;
      else yield await new Promise<MessageQueue['messages'][number]>((resolve) => (this.waiting = resolve));
    }
  }

  close() {
    this.closed = true;
  }
}

const SYSTEM = `Você é um assistente de engenharia trabalhando NESTE projeto (mini-NotebookLM em TypeScript).
Capacidades: ler (Read, Glob, Grep), editar/criar arquivos (Edit, Write), rodar comandos (Bash) e
consultar o guardião (consultar_guardian) — que responde ancorado na documentação OFICIAL do Claude Agent SDK.
Regras:
- Para QUALQUER afirmação sobre a API do Agent SDK, consulte o guardião antes — não confie na memória.
- Você pode corrigir o código diretamente (Edit/Write) quando fizer sentido.
- Um guard bloqueia ações destrutivas (rm -rf, escrita fora do projeto, .env). Se algo for bloqueado, explique e siga outro caminho.
- Responda em português do Brasil, de forma objetiva.`;

const queue = new MessageQueue();
const rl = readline.createInterface({ input: stdin, output: stdout });

await log.info('chat.start', {});
console.log('Chat com o agente-revisor (lê código, consulta docs, corrige). Digite /sair para encerrar.\n');

const q = query({
  // o SDK aceita o formato simplificado de mensagem em runtime (daí o cast)
  prompt: queue as unknown as AsyncIterable<never>,
  options: {
    model: 'claude-sonnet-4-6',
    maxTurns: 200,
    mcpServers: { consultor: consultorServer },
    allowedTools: ['Read', 'Glob', 'Grep', 'Edit', 'Write', 'Bash', CONSULTOR_TOOL],
    permissionMode: 'acceptEdits',
    systemPrompt: { type: 'preset', preset: 'claude_code', append: SYSTEM },
    hooks: guardedHooks,
  },
});

const EXIT = new Set(['/sair', 'sair', 'exit', 'quit', '/q']);

const first = (await rl.question('Você: ')).trim();
if (!first || EXIT.has(first)) {
  queue.close();
  rl.close();
  process.exit(0);
}
queue.push(first);

for await (const message of q) {
  if (message.type === 'assistant' && message.message?.content) {
    for (const block of message.message.content) {
      if ('text' in block) stdout.write(block.text);
      else if ('name' in block) stdout.write(`\n[tool: ${block.name}]\n`);
    }
  } else if (message.type === 'result') {
    if ('total_cost_usd' in message) {
      await log.info('chat.turn', { turns: message.num_turns, cost: message.total_cost_usd });
    }
    const next = (await rl.question('\n\nVocê: ')).trim();
    if (!next || EXIT.has(next)) {
      queue.close();
      break;
    }
    queue.push(next);
  }
}

rl.close();
console.log('\nAté mais!');
