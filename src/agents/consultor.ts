// Server MCP in-process que expõe o guardião como uma tool consultável por
// outros agentes (agent.ts, reviewer.ts). É o ponto de ENCADEAMENTO: o handler
// chama askGuardian(), que roda o loop do guardião contra o Neon.
import { tool, createSdkMcpServer } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { askGuardian } from './guardian.ts';
import { log } from '../core/logger.ts';

const consultarGuardian = tool(
  'consultar_guardian',
  'Pergunta ao Guardian of Library (agente ancorado nas docs do Claude Agent SDK). Use para confirmar como algo DEVE ser segundo a documentação oficial.',
  {
    pergunta: z.string().describe('A pergunta sobre o Agent SDK a ser respondida pela documentação'),
  },
  async (args) => {
    const { answer, cost, turns } = await askGuardian(args.pergunta);
    await log.info('reviewer.consult', { pergunta: args.pergunta, turns, cost });
    return { content: [{ type: 'text', text: answer }] };
  },
  { annotations: { readOnlyHint: true } }, // consulta read-only -> permite consultas em paralelo
);

export const consultorServer = createSdkMcpServer({
  name: 'consultor',
  version: '1.0.0',
  tools: [consultarGuardian],
});

export const CONSULTOR_TOOL = 'mcp__consultor__consultar_guardian';
