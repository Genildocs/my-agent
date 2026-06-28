import { createSignal, onMount, For, Show } from "solid-js"
import { useKeyboard, useRenderer } from "@opentui/solid"
import { COLOR } from "../theme"

const BASE = "http://localhost:3001"

type Chat = { id: string; title: string; cwd?: string; updatedAt: string }

export function ChatListScreen(props: { onSelect: (id: string) => void }) {
  const [chats, setChats] = createSignal<Chat[]>([])
  const [idx, setIdx] = createSignal(0)
  const [loading, setLoading] = createSignal(true)
  const [error, setError] = createSignal("")
  const renderer = useRenderer()

  onMount(async () => {
    try {
      const data = await fetch(`${BASE}/api/chats`).then((r) => r.json())
      setChats(data)
    } catch (e) {
      setError("Servidor offline — inicie com: npm run web:server")
    } finally {
      setLoading(false)
    }
  })

  const total = () => chats().length + 1

  const createChat = async () => {
    try {
      const chat = await fetch(`${BASE}/api/chats`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }).then((r) => r.json())
      props.onSelect(chat.id)
    } catch {
      setError("Falha ao criar chat")
    }
  }

  useKeyboard((k) => {
    if (k.name === "up" || k.name === "k") setIdx((i) => Math.max(0, i - 1))
    if (k.name === "down" || k.name === "j") setIdx((i) => Math.min(total() - 1, i + 1))
    if (k.name === "return") {
      const i = idx()
      if (i === chats().length) void createChat()
      else props.onSelect(chats()[i].id)
    }
    if (k.name === "n") void createChat()
    if (k.name === "escape") renderer.destroy()
  })

  return (
    <box flexDirection="column" flexGrow={1} padding={2} gap={1}>
      <text fg={COLOR.user}>
        <b>my-agent TUI</b>
      </text>
      <text fg={COLOR.muted}>↑↓ / jk  navegar   Enter  abrir   N  novo   ESC  sair</text>

      <box flexDirection="column" marginTop={1} gap={0}>
        <Show when={loading()}>
          <text fg={COLOR.muted}>Carregando chats...</text>
        </Show>

        <Show when={error()}>
          <text fg={COLOR.system}>{error()}</text>
        </Show>

        <Show when={!loading()}>
          <For each={chats()}>
            {(chat, i) => (
              <box flexDirection="row" gap={1}>
                <text fg={i() === idx() ? COLOR.assistant : COLOR.text}>
                  <Show when={i() === idx()} fallback={`  ${chat.title || "Chat sem título"}`}>
                    <b>▸ {chat.title || "Chat sem título"}</b>
                  </Show>
                </text>
                <Show when={chat.cwd}>
                  <text fg={COLOR.dim}>{chat.cwd}</text>
                </Show>
              </box>
            )}
          </For>

          <text fg={idx() === chats().length ? COLOR.assistant : COLOR.muted}>
            <Show when={idx() === chats().length} fallback="  + Novo chat">
              <b>▸ + Novo chat</b>
            </Show>
          </text>
        </Show>
      </box>
    </box>
  )
}
