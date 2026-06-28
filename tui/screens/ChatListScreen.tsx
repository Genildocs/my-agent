import { createSignal, onMount, For, Show } from "solid-js"
import { useKeyboard, useRenderer } from "@opentui/solid"

const BASE = "http://localhost:3001"

type Chat = { id: string; title: string; cwd?: string; updatedAt: string }

export function ChatListScreen(props: { onSelect: (id: string) => void }) {
  const [chats, setChats] = createSignal<Chat[]>([])
  const [idx, setIdx] = createSignal(0)
  const [loading, setLoading] = createSignal(true)
  const renderer = useRenderer()

  onMount(async () => {
    try {
      const data = await fetch(`${BASE}/api/chats`).then((r) => r.json())
      setChats(data)
    } catch {
      // servidor offline — lista vazia
    } finally {
      setLoading(false)
    }
  })

  const total = () => chats().length + 1 // +1 para "Novo chat"

  const createChat = async () => {
    try {
      const chat = await fetch(`${BASE}/api/chats`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }).then((r) => r.json())
      props.onSelect(chat.id)
    } catch {
      // sem-op
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
    <box flexDirection="column" padding={2} gap={1}>
      <text fg="#7dd3fc" bold>
        my-agent TUI
      </text>
      <text fg="#444">↑↓ navegar · Enter abrir · N novo · ESC sair</text>

      <box flexDirection="column" marginTop={1}>
        <Show when={!loading()} fallback={<text fg="#555">Carregando...</text>}>
          <For each={chats()}>
            {(chat, i) => (
              <box flexDirection="row" gap={1}>
                <text fg={i() === idx() ? "#86efac" : "#888"} bold={i() === idx()}>
                  {i() === idx() ? "›" : " "} {chat.title || "Chat sem título"}
                </text>
                <Show when={chat.cwd}>
                  <text fg="#444">{chat.cwd}</text>
                </Show>
              </box>
            )}
          </For>
          <text
            fg={idx() === chats().length ? "#86efac" : "#555"}
            bold={idx() === chats().length}
          >
            {idx() === chats().length ? "›" : " "} + Novo chat
          </text>
        </Show>
      </box>
    </box>
  )
}
