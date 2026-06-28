// Gerenciamento server-side de credenciais de providers.
// Usa o mesmo arquivo de config do TUI (~/.config/my-agent/config.json),
// garantindo que TUI e web compartilhem as mesmas credenciais.
import {
  getConfig,
  getStoredApiKey,
  setProviderKey,
  removeProviderKey,
} from "../../tui/config.ts";

export interface ProviderDef {
  id: string;
  name: string;
  envKey: string;
  keyHint: string;
  docsUrl: string;
}

// Providers suportados (estrutura para expansão futura).
export const KNOWN_PROVIDERS: ProviderDef[] = [
  {
    id: "anthropic",
    name: "Anthropic (Claude)",
    envKey: "ANTHROPIC_API_KEY",
    keyHint: "sk-ant-...",
    docsUrl: "https://console.anthropic.com/settings/keys",
  },
];

export interface ProviderStatus {
  id: string;
  name: string;
  connected: boolean;
  source: "env" | "config" | "none";
  keyPreview: string | null;
  docsUrl: string;
  keyHint: string;
}

function maskKey(key: string): string {
  if (key.length <= 8) return "••••••••";
  return key.slice(0, 8) + "••••" + key.slice(-4);
}

// Resolve a API key efetiva para um provider: env var tem prioridade sobre config.
export function resolveApiKey(providerId: string): { key: string; source: "env" | "config" } | null {
  const def = KNOWN_PROVIDERS.find((p) => p.id === providerId);
  if (!def) return null;

  const envKey = process.env[def.envKey];
  if (envKey?.trim()) return { key: envKey.trim(), source: "env" };

  const configKey = getStoredApiKey(providerId);
  if (configKey?.trim()) return { key: configKey.trim(), source: "config" };

  return null;
}

// Lista todos os providers com seu status de conexão.
export function listProviders(): ProviderStatus[] {
  return KNOWN_PROVIDERS.map((def) => {
    const resolved = resolveApiKey(def.id);
    return {
      id: def.id,
      name: def.name,
      connected: resolved !== null,
      source: resolved?.source ?? "none",
      keyPreview: resolved ? maskKey(resolved.key) : null,
      docsUrl: def.docsUrl,
      keyHint: def.keyHint,
    };
  });
}

// Injeta no process.env as keys do config file para providers não configurados via env.
// Chamado uma vez no startup do servidor e novamente após salvar uma nova key.
export function syncProviderEnv(): void {
  for (const def of KNOWN_PROVIDERS) {
    if (!process.env[def.envKey]) {
      const configKey = getStoredApiKey(def.id);
      if (configKey?.trim()) {
        process.env[def.envKey] = configKey.trim();
      }
    }
  }
}

// Salva a API key no config e atualiza o process.env imediatamente.
export function saveProviderKey(providerId: string, apiKey: string): void {
  setProviderKey(providerId, apiKey);
  const def = KNOWN_PROVIDERS.find((p) => p.id === providerId);
  if (def) {
    // env var vazia ou ausente -> usa a do config; se já tinha env, não sobrescreve
    if (!process.env[def.envKey]) {
      process.env[def.envKey] = apiKey;
    }
  }
}

// Remove a API key do config. Se veio do env, não pode ser removida daqui.
export function deleteProviderKey(providerId: string): { ok: boolean; reason?: string } {
  const def = KNOWN_PROVIDERS.find((p) => p.id === providerId);
  if (!def) return { ok: false, reason: "Provider não encontrado." };

  if (process.env[def.envKey] && !getStoredApiKey(providerId)) {
    return { ok: false, reason: "A chave veio de uma variável de ambiente e não pode ser removida aqui." };
  }

  removeProviderKey(providerId);
  // Se a env var apontava para essa key (sincronizada antes), limpa também.
  if (process.env[def.envKey] && !process.env[def.envKey]?.startsWith("env-native")) {
    const configKey = getStoredApiKey(providerId); // já foi removida acima
    if (!configKey) {
      // A env foi populada pelo syncProviderEnv — remove para refletir o delete
      delete process.env[def.envKey];
    }
  }
  return { ok: true };
}
