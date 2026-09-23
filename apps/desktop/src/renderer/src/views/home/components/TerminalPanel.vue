<script setup lang="ts">
import { computed, onBeforeUnmount, ref, type Ref, watch } from 'vue'
import { Button, Tag, Tooltip } from 'antdv-next'
import { Icon } from '@/components/Icon'
import { Terminal } from '@/components/Terminal'

defineOptions({ name: 'TerminalPanel' })

export interface TerminalPanelExpose {
  open: () => void
  close: () => void
  toggle: () => void
  /** 当前是否展开，只读，切换走 open / close / toggle */
  visible: Ref<boolean>
}

type SplitDirection = 'single' | 'vertical' | 'horizontal'

const PANE_MIN_RATIO = 0.2
const PANE_MAX_RATIO = 0.8

interface TerminalSession {
  id: string
  name: string
}

let nextSessionId = 1
let nextDisplayNumber = 1

function allocateSession(): TerminalSession {
  return {
    id: `terminal-${nextSessionId++}`,
    name: `终端 ${nextDisplayNumber++}`
  }
}

const visible = ref(false)
const initialSession = allocateSession()
const sessions = ref<TerminalSession[]>([initialSession])
const paneSessionIds = ref([initialSession.id])
const splitDirection = ref<SplitDirection>('single')
const activePane = ref(0)
const activeSessionId = computed(
  () => paneSessionIds.value[activePane.value] ?? paneSessionIds.value[0] ?? ''
)
const splitRatio = ref(0.5)
const splitResizing = ref(false)
const hoveredSessionId = ref<string>()

function createSession() {
  const session = allocateSession()
  sessions.value.push(session)
  return session.id
}

/** 关掉面板后丢掉全部分屏和会话，下次打开从「终端 1」重新开始 */
function resetPanelState() {
  nextDisplayNumber = 1
  const session = allocateSession()
  sessions.value = [session]
  paneSessionIds.value = [session.id]
  splitDirection.value = 'single'
  activePane.value = 0
  splitRatio.value = 0.5
  hoveredSessionId.value = undefined
}

function addTerminal() {
  const id = createSession()
  paneSessionIds.value[activePane.value] = id
}

function split(direction: Exclude<SplitDirection, 'single'>) {
  if (splitDirection.value === 'single') {
    paneSessionIds.value = [paneSessionIds.value[0], createSession()]
  }
  splitDirection.value = direction
  activePane.value = 1
}

function selectSession(sessionId: string) {
  const paneIndex = paneSessionIds.value.indexOf(sessionId)
  if (paneIndex >= 0) activePane.value = paneIndex
  else paneSessionIds.value[activePane.value] = sessionId
}

function closeBackendSessions(sessionIds: string[]) {
  void Promise.all(
    sessionIds.map((sessionId) => window.api.terminal.close(sessionId).catch(() => undefined))
  )
}

async function closeSession(sessionId: string) {
  await window.api.terminal.close(sessionId).catch(() => undefined)
  const sessionIndex = sessions.value.findIndex((session) => session.id === sessionId)
  if (sessionIndex < 0) return

  sessions.value.splice(sessionIndex, 1)
  hoveredSessionId.value = undefined
  const paneIndex = paneSessionIds.value.indexOf(sessionId)
  if (paneIndex >= 0) {
    if (paneSessionIds.value.length > 1) {
      paneSessionIds.value.splice(paneIndex, 1)
      splitDirection.value = 'single'
      activePane.value = 0
    } else if (sessions.value[0]) {
      paneSessionIds.value[0] = sessions.value[0].id
      activePane.value = 0
    } else {
      close()
    }
  }
}

function open() {
  visible.value = true
}

function close() {
  visible.value = false
}

function toggle() {
  visible.value = !visible.value
}

defineExpose<TerminalPanelExpose>({ open, close, toggle, visible })

function paneStyle(index: number) {
  if (splitDirection.value === 'single') return undefined
  return { flexGrow: index === 0 ? splitRatio.value : 1 - splitRatio.value }
}

function onSplitPointerDown(event: PointerEvent) {
  if (event.button !== 0 || splitDirection.value === 'single') return
  const handle = event.currentTarget as HTMLElement | null
  const panes = handle?.parentElement
  if (!panes) return

  splitResizing.value = true
  const rect = panes.getBoundingClientRect()
  const vertical = splitDirection.value === 'vertical'
  const startPosition = vertical ? event.clientX : event.clientY
  const totalSize = vertical ? rect.width : rect.height
  const startRatio = splitRatio.value
  const onMove = (moveEvent: PointerEvent) => {
    const position = vertical ? moveEvent.clientX : moveEvent.clientY
    const nextRatio = startRatio + (position - startPosition) / totalSize
    splitRatio.value = Math.min(PANE_MAX_RATIO, Math.max(PANE_MIN_RATIO, nextRatio))
  }
  const onUp = () => {
    splitResizing.value = false
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
  }

  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
}

watch(visible, (opened) => {
  if (opened) return
  const sessionIds = [
    ...new Set([...sessions.value.map((session) => session.id), ...paneSessionIds.value])
  ]
  resetPanelState()
  closeBackendSessions(sessionIds)
})

onBeforeUnmount(() => {
  closeBackendSessions(sessions.value.map((session) => session.id))
})
</script>

