import { render } from "@opentui/solid"
import { createCliRenderer } from "@opentui/core"
import { App } from "./App"

const renderer = await createCliRenderer({
  exitOnCtrlC: false,
  targetFps: 60,
})

await render(() => <App />, renderer)
