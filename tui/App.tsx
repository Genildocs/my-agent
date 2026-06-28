import { createSignal, Show } from "solid-js"
import { ChatListScreen } from "./screens/ChatListScreen"
import { ChatScreen } from "./screens/ChatScreen"

export function App() {
  const [chatId, setChatId] = createSignal<string | null>(null)

  return (
    <Show
      when={chatId()}
      fallback={<ChatListScreen onSelect={setChatId} />}
    >
      {(id) => <ChatScreen chatId={id()} onBack={() => setChatId(null)} />}
    </Show>
  )
}
