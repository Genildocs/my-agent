// Reviewer — agente revisor de código do Agent SDK. Lê um arquivo e valida o uso
// da API consultando o Guardian of Library (que é ancorado nas docs oficiais).
// Encadeamento: reviewer -> consultar_guardian -> guardião -> Neon.
//
// Uso: npx tsx --env-file=.env reviewer.ts <arquivo> ["foco da revisão"]
import { query } from '@anthropic-ai/claude-agent-sdk';
import { consultorServer, CONSULTOR_TOOL } from './consultor.ts';
import { log } from '../core/logger.ts';
import { trackingHooks } from '../core/hooks.ts';

const alvo = process.argv[2];
if (!alvo) {
  console.error('Uso: npx tsx --env-file=.env reviewer.ts <arquivo> ["foco da revisão"]');
  process.exit(1);
}
const foco = process.argv.slice(3).join(' ');

const SYSTEM = `Você é o Reviewer, um revisor de código que usa o Claude Agent SDK.
Capacidades:
1. Ler o código local (Read, Glob).
2. Consultar o guardião (consultar_guardian) para saber o que a documentação OFICIAL do Agent SDK manda.
Processo OBRIGATÓRIO:
- Leia o arquivo alvo.
- Para CADA uso de API do SDK que for revisar, consulte o guardião antes de emitir veredito — não confie na sua memória.
- Compare o código real (cite arquivo:linha) com a documentação e classifique cada ponto como ✅ correto ou ❌ divergente, com a correção.
Responda em português do Brasil, objetivo.`;

const tarefa = `Revise o arquivo "${alvo}" quanto ao uso correto da API do Claude Agent SDK${
  foco ? `, com foco em: ${foco}` : ''
}. Leia o arquivo e valide cada uso de API consultando o guardião.`;

await log.info('reviewer.start', { alvo, foco: foco || null });

for await (const message of query({
  prompt: tarefa,
  options: {
    model: 'claude-sonnet-4-6',
    maxTurns: 14,
    maxBudgetUsd: 1.0,
    mcpServers: { consultor: consultorServer },
    allowedTools: ['Read', 'Glob', CONSULTOR_TOOL],
    systemPrompt: { type: 'preset', preset: 'claude_code', append: SYSTEM },
    hooks: trackingHooks, // captura toda tool call no log
  },
})) {
  if (message.type === 'assistant' && message.message?.content) {
    for (const block of message.message.content) {
      if ('text' in block) console.log(block.text);
      else if ('name' in block) console.log(`\n[tool: ${block.name}]`);
    }
  } else if (message.type === 'result') {
    const turns = 'num_turns' in message ? message.num_turns : 0;
    const cost = 'total_cost_usd' in message ? message.total_cost_usd : 0;
    await log.info('reviewer.done', { subtype: message.subtype, turns, cost });
    console.log(`\nDone: ${message.subtype} | Custo total: $${cost} | Turns: ${turns}`);
  }
}
