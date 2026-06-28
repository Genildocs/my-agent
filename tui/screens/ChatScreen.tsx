import { createSignal, createEffect, For, Show, Switch, Match } from "solid-js"
import { useKeyboard, useRenderer, useTerminalDimensions } from "@opentui/solid"
import type { ScrollBoxRenderable } from "@opentui/core"
import { createWsClient } from "../createWsClient"
import type { UIMessage } from "../createWsClient"

// ── Cores por papel ──────────────────────────────────────────────────────────
const ROLE_COLOR: Record<string, string> = {
  user: "#7dd3fc",
  assistant: "#86efac",
  thinking: "#fde68a",
  tool: "#c4b5fd",
  tester: "#fb923c",
  system: "#f87171",
}

const ROLE_LABEL: Record<string, string> = {
  user: "You",
  assistant: "Agent",
  thinking: "Thinking",
  tool: "Tool",
  tester: "Tester",
  system: "System",
}

// ── MessageItem ──────────────────────────────────────────────────────────────
function MessageItem(props: { msg: UIMessage }) {
  const color = () => ROLE_COLOR[props.msg.role] ?? "#aaa"
  const label = () => ROLE_LABEL[props.msg.role] ?? props.msg.role

  return (
    <box flexDirection="column" marginBottom={1} paddingLeft={1}>
      <text fg={color()} bold>
        {label()}
        {props.msg.streaming ? " ●" : ""}
      </text>
      <Switch>
        {/* Texto rico em markdown só para assistant/tester quando não está em streaming */}
        <Match when={props.msg.role === "assistant"}>
          <box paddingLeft={2}>
            <markdown streaming={props.msg.streaming} content={props.msg.content || " "} />
          </box>
        </Match>
        <Match when={true}>
          <text paddingLeft={2} whiteSpace="pre-wrap" fg={color()}>
            {props.msg.content || (props.msg.streaming ? "…" : "")}
          </text>
        </Match>
      </Switch>
    </box>
  )
}

// ── ApprovalCard ─────────────────────────────────────────────────────────────
function ApprovalCard(props: {
  approval: { id: string; tool: string; input: any }
  onRespond: (id: string, approved: boolean) => void
}) {
  useKeyboard((k) => {
    if (k.name === "y") props.onRespond(props.approval.id, true)
    if (k.name === "n") props.onRespond(props.approval.id, false)
  })

  const inputPreview = () => {
    try {
      const s = JSON.stringify(props.approval.input)
      return s.length > 120 ? s.slice(0, 117) + "..." : s
    } catch {
      return String(props.approval.input)
    }
  }

  return (
    <box
      flexDirection="column"
      borderStyle="single"
      borderColor="#f59e0b"
      padding={1}
      marginX={1}
      gap={0}
    >
      <text fg="#f59e0b" bold>
        ⚠ Aprovação necessária: {props.approval.tool}
      </text>
      <text fg="#aaa" paddingLeft={1}>
        {inputPreview()}
      </text>
      <text fg="#555" marginTop={1}>
        Y aprovar · N recusar
      </text>
    </box>
  )
}

// ── AskCard ──────────────────────────────────────────────────────────────────
function AskCard(props: {
  question: {
    id: string
    questions: Array<{ question: string; header: string; options?: Array<{ label: string }> }>
  }
  onRespond: (id: string, answers: Record<string, string>) => void
}) {
  // Suporta apenas a primeira pergunta por simplicidade
  const q = () => props.question.questions[0]
  const [inputVal, setInputVal] = createSignal("")
  const [optIdx, setOptIdx] = createSignal(0)
  const hasOptions = () => (q()?.options?.length ?? 0) > 0

  const submit = (value: string) => {
    if (!value.trim()) return
    props.onRespond(props.question.id, { [q().question]: value })
  }

  useKeyboard((k) => {
    if (hasOptions()) {
      if (k.name === "up") setOptIdx((i) => Math.max(0, i - 1))
      if (k.name === "down") setOptIdx((i) => Math.min((q().options?.length ?? 1) - 1, i + 1))
      if (k.name === "return") submit(q().options?.[optIdx()]?.label ?? "")
    } else {
      if (k.name === "return") submit(inputVal())
    }
  })

  return (
    <box
      flexDirection="column"
      borderStyle="single"
      borderColor="#fbbf24"
      padding={1}
      marginX={1}
      gap={1}
    >
      <text fg="#fbbf24" bold>
        ? {q()?.question}
      </text>
      <Show
        when={hasOptions()}
        fallback={
          <box flexDirection="row" gap={1}>
            <text fg="#555">›</text>
            <input
              onInput={(v: string) => setInputVal(v)}
              onSubmit={(v: string) => submit(v)}
              focused={true}
              placeholder="resposta..."
            />
          </box>
        }
      >
        <For each={q()?.options ?? []}>
          {(opt, i) => (
            <text fg={i() === optIdx() ? "#fbbf24" : "#888"} bold={i() === optIdx()}>
              {i() === optIdx() ? "›" : " "} {opt.label}
            </text>
          )}
        </For>
        <text fg="#444">↑↓ navegar · Enter selecionar</text>
      </Show>
    </box>
  )
}