<template>
  <Transition name="terminal-panel">
    <section
      v-if="visible"
      class="relative flex h-full min-h-0 flex-col overflow-hidden bg-(--ant-color-bg-container) text-(--ant-color-text)"
      aria-label="终端面板"
    >
      <div class="relative z-10 flex h-8 shrink-0 items-center justify-between gap-2 px-2">
        <div
          class="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto"
          role="tablist"
          aria-label="终端会话"
        >
          <Tag
            v-for="session in sessions"
            :key="session.id"
            :bordered="false"
            class="terminal-tag inline-flex! cursor-pointer items-center gap-1.5 border-transparent! bg-transparent! text-(--ant-color-text-secondary)! hover:bg-(--ant-color-fill-tertiary)! hover:text-(--ant-color-text)!"
            :class="
              session.id === activeSessionId
                ? 'bg-(--ant-color-primary-bg)! text-(--ant-color-primary)! shadow-[inset_0_0_0_1px_var(--ant-color-primary)]'
                : ''
            "
            role="tab"
            :aria-selected="session.id === activeSessionId"
            @mouseenter="hoveredSessionId = session.id"
            @mouseleave="hoveredSessionId = undefined"
            @click="selectSession(session.id)"
          >
            <template #icon>
              <span
                class="inline-flex"
                :aria-label="hoveredSessionId === session.id ? `关闭${session.name}` : session.name"
                @click.stop="hoveredSessionId === session.id && closeSession(session.id)"
              >
                <Icon :icon="hoveredSessionId === session.id ? 'x' : 'terminal'" :size="16" />
              </span>
            </template>
            {{ session.name }}
          </Tag>
        </div>
        <div class="flex shrink-0 items-center gap-2">
          <Tooltip title="左右分屏">
            <Button
              size="small"
              class="border-transparent! bg-transparent! text-(--ant-color-icon)! hover:bg-(--ant-color-fill-tertiary)! hover:text-(--ant-color-text)!"
              aria-label="左右分屏"
              @click="split('vertical')"
            >
              <template #icon><Icon icon="columns-2" :size="17" /></template>
            </Button>
          </Tooltip>
          <Tooltip title="上下分屏">
            <Button
              size="small"
              class="border-transparent! bg-transparent! text-(--ant-color-icon)! hover:bg-(--ant-color-fill-tertiary)! hover:text-(--ant-color-text)!"
              aria-label="上下分屏"
              @click="split('horizontal')"
            >
              <template #icon><Icon icon="panel-bottom" :size="17" /></template>
            </Button>
          </Tooltip>
          <Tooltip title="新建终端">
            <Button
              size="small"
              class="border-transparent! bg-transparent! text-(--ant-color-icon)! hover:bg-(--ant-color-fill-tertiary)! hover:text-(--ant-color-text)!"
              aria-label="新建终端"
              @click="addTerminal"
            >
              <template #icon><Icon icon="plus" :size="18" /></template>
            </Button>
          </Tooltip>
          <Tooltip title="关闭终端面板">
            <Button
              size="small"
              class="border-transparent! bg-transparent! text-(--ant-color-icon)! hover:bg-(--ant-color-fill-tertiary)! hover:text-(--ant-color-text)!"
              aria-label="关闭终端面板"
              @click="close"
            >
              <template #icon><Icon icon="x" :size="18" /></template>
            </Button>
          </Tooltip>
        </div>
      </div>

      <div
        class="flex min-h-0 flex-1 overflow-hidden"
        :class="splitDirection === 'horizontal' ? 'flex-col' : ''"
      >
        <template v-for="(sessionId, index) in paneSessionIds" :key="sessionId">
          <div
            class="flex min-h-0 min-w-0 flex-1 basis-0 flex-col outline-none"
            :class="
              index === activePane
                ? 'shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--ant-color-primary)_40%,transparent)]'
                : ''
            "
            :style="paneStyle(index)"
          >
            <Terminal :key="sessionId" :session-id="sessionId" @focus="activePane = index" />
          </div>
          <div
            v-if="index === 0 && splitDirection !== 'single'"
            class="relative z-1 shrink-0 grow-0 basis-[7px] touch-none before:absolute before:bg-(--ant-color-border-secondary) before:transition-colors before:duration-150 hover:before:bg-(--ant-color-fill)"
            :class="[
              splitDirection === 'vertical'
                ? 'cursor-col-resize before:top-0 before:bottom-0 before:left-[3px] before:w-px'
                : 'cursor-row-resize before:right-0 before:bottom-[3px] before:left-0 before:h-px',
              splitResizing ? 'before:bg-(--ant-color-fill)' : ''
            ]"
            role="separator"
            :aria-label="splitDirection === 'vertical' ? '调整左右终端宽度' : '调整上下终端高度'"
            :aria-orientation="splitDirection === 'vertical' ? 'vertical' : 'horizontal'"
            @pointerdown="onSplitPointerDown"
          />
        </template>
      </div>
    </section>
  </Transition>
</template>

<style scoped>
@reference "../../../design/tailwind.css";

/* Vue 过渡类名挂在面板上，工具类表达不了进入/离开两套状态 */
.terminal-panel-enter-active,
.terminal-panel-leave-active {
  @apply transition-opacity duration-200 ease-out;
}

.terminal-panel-enter-from,
.terminal-panel-leave-to {
  @apply opacity-0;
}
</style>
