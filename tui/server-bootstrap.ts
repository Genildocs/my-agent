import { spawn, type ChildProcess } from "node:child_process"
import { fileURLToPath } from "node:url"
import path from "node:path"
import os from "node:os"
import { openSync } from "node:fs"

const BASE = "http://localhost:3001"
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
// tmpdir do SO (Linux/macOS: /tmp; Windows: %TEMP%)
const LOG = path.join(os.tmpdir(), "my-agent-tui-server.log")

const IS_WIN = process.platform === "win32"
// No Windows o binário do tsx é tsx.cmd (shell script); no Unix é o tsx sem extensão.
const TSX_BIN = path.join(ROOT, "node_modules", ".bin", IS_WIN ? "tsx.cmd" : "tsx")

// Servidor que o TUI/web compartilham (mesmo WS). Quem foi spawnado por NÓS é
// rastreado aqui para ser morto no exit — o já-rodando (ex: do web) fica intocado.
let spawned: ChildProcess | null = null

// Mata o processo que iniciamos. No Windows, como subimos via shell (cmd → tsx →
// node), precisamos matar a ÁRVORE (taskkill /T) pra não orfanizar o server.
function killSpawned(child: ChildProcess) {
  if (!child || child.killed || child.pid == null) return
  if (IS_WIN) {
    try {
      spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" })
    } catch {
      child.kill()
    }
  } else {
    child.kill("SIGTERM")
  }
}

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
 * em background (log no tmpdir do SO), faz polling até responder, e devolve um
 * cleanup que só mata o processo que ESTE TUI iniciou. Cross-platform (Win/Unix).
 *
 * @returns cleanup() para chamar no exit, e `startedByUs` (informativo p/ a UI).
 */
export async function ensureServer(): Promise<{ cleanup: () => void; startedByUs: boolean }> {
  if (await isUp()) return { cleanup: () => {}, startedByUs: false }

  const out = openSync(LOG, "a")
  spawned = spawn(TSX_BIN, ["--env-file=.env", "web/server/server.ts"], {
    cwd: ROOT,
    stdio: ["ignore", out, out],
    detached: false,
    // tsx.cmd é um batch no Windows — precisa de shell pra ser executado.
    shell: IS_WIN,
  })

  // polling até o backend responder (até ~12s)
  const deadline = Date.now() + 12_000
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 300))
    if (await isUp(500)) {
      const child = spawned
      return {
        startedByUs: true,
        cleanup: () => {
          if (child) killSpawned(child)
        },
      }
    }
  }

  // não subiu a tempo: mata o que tentou subir e sinaliza falha
  if (spawned) killSpawned(spawned)
  throw new Error(`Servidor não respondeu em 12s. Veja o log: ${LOG}`)
}