// ── ChatScreen ───────────────────────────────────────────────────────────────
export function ChatScreen(props: { chatId: string; onBack: () => void }) {
  const dims = useTerminalDimensions()
  const renderer = useRenderer()
  const { store, sendMessage, stopAgent, respondApproval, respondQuestion } = createWsClient(
    props.chatId
  )

  let scroll: ScrollBoxRenderable
  const [inputFocused, setInputFocused] = createSignal(true)

  // mantém foco no input quando não há pendências
  createEffect(() => {
    const hasPending = store.pendingApproval || store.pendingQuestion
    setInputFocused(!hasPending)
  })

  useKeyboard((k) => {
    // Ctrl+C: para agente se rodando, sai do TUI se idle
    if (k.ctrl && k.name === "c") {
      if (store.status !== "idle") stopAgent()
      else renderer.destroy()
    }
    if (k.name === "escape") props.onBack()
  })

  const statusColor = () => {
    if (store.status === "streaming") return "#fbbf24"
    if (store.status === "thinking") return "#a78bfa"
    return "#444"
  }

  const statusLabel = () => {
    if (store.status === "streaming") return "● streaming"
    if (store.status === "thinking") return "⟳ thinking"
    return "idle"
  }

  const costLabel = () => {
    if (!store.lastResult?.cost) return ""
    return `$${store.lastResult.cost.toFixed(4)}`
  }

  return (
    <box flexDirection="column" width={dims().width} height={dims().height}>
      {/* ── Status bar ── */}
      <box
        flexDirection="row"
        gap={2}
        paddingX={1}
        height={1}
        borderBottom={true}
        borderColor="#333"
      >
        <text fg="#7dd3fc" bold>
          my-agent
        </text>
        <text fg="#444">{props.chatId.slice(0, 8)}</text>
        <box flex={1} />
        <text fg={statusColor()}>{statusLabel()}</text>
        <Show when={costLabel()}>
          <text fg="#444">{costLabel()}</text>
        </Show>
        <text fg="#333">ESC volta</text>
      </box>

      {/* ── Mensagens ── */}
      <scrollbox
        ref={(r: any) => (scroll = r)}
        stickyScroll={true}
        stickyStart="bottom"
        flexGrow={1}
      >
        <box height={1} />
        <For each={store.messages}>{(msg) => <MessageItem msg={msg} />}</For>
        <box height={1} />
      </scrollbox>

      {/* ── Approval card ── */}
      <Show when={store.pendingApproval}>
        {(approval) => (
          <ApprovalCard approval={approval()} onRespond={respondApproval} />
        )}
      </Show>

      {/* ── Ask card ── */}
      <Show when={store.pendingQuestion}>
        {(question) => (
          <AskCard question={question()} onRespond={respondQuestion} />
        )}
      </Show>

      {/* ── Input ── */}
      <box
        flexDirection="row"
        alignItems="center"
        gap={1}
        paddingX={1}
        height={3}
        borderTop={true}
        borderColor="#333"
      >
        <text fg={store.status !== "idle" ? "#fbbf24" : "#555"}>{">"}</text>
        <input
          flex={1}
          onSubmit={(v: string) => {
            if (v.trim() && store.status === "idle") sendMessage(v.trim())
          }}
          focused={inputFocused()}
          placeholder={
            store.status !== "idle"
              ? "aguardando... (Ctrl+C para parar)"
              : "mensagem..."
          }
        />
      </box>
    </box>
  )
}
