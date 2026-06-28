import { homedir } from "node:os"
import path from "node:path"
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"

// Preferências persistidas do TUI (tema/modelo/effort) e credenciais de providers,
// pra não voltar ao default a cada reabertura. Best-effort: qualquer falha de I/O
// é silenciada — config nunca deve derrubar a UI. Um único JSON em ~/.config/my-agent/.

export type ProviderConfig = {
  apiKey?: string
}

export type TuiConfig = {
  theme?: string
  model?: string
  effort?: string
  providers?: Record<string, ProviderConfig>
}

const dir = path.join(
  process.env.XDG_CONFIG_HOME || path.join(homedir(), ".config"),
  "my-agent",
)
const file = path.join(dir, "config.json")

let cache: TuiConfig | null = null

// Lê o config do disco uma vez (cacheado). Retorna {} se não existir/inválido.
export function getConfig(): TuiConfig {
  if (cache) return cache
  try {
    const parsed = JSON.parse(readFileSync(file, "utf8"))
    cache = parsed && typeof parsed === "object" ? (parsed as TuiConfig) : {}
  } catch {
    cache = {}
  }
  return cache
}

// Faz merge do patch no config e grava. Falha de escrita é ignorada.
export function updateConfig(patch: Partial<TuiConfig>): void {
  cache = { ...getConfig(), ...patch }
  try {
    mkdirSync(dir, { recursive: true })
    writeFileSync(file, JSON.stringify(cache, null, 2))
  } catch {
    // best-effort: não derruba a UI por causa de config
  }
}

// Retorna a API key armazenada para um provider (só lê do config file, sem env).
export function getStoredApiKey(providerId: string): string | undefined {
  return getConfig().providers?.[providerId]?.apiKey
}

// Salva a API key de um provider no config. Merge nos providers existentes.
export function setProviderKey(providerId: string, apiKey: string): void {
  const current = getConfig()
  updateConfig({
    providers: {
      ...(current.providers ?? {}),
      [providerId]: { ...(current.providers?.[providerId] ?? {}), apiKey },
    },
  })
}

// Remove a API key de um provider do config.
export function removeProviderKey(providerId: string): void {
  const current = getConfig()
  const providers = { ...(current.providers ?? {}) }
  delete providers[providerId]
  updateConfig({ providers })
}
