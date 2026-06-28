// Modelos e efforts — espelham o webchat (web/client/components/chat/constants.ts)
// e o que o backend aceita no WSChatMessage.

export const MODELS = [
  { value: "claude-sonnet-4-6", label: "Sonnet 4.6", hint: "rápido · equilibrado" },
  { value: "claude-opus-4-8", label: "Opus 4.8", hint: "mais capaz" },
  { value: "claude-haiku-4-5-20251001", label: "Haiku 4.5", hint: "leve · barato" },
]

export const EFFORTS = [
  { value: "", label: "Padrão", hint: "default do SDK" },
  { value: "low", label: "Baixo" },
  { value: "medium", label: "Médio" },
  { value: "high", label: "Alto" },
  { value: "xhigh", label: "Máximo" },
]

export function modelLabel(id: string): string {
  return MODELS.find((m) => m.value === id)?.label ?? id
}

export function effortLabel(id: string): string {
  return EFFORTS.find((e) => e.value === id)?.label ?? id
}
