import path from "node:path"
import { statSync } from "node:fs"
import { render } from "@opentui/solid"
import { createCliRenderer } from "@opentui/core"
import { App } from "./App"
import { ensureServer } from "./server-bootstrap"
import { setTheme } from "./theme"
import { getConfig } from "./config"

// Aplica o tema salvo antes do primeiro render (setTheme ignora nome inválido).
const savedTheme = getConfig().theme
if (savedTheme) setTheme(savedTheme)

// Diretório onde o AGENTE vai operar. Vem de argv[2] (o launcher global passa o
// $PWD de onde você chamou) ou do process.cwd(). O backend revalida e recusa
// caminho inexistente, mas checamos aqui pra dar erro claro antes de tomar a tela.
const targetCwd = path.resolve(process.argv[2] || process.cwd())
try {
  if (!statSync(targetCwd).isDirectory()) throw new Error("não é um diretório")
} catch {
  console.error(`\n  ⚠ Diretório inválido: ${targetCwd}\n`)
  process.exit(1)
}

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

await render(() => <App cwd={targetCwd} />, renderer)
