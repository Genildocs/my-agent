import { createSignal, Show } from "solid-js"
import { useTerminalDimensions } from "@opentui/solid"
import { ChatListScreen } from "./screens/ChatListScreen"
import { ChatScreen } from "./screens/ChatScreen"

export function App(props: { cwd: string }) {
  const dims = useTerminalDimensions()
  const [chatId, setChatId] = createSignal<string | null>(null)

  return (
    <box width={dims().width} height={dims().height} flexDirection="column">
      <Show
        when={chatId()}
        fallback={<ChatListScreen onSelect={setChatId} />}
      >
        {(id) => <ChatScreen chatId={id()} cwd={props.cwd} onBack={() => setChatId(null)} />}
      </Show>
    </box>
  )
}
