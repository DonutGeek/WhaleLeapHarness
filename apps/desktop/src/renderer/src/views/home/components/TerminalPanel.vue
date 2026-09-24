<script setup lang="ts">
import {
  computed,
  defineComponent,
  h,
  onBeforeUnmount,
  ref,
  watch,
  type PropType,
  type Ref
} from 'vue'
import { Button, CheckableTagGroup, Splitter, SplitterPanel, Tooltip } from 'antdv-next'
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

/** horizontal：左右并排；vertical：上下堆叠。和 antdv-next Splitter 的 orientation 一致 */
type SplitOrientation = 'horizontal' | 'vertical'

interface TerminalLeaf {
  kind: 'leaf'
  sessionId: string
}

interface SplitBranch {
  kind: 'split'
  id: string
  orientation: SplitOrientation
  children: LayoutNode[]
}

type LayoutNode = TerminalLeaf | SplitBranch

interface TerminalSession {
  id: string
  name: string
}

let nextSessionId = 1
let nextDisplayNumber = 1
let nextSplitId = 1

function allocateSession(): TerminalSession {
  return {
    id: `terminal-${nextSessionId++}`,
    name: `终端 ${nextDisplayNumber++}`
  }
}

function leaf(sessionId: string): TerminalLeaf {
  return { kind: 'leaf', sessionId }
}

const visible = ref(false)
const initialSession = allocateSession()
const sessions = ref<TerminalSession[]>([initialSession])
const layout = ref<LayoutNode>(leaf(initialSession.id))
const activeSessionId = ref(initialSession.id)

function createSession() {
  const session = allocateSession()
  sessions.value.push(session)
  return session.id
}

function nodeAt(node: LayoutNode, path: number[]): LayoutNode | null {
  let current: LayoutNode = node
  for (const index of path) {
    if (current.kind !== 'split') return null
    const child = current.children[index]
    if (!child) return null
    current = child
  }
  return current
}

function findPath(node: LayoutNode, sessionId: string, path: number[] = []): number[] | null {
  if (node.kind === 'leaf') return node.sessionId === sessionId ? path : null
  for (let index = 0; index < node.children.length; index += 1) {
    const found = findPath(node.children[index], sessionId, [...path, index])
    if (found) return found
  }
  return null
}

function replaceAt(node: LayoutNode, path: number[], next: LayoutNode): LayoutNode {
  if (path.length === 0) return next
  if (node.kind !== 'split') return node
  const [index, ...rest] = path
  const children = node.children.slice()
  const child = children[index]
  if (!child) return node
  children[index] = replaceAt(child, rest, next)
  return { ...node, children }
}

function firstSessionId(node: LayoutNode): string {
  return node.kind === 'leaf' ? node.sessionId : firstSessionId(node.children[0])
}

function collectSessionIds(node: LayoutNode, ids: string[] = []) {
  if (node.kind === 'leaf') {
    ids.push(node.sessionId)
    return ids
  }
  node.children.forEach((child) => collectSessionIds(child, ids))
  return ids
}

/** 关掉面板后丢掉全部分屏和会话，下次打开从「终端 1」重新开始 */
function resetPanelState() {
  nextDisplayNumber = 1
  const session = allocateSession()
  sessions.value = [session]
  layout.value = leaf(session.id)
  activeSessionId.value = session.id
}

function addTerminal() {
  const id = createSession()
  const path = findPath(layout.value, activeSessionId.value) ?? []
  const current = nodeAt(layout.value, path)
  if (current?.kind === 'leaf') layout.value = replaceAt(layout.value, path, leaf(id))
  activeSessionId.value = id
}

/** 只切开当前选中的那一块；父级已经是同一方向时并进同一组分屏 */
function split(orientation: SplitOrientation) {
  const path = findPath(layout.value, activeSessionId.value)
  if (!path) return
  const current = nodeAt(layout.value, path)
  if (current?.kind !== 'leaf') return

  const created = leaf(createSession())
  const parentPath = path.slice(0, -1)
  const parent = parentPath.length === 0 ? null : nodeAt(layout.value, parentPath)
  if (parent?.kind === 'split' && parent.orientation === orientation) {
    const index = path[path.length - 1] ?? 0
    const children = parent.children.slice()
    children.splice(index + 1, 0, created)
    const nextParent: SplitBranch = { ...parent, children }
    layout.value =
      parentPath.length === 0 ? nextParent : replaceAt(layout.value, parentPath, nextParent)
  } else {
    const branch: SplitBranch = {
      kind: 'split',
      id: `split-${nextSplitId++}`,
      orientation,
      children: [current, created]
    }
    layout.value = replaceAt(layout.value, path, branch)
  }
  activeSessionId.value = created.sessionId
}

