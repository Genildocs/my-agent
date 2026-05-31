// Hooks de tracking — capturam TODA tool call (sem matcher) e logam via logger.
// Pluga em options.hooks de qualquer agente para observabilidade automática,
// sem precisar instrumentar cada tool na mão. (API confirmada em hooks.md das docs.)
import type { HookCallback, PreToolUseHookInput, PostToolUseHookInput } from '@anthropic-ai/claude-agent-sdk';
import { log } from './logger.ts';

// Resume o input/output de uma tool para um preview curto (não inflar o log).
function preview(value: unknown, max = 160): string {
  const s = typeof value === 'string' ? value : JSON.stringify(value);
  return s && s.length > max ? s.slice(0, max) + '…' : (s ?? '');
}

export const onPreToolUse: HookCallback = async (input, toolUseID) => {
  const pre = input as PreToolUseHookInput;
  await log.info('tool.pre', { tool: pre.tool_name, id: toolUseID, input: preview(pre.tool_input) });
  return {}; // objeto vazio = não interfere, deixa a tool rodar
};

export const onPostToolUse: HookCallback = async (input, toolUseID) => {
  const post = input as PostToolUseHookInput;
  const resp = post.tool_response as unknown;
  const error = resp && typeof resp === 'object' && 'error' in resp ? (resp as { error: unknown }).error : undefined;
  await log.info('tool.post', { tool: post.tool_name, id: toolUseID, ok: !error, ...(error ? { error: preview(error) } : {}) });
  return {};
};

// Pronto para usar: options: { hooks: trackingHooks }
export const trackingHooks = {
  PreToolUse: [{ hooks: [onPreToolUse] }],
  PostToolUse: [{ hooks: [onPostToolUse] }],
};
