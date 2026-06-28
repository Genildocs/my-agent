import { createSignal, Show } from "solid-js"
import { useTerminalDimensions } from "@opentui/solid"
import { ChatListScreen } from "./screens/ChatListScreen"
import { ChatScreen } from "./screens/ChatScreen"
import { COLOR } from "./theme"

export function App(props: { cwd: string }) {
  const dims = useTerminalDimensions()
  const [chatId, setChatId] = createSignal<string | null>(null)

  return (
    <box
      width={dims().width}
      height={dims().height}
      flexDirection="column"
      backgroundColor={COLOR.bg}
    >
      <Show
        when={chatId()}
        fallback={<ChatListScreen onSelect={setChatId} />}
      >
        {(id) => <ChatScreen chatId={id()} cwd={props.cwd} onBack={() => setChatId(null)} />}
      </Show>
    </box>
  )
}