function selectSession(sessionId: string) {
  if (findPath(layout.value, sessionId)) {
    activeSessionId.value = sessionId
    return
  }
  const path = findPath(layout.value, activeSessionId.value) ?? []
  layout.value = replaceAt(layout.value, path, leaf(sessionId))
  activeSessionId.value = sessionId
}

/** 再点已选中的标签会变成 null，会话切换只接受有效 id */
function onSessionChange(value: string | number | Array<string | number> | null) {
  if (typeof value === 'string') selectSession(value)
}

const sessionOptions = computed(() =>
  sessions.value.map((session) => ({
    value: session.id,
    label: h('span', { class: 'h-full inline-flex items-center gap-1' }, [
      h(Icon, { icon: 'terminal', size: 16 }),
      session.name,
      h(
        'button',
        {
          type: 'button',
          class: 'inline-flex cursor-pointer border-0 bg-transparent p-0 text-inherit',
          onClick: (event: MouseEvent) => {
            event.stopPropagation()
            void closeSession(session.id)
          }
        },
        [h(Icon, { icon: 'x', size: 12 })]
      )
    ])
  }))
)

function closeBackendSessions(sessionIds: string[]) {
  void Promise.all(
    sessionIds.map((sessionId) => window.api.terminal.close(sessionId).catch(() => undefined))
  )
}

function removeSession(node: LayoutNode, sessionId: string): LayoutNode | null {
  if (node.kind === 'leaf') return node.sessionId === sessionId ? null : node
  const children = node.children
    .map((child) => removeSession(child, sessionId))
    .filter((child): child is LayoutNode => child !== null)
  if (children.length === 0) return null
  if (children.length === 1) return children[0]
  return { ...node, children }
}

async function closeSession(sessionId: string) {
  await window.api.terminal.close(sessionId).catch(() => undefined)
  const sessionIndex = sessions.value.findIndex((session) => session.id === sessionId)
  if (sessionIndex < 0) return
  sessions.value.splice(sessionIndex, 1)

  const nextLayout = removeSession(layout.value, sessionId)
  if (!nextLayout || sessions.value.length === 0) {
    close()
    return
  }
  layout.value = nextLayout
  if (!findPath(nextLayout, activeSessionId.value)) {
    activeSessionId.value = firstSessionId(nextLayout)
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

const TerminalLayout = defineComponent({
  name: 'TerminalLayout',
  props: {
    node: { type: Object as PropType<LayoutNode>, required: true }
  },
  setup(props) {
    return () => {
      const node = props.node
      if (node.kind === 'leaf') {
        return h(Terminal, {
          sessionId: node.sessionId,
          onFocus: () => {
            activeSessionId.value = node.sessionId
          }
        })
      }
      return h(
        Splitter,
        { orientation: node.orientation, class: 'h-full min-h-0 min-w-0' },
        {
          default: () =>
            node.children.map((child) =>
              h(
                SplitterPanel,
                {
                  key: child.kind === 'leaf' ? child.sessionId : child.id,
                  min: 80,
                  class: 'min-h-0 min-w-0 overflow-hidden'
                },
                { default: () => h(TerminalLayout, { node: child }) }
              )
            )
        }
      )
    }
  }
})

watch(visible, (opened) => {
  if (opened) return
  const sessionIds = [
    ...new Set([...sessions.value.map((session) => session.id), ...collectSessionIds(layout.value)])
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
    >
      <div class="relative z-10 flex shrink-0 items-center justify-between gap-2 px-2 py-2">
        <CheckableTagGroup
          :options="sessionOptions"
          :value="activeSessionId"
          @change="onSessionChange"
        />
        <div class="flex items-center gap-2">
          <Tooltip title="左右分屏">
            <Button size="small" @click="split('horizontal')">
              <template #icon><Icon icon="columns-2" :size="16" /></template>
            </Button>
          </Tooltip>
          <Tooltip title="上下分屏">
            <Button size="small" @click="split('vertical')">
              <template #icon><Icon icon="panel-bottom" :size="16" /></template>
            </Button>
          </Tooltip>
          <Tooltip title="新建终端">
            <Button size="small" @click="addTerminal">
              <template #icon><Icon icon="plus" :size="16" /></template>
            </Button>
          </Tooltip>
          <Tooltip title="关闭终端面板">
            <Button size="small" @click="close">
              <template #icon><Icon icon="x" :size="16" /></template>
            </Button>
          </Tooltip>
        </div>
      </div>

      <div class="min-h-0 flex-1 overflow-hidden">
        <TerminalLayout :node="layout" />
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
