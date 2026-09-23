<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { FitAddon } from '@xterm/addon-fit'
import { Terminal } from '@xterm/xterm'
import '@xterm/xterm/css/xterm.css'

defineOptions({ name: 'Terminal' })

const props = defineProps<{ sessionId: string }>()
const emit = defineEmits<{ focus: [] }>()

interface TerminalOutput {
  sessionId: string
  data: string
}

const terminalHost = ref<HTMLElement>()
let terminal: Terminal | undefined
let fitAddon: FitAddon | undefined
let resizeObserver: ResizeObserver | undefined
let unlistenOutput: (() => void) | undefined
let themeObserver: MutationObserver | undefined

function getThemeColor(name: string, fallback: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback
}

function applyTerminalTheme() {
  if (!terminal) return
  terminal.options.theme = {
    background: getThemeColor('--ant-color-bg-container', '#ffffff'),
    foreground: getThemeColor('--ant-color-text', '#141414'),
    cursor: getThemeColor('--ant-color-primary', '#1677ff'),
    selectionBackground: getThemeColor('--ant-color-primary-bg', '#e6f4ff')
  }
}

async function resizeTerminal() {
  if (!terminal || !fitAddon) return
  fitAddon.fit()
  await window.api.terminal.resize(props.sessionId, terminal.cols, terminal.rows)
}

onMounted(async () => {
  if (!terminalHost.value) return
  fitAddon = new FitAddon()
  terminal = new Terminal({
    cursorBlink: true,
    cursorStyle: 'bar',
    fontFamily: '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
    fontSize: 13
  })
  terminal.loadAddon(fitAddon)
  terminal.open(terminalHost.value)
  applyTerminalTheme()
  themeObserver = new MutationObserver(applyTerminalTheme)
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme', 'style']
  })
  unlistenOutput = window.api.terminal.onOutput((output: TerminalOutput) => {
    if (output.sessionId === props.sessionId) terminal?.write(output.data)
  })
  terminal.onData((data) => void window.api.terminal.write(props.sessionId, data))
  await window.api.terminal.create(props.sessionId, terminal.cols, terminal.rows)
  resizeObserver = new ResizeObserver(() => void resizeTerminal())
  resizeObserver.observe(terminalHost.value)
  await resizeTerminal()
  terminal.focus()
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  themeObserver?.disconnect()
  unlistenOutput?.()
  terminal?.dispose()
})
</script>

<template>
  <div
    ref="terminalHost"
    class="h-full w-full overflow-hidden [&_.xterm]:h-full [&_.xterm]:px-3 [&_.xterm]:py-2.5"
    tabindex="0"
    @focusin="emit('focus')"
    @pointerdown="emit('focus')"
  />
</template>
