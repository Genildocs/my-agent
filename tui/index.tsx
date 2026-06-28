import { render } from "@opentui/solid"
import { createCliRenderer } from "@opentui/core"
import { App } from "./App"
import { ensureServer } from "./server-bootstrap"

// 1) Garante o backend de pé (sobe sozinho se preciso) ANTES de tomar o terminal.
let cleanup = () => {}
try {
  const r = await ensureServer()
  cleanup = r.cleanup
} catch (e) {
  // ainda não tomamos o terminal: erro vai pro stdout normal.
  console.error(`\n  ⚠ ${(e as Error).message}\n`)
  process.exit(1)
}

// 2) Renderer. Mata o servidor que NÓS subimos ao sair (o já-rodando fica).
const renderer = await createCliRenderer({
  exitOnCtrlC: true,
  targetFps: 60,
  // Desambígua Ctrl+M de Enter, Ctrl+I de Tab, etc. (Kitty suporta nativo; em
  // terminais sem o protocolo, faz fallback pro legado automaticamente).
  useKittyKeyboard: {},
})
renderer.once("destroy", cleanup)
process.on("exit", cleanup)

await render(() => <App />, renderer)
