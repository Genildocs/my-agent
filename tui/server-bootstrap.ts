import { spawn, type ChildProcess } from "node:child_process"
import { fileURLToPath } from "node:url"
import path from "node:path"
import { openSync } from "node:fs"

const BASE = "http://localhost:3001"
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const LOG = "/tmp/my-agent-tui-server.log"

// Servidor que o TUI/web compartilham (mesmo WS). Quem foi spawnado por NÓS é
// rastreado aqui para ser morto no exit — o já-rodando (ex: do web) fica intocado.
let spawned: ChildProcess | null = null

async function isUp(timeoutMs = 800): Promise<boolean> {
  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), timeoutMs)
    const res = await fetch(`${BASE}/api/chats`, { signal: ctrl.signal })
    clearTimeout(t)
    return res.ok
  } catch {
    return false
  }
}

/**
 * Garante o backend de pé antes de abrir o TUI. Se já está rodando (web ou outra
 * instância), apenas conecta. Senão sobe `tsx --env-file=.env web/server/server.ts`
 * em background (log em /tmp), faz polling até responder, e devolve um cleanup que
 * só mata o processo que ESTE TUI iniciou.
 *
 * @returns cleanup() para chamar no exit, e `startedByUs` (informativo p/ a UI).
 */
export async function ensureServer(): Promise<{ cleanup: () => void; startedByUs: boolean }> {
  if (await isUp()) return { cleanup: () => {}, startedByUs: false }

  const out = openSync(LOG, "a")
  spawned = spawn(
    path.join(ROOT, "node_modules/.bin/tsx"),
    ["--env-file=.env", "web/server/server.ts"],
    { cwd: ROOT, stdio: ["ignore", out, out], detached: false },
  )

  // polling até o backend responder (até ~12s)
  const deadline = Date.now() + 12_000
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 300))
    if (await isUp(500)) {
      const child = spawned
      return {
        startedByUs: true,
        cleanup: () => {
          if (child && !child.killed) child.kill("SIGTERM")
        },
      }
    }
  }

  // não subiu a tempo: mata o que tentou subir e sinaliza falha
  spawned?.kill("SIGTERM")
  throw new Error(`Servidor não respondeu em 12s. Veja o log: ${LOG}`)
}
