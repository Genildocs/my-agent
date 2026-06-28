import { createStore, produce } from "solid-js/store"
import { onCleanup } from "solid-js"

const WS_URL = "ws://localhost:3001/ws"

export type UIMessage = {
  id: string
  role: "user" | "assistant" | "thinking" | "tool" | "tester" | "system"
  content: string
  streaming: boolean
}

export type PendingApproval = { id: string; tool: string; input: any }
export type PendingQuestion = {
  id: string
  questions: Array<{
    question: string
    header: string
    options?: Array<{ label: string; description?: string }>
  }>
}

type WsStore = {
  messages: UIMessage[]
  status: "idle" | "streaming" | "thinking"
  lastResult: { cost?: number; inputTokens?: number; outputTokens?: number } | null
  pendingApproval: PendingApproval | null
  pendingQuestion: PendingQuestion | null
  connected: boolean
}

export function createWsClient(chatId: string) {
  const [store, setStore] = createStore<WsStore>({
    messages: [],
    status: "idle",
    lastResult: null,
    pendingApproval: null,
    pendingQuestion: null,
    connected: false,
  })

  let ws: WebSocket

  const send = (msg: any) => {
    if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg))
  }

  const handleMsg = (msg: any) => {
    switch (msg.type) {
      case "connected":
        setStore("connected", true)
        break

      case "history":
        setStore("messages", (msg.messages ?? []).map((m: any) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          streaming: false,
        })))
        break

      case "assistant_start":
        setStore(produce((s) => {
          s.status = "streaming"
          s.messages.push({ id: msg.id, role: "assistant", content: "", streaming: true })
        }))
        break

      case "assistant_delta":
        setStore(produce((s) => {
          const m = s.messages.find((m) => m.id === msg.id)
          if (m) m.content += msg.text
        }))
        break

      case "assistant_end":
        setStore(produce((s) => {
          const m = s.messages.find((m) => m.id === msg.id)
          if (m) m.streaming = false
          s.status = "idle"
        }))
        break

      case "assistant_message":
        setStore("messages", (msgs) => [
          ...msgs,
          { id: String(Date.now()), role: "assistant", content: msg.content, streaming: false },
        ])
        break

      case "thinking_start":
        setStore(produce((s) => {
          s.status = "thinking"
          s.messages.push({ id: msg.id, role: "thinking", content: "", streaming: true })
        }))
        break

      case "thinking_delta":
        setStore(produce((s) => {
          const m = s.messages.find((m) => m.id === msg.id)
          if (m) m.content += msg.text
        }))
        break

      case "thinking_end":
        setStore(produce((s) => {
          const m = s.messages.find((m) => m.id === msg.id)
          if (m) m.streaming = false
          s.status = "streaming"
        }))
        break

      case "tool_use":
        setStore("messages", (msgs) => [
          ...msgs,
          {
            id: msg.toolId,
            role: "tool",
            content: `${msg.toolName}(${JSON.stringify(msg.toolInput ?? {}).slice(0, 100)})`,
            streaming: false,
          },
        ])
        break

      case "approval_request":
        setStore("pendingApproval", { id: msg.id, tool: msg.tool, input: msg.input })
        break

      case "question_request":
        setStore("pendingQuestion", { id: msg.id, questions: msg.questions })
        break

      case "result":
        setStore(produce((s) => {
          s.status = "idle"
          s.lastResult = {
            cost: msg.cost,
            inputTokens: msg.inputTokens,
            outputTokens: msg.outputTokens,
          }
        }))
        break

      case "error":
        setStore(produce((s) => {
          s.status = "idle"
          s.messages.push({
            id: String(Date.now()),
            role: "system",
            content: `⚠ ${msg.error}`,
            streaming: false,
          })
        }))
        break

      case "notice":
        setStore("messages", (msgs) => [
          ...msgs,
          { id: String(Date.now()), role: "system", content: `[${msg.level}] ${msg.text}`, streaming: false },
        ])
        break

      case "tester_start":
        setStore("messages", (msgs) => [
          ...msgs,
          { id: msg.id, role: "tester", content: "", streaming: true },
        ])
        break

      case "tester_delta":
        setStore(produce((s) => {
          const m = s.messages.find((m) => m.id === msg.id)
          if (m) m.content += msg.text
        }))
        break

      case "tester_end":
        setStore(produce((s) => {
          const m = s.messages.find((m) => m.id === msg.id)
          if (m) m.streaming = false
        }))
        break
    }
  }

  ws = new WebSocket(WS_URL)
  ws.onopen = () => ws.send(JSON.stringify({ type: "subscribe", chatId }))
  ws.onmessage = (e: MessageEvent) => handleMsg(JSON.parse(e.data as string))
  ws.onerror = () =>
    setStore("messages", (msgs) => [
      ...msgs,
      {
        id: "err-ws",
        role: "system",
        content: "⚠ Não foi possível conectar. Servidor rodando? (localhost:3001)",
        streaming: false,
      },
    ])

  onCleanup(() => ws.close())

  const sendMessage = (content: string, cwd?: string) => {
    setStore("messages", (msgs) => [
      ...msgs,
      { id: String(Date.now()), role: "user", content, streaming: false },
    ])
    send({ type: "chat", chatId, content, cwd })
  }

  const stopAgent = () => send({ type: "stop", chatId })

  const respondApproval = (id: string, approved: boolean) => {
    send({ type: "approval", chatId, id, approved })
    setStore("pendingApproval", null)
  }

  const respondQuestion = (id: string, answers: Record<string, string>) => {
    send({ type: "question_answer", chatId, id, answers })
    setStore("pendingQuestion", null)
  }

  return { store, sendMessage, stopAgent, respondApproval, respondQuestion }
}
