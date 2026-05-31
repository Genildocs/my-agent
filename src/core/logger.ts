// Logger com duas saídas em arquivo + eco no console:
//   logs/app.jsonl  -> estruturado, 1 evento JSON por linha (processar com jq/grep)
//   logs/app.log    -> legível, mesma linha com emoji que aparece no console
//
// Uso:
//   import { log } from './logger.ts';
//   log.info('guardian.query', { pergunta, turns, cost });
import { appendFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { EventEmitter } from 'node:events';

// Bus em memória: todo evento logado é publicado aqui também. Consumidores no
// mesmo processo (ex: o servidor web) assinam para repassar ao browser via WS.
export const logEvents = new EventEmitter();

const LOG_DIR = process.env.LOG_DIR ?? 'logs';
const LOG_FILE = join(LOG_DIR, 'app.jsonl');
const LOG_FILE_TXT = join(LOG_DIR, 'app.log');

type Level = 'info' | 'warn' | 'error';

// Emoji por evento (só no eco do console; o JSONL fica limpo p/ máquina).
const EVENT_EMOJI: Record<string, string> = {
  'guardian.prefetch': '📚',
  'guardian.ask': '💬',
  'guardian.search': '🔍',
  'guardian.result': '✅',
  'reviewer.start': '🔎',
  'reviewer.read': '📄',
  'reviewer.consult': '🤖',
  'reviewer.done': '📋',
  'tool.pre': '🔧',
  'tool.post': '🔩',
  'guard.deny': '⛔',
  'chat.start': '💬',
  'chat.turn': '🗣️',
};
function emojiFor(level: Level, event: string): string {
  if (EVENT_EMOJI[event]) return EVENT_EMOJI[event];
  if (level === 'error') return '❌';
  if (level === 'warn') return '⚠️';
  return 'ℹ️';
}

let ensured = false;
async function ensureDir() {
  if (ensured) return;
  await mkdir(LOG_DIR, { recursive: true });
  ensured = true;
}

async function write(level: Level, event: string, data?: Record<string, unknown>) {
  await ensureDir();
  const ts = new Date().toISOString();
  const record = { ts, level, event, ...data };

  // linha legível com emoji (usada no console E no app.log)
  const extra = data && Object.keys(data).length ? ' ' + JSON.stringify(data) : '';
  const hhmmss = ts.slice(11, 19);
  const pretty = `${emojiFor(level, event)} ${hhmmss} ${event}${extra}`;

  logEvents.emit('log', record); // publica no bus (consumido pelo servidor web)
  await Promise.all([
    appendFile(LOG_FILE, JSON.stringify(record) + '\n'), // estruturado (jq)
    appendFile(LOG_FILE_TXT, pretty + '\n'), // legível (emoji)
  ]);
  // stderr p/ não poluir o stdout do agente
  console.error(pretty);
}

export const log = {
  info: (event: string, data?: Record<string, unknown>) => write('info', event, data),
  warn: (event: string, data?: Record<string, unknown>) => write('warn', event, data),
  error: (event: string, data?: Record<string, unknown>) => write('error', event, data),
};

export { LOG_FILE, LOG_FILE_TXT, LOG_DIR };
