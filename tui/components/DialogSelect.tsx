import { createSignal, createMemo, For, Show } from "solid-js"
import { useKeyboard, useTerminalDimensions } from "@opentui/solid"
import { RGBA, type InputRenderable } from "@opentui/core"
import { COLOR } from "../theme"

const OVERLAY = RGBA.fromValues(0, 0, 0, 0.6)

export type SelectOption = {
  value: string
  label: string
  hint?: string // texto secundário à direita (ex: provider, atalho)
  group?: string // header de seção
  current?: boolean // marca ● (item ativo)
}

/**
 * Lista de seleção fuzzy reutilizável (modelo, effort, tema, comandos).
 * Versão enxuta do DialogSelect do OpenCode: overlay absoluto, filtro por
 * substring, navegação ↑↓, grupos, marca do item atual. Teclado próprio
 * (sem o addon @opentui/keymap).
 */
export function DialogSelect(props: {
  title: string
  options: SelectOption[]
  onSelect: (value: string) => void
  onCancel: () => void
  onMove?: (value: string) => void // preview ao vivo (ex: temas)
}) {
  const dims = useTerminalDimensions()
  const [query, setQuery] = createSignal("")
  const [idx, setIdx] = createSignal(0)
  let input: InputRenderable | undefined

  // filtro por substring case-insensitive sobre label+hint+group
  const filtered = createMemo(() => {
    const q = query().toLowerCase().trim()
    if (!q) return props.options
    return props.options.filter((o) =>
      `${o.label} ${o.hint ?? ""} ${o.group ?? ""}`.toLowerCase().includes(q),
    )
  })

  // agrupa preservando ordem; itens sem group caem em "" (sem header)
  const groups = createMemo(() => {
    const out: { group: string; items: { opt: SelectOption; flat: number }[] }[] = []
    filtered().forEach((opt, flat) => {
      const g = opt.group ?? ""
      let bucket = out.find((b) => b.group === g)
      if (!bucket) {
        bucket = { group: g, items: [] }
        out.push(bucket)
      }
      bucket.items.push({ opt, flat })
    })
    return out
  })

  const clampIdx = (n: number) => Math.max(0, Math.min(filtered().length - 1, n))

  const move = (dir: -1 | 1) => {
    const next = clampIdx(idx() + dir)
    setIdx(next)
    props.onMove?.(filtered()[next]?.value)
  }

  const confirm = () => {
    const opt = filtered()[idx()]
    if (opt) props.onSelect(opt.value)
  }

  useKeyboard((k) => {
    if (k.name === "escape") {
      props.onCancel()
      return
    }
    if (k.name === "up") move(-1)
    else if (k.name === "down") move(1)
    else if (k.name === "return") confirm()
  })

  // largura/altura do painel
  const width = () => Math.min(64, dims().width - 4)
  const maxRows = () => Math.min(filtered().length + groups().length, dims().height - 8)

  return (
    <box
      position="absolute"
      top={0}
      left={0}
      width={dims().width}
      height={dims().height}
      backgroundColor={OVERLAY}
      alignItems="center"
      justifyContent="center"
      zIndex={3000}
    >
      <box
        flexDirection="column"
        width={width()}
        borderStyle="rounded"
        borderColor={COLOR.accent}
        backgroundColor={COLOR.surface}
        padding={1}
        gap={1}
      >
        <text fg={COLOR.accent}>
          <b>{props.title}</b>
        </text>

        {/* filtro */}
        <box flexDirection="row" gap={1}>
          <text fg={COLOR.muted}>🔍</text>
          <input
            ref={(r: InputRenderable) => {
              input = r
              setTimeout(() => input?.focus(), 0)
            }}
            flexGrow={1}
            focused={true}
            onInput={(v: string) => {
              setQuery(v)
              setIdx(0)
            }}
            placeholder="filtrar..."
          />
        </box>

        {/* lista */}
        <box flexDirection="column" maxHeight={maxRows()}>
          <For each={groups()}>
            {(bucket) => (
              <box flexDirection="column">
                <Show when={bucket.group}>
                  <text fg={COLOR.dim}>{bucket.group}</text>
                </Show>
                <For each={bucket.items}>
                  {({ opt, flat }) => (
                    <box flexDirection="row" gap={1} paddingLeft={bucket.group ? 1 : 0}>
                      <text fg={flat === idx() ? COLOR.accent : COLOR.text}>
                        {flat === idx() ? "▸" : " "} {opt.current ? "● " : ""}
                        {opt.label}
                      </text>
                      <box flexGrow={1} />
                      <Show when={opt.hint}>
                        <text fg={COLOR.dim}>{opt.hint}</text>
                      </Show>
                    </box>
                  )}
                </For>
              </box>
            )}
          </For>
          <Show when={filtered().length === 0}>
            <text fg={COLOR.dim}>nenhum resultado</text>
          </Show>
        </box>

        <text fg={COLOR.dim}>↑↓ navegar · Enter escolher · ESC cancelar</text>
      </box>
    </box>
  )
}
