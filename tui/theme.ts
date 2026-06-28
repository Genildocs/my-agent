import { createStore } from "solid-js/store"
import { createSignal } from "solid-js"
import { SyntaxStyle } from "@opentui/core"

export type Palette = {
  user: string
  assistant: string
  thinking: string
  tool: string
  tester: string
  system: string
  muted: string
  dim: string
  border: string
  text: string
  accent: string
  bg: string
}

// Temas: cada um é uma paleta completa. "dark" é o default.
export const THEMES: Record<string, Palette> = {
  dark: {
    user: "#7dd3fc",
    assistant: "#86efac",
    thinking: "#fde68a",
    tool: "#c4b5fd",
    tester: "#fb923c",
    system: "#f87171",
    muted: "#888888",
    dim: "#666666",
    border: "#555555",
    text: "#dddddd",
    accent: "#fbbf24",
    bg: "#0d0f14",
  },
  light: {
    user: "#0369a1",
    assistant: "#15803d",
    thinking: "#a16207",
    tool: "#6d28d9",
    tester: "#c2410c",
    system: "#b91c1c",
    muted: "#666666",
    dim: "#999999",
    border: "#cccccc",
    text: "#1a1a1a",
    accent: "#b45309",
    bg: "#fafafa",
  },
  nord: {
    user: "#88c0d0",
    assistant: "#a3be8c",
    thinking: "#ebcb8b",
    tool: "#b48ead",
    tester: "#d08770",
    system: "#bf616a",
    muted: "#7b88a1",
    dim: "#4c566a",
    border: "#434c5e",
    text: "#e5e9f0",
    accent: "#ebcb8b",
    bg: "#2e3440",
  },
  dracula: {
    user: "#8be9fd",
    assistant: "#50fa7b",
    thinking: "#f1fa8c",
    tool: "#bd93f9",
    tester: "#ffb86c",
    system: "#ff5555",
    muted: "#8a8fa3",
    dim: "#6272a4",
    border: "#44475a",
    text: "#f8f8f2",
    accent: "#ffb86c",
    bg: "#282a36",
  },
}

// COLOR é um store reativo: ler COLOR.x dentro de JSX re-renderiza ao trocar tema.
export const [COLOR, setColor] = createStore<Palette>({ ...THEMES.dark })

const [themeName, setThemeName] = createSignal("dark")
export { themeName }

export function setTheme(name: string) {
  const p = THEMES[name]
  if (!p) return
  setColor({ ...p })
  setThemeName(name)
}

// SyntaxStyle do markdown — lazy (precisa do renderer nativo). Fixo por enquanto;
// trocar tema muda o chrome, não o highlight de código.
let _syntax: SyntaxStyle | undefined
export function syntaxStyle(): SyntaxStyle {
  if (!_syntax) {
    _syntax = SyntaxStyle.fromStyles({
      default: { fg: "#ddd" },
      keyword: { fg: "#c792ea", bold: true },
      string: { fg: "#c3e88d" },
      number: { fg: "#f78c6c" },
      comment: { fg: "#666", italic: true },
      function: { fg: "#82aaff" },
      type: { fg: "#ffcb6b" },
      variable: { fg: "#eeffff" },
      operator: { fg: "#89ddff" },
      punctuation: { fg: "#888" },
    })
  }
  return _syntax
}
