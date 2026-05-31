// Demo de ENCADEAMENTO de agentes (tarefa fixa): inspeciona a config de tools do
// guardian.ts e valida contra as docs consultando o guardião.
// Para revisar um arquivo qualquer, use reviewer.ts (versão genérica).
//
// Uso: npx tsx --env-file=.env orquestrator.ts ["tarefa opcional"]
import { query } from '@anthropic-ai/claude-agent-sdk';
import { consultorServer, CONSULTOR_TOOL } from './consultor.ts';
import { log } from '../core/logger.ts';
import { trackingHooks } from '../core/hooks.ts';

const TAREFA_PADRAO = `Inspecione como as tools do Agent SDK estão configuradas no arquivo guardian.ts
(leia o arquivo). Depois, consultando o guardião, confirme se a configuração está correta segundo a
documentação oficial — em especial: a assinatura de tool(), o uso de createSdkMcpServer e o formato dos
nomes em allowedTools. Aponte divergências, se houver, ou confirme que está correto.`;

const tarefa = process.argv.slice(2).join(' ') || TAREFA_PADRAO;

const SYSTEM = `Você é um agente revisor de configuração. Você tem duas capacidades:
1. Ler o código local do projeto (Read, Glob).
2. Consultar o guardião (consultar_guardian) para saber o que a documentação oficial do Agent SDK manda.
Para cada ponto, consulte o guardião antes do veredito — não confie na memória. Responda em português do Brasil.`;

await log.info('reviewer.start', { alvo: 'guardian.ts', foco: 'config de tools (demo)' });

for await (const message of query({
  prompt: tarefa,
  options: {
    model: 'claude-sonnet-4-6',
    maxTurns: 12,
    maxBudgetUsd: 0.8,
    mcpServers: { consultor: consultorServer },
    allowedTools: ['Read', 'Glob', CONSULTOR_TOOL],
    systemPrompt: { type: 'preset', preset: 'claude_code', append: SYSTEM },
    hooks: trackingHooks, // captura toda tool call (Read, Glob, consultar_guardian) no log
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
