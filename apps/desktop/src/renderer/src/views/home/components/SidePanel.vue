<script setup lang="ts">
import { ref, type Ref } from 'vue'
import { Icon } from '@/components/Icon'

defineOptions({ name: 'SidePanel' })

export interface SidePanelExpose {
  open: () => void
  close: () => void
  toggle: () => void
  /** 当前是否展开，只读，切换走 open / close / toggle */
  visible: Ref<boolean>
}

const visible = ref(false)

function open() {
  visible.value = true
}

function close() {
  visible.value = false
}

function toggle() {
  visible.value = !visible.value
}

defineExpose<SidePanelExpose>({ open, close, toggle, visible })

/** 和左侧栏顶栏同一套：拖动移动窗口，双击最大化 */
function onTitlebarMouseDown(event: MouseEvent) {
  if (event.button !== 0) return
  if (event.detail === 2) {
    void window.api.window.toggleMaximize()
  }
}

/** 右侧栏入口，目前只展示样式 */
const entries = [
  {
    id: 'workspace-files',
    icon: 'folder',
    title: '打开工作区文件',
    shortcut: '⌘ E'
  },
  {
    id: 'side-task',
    icon: 'hash',
    title: '打开侧边任务',
    description: '这是临时任务，关闭后将不会保留'
  },
  {
    id: 'browser',
    icon: 'globe',
    title: '打开内置浏览器',
    shortcut: '⌘ T'
  },
  {
    id: 'review',
    icon: 'square-plus',
    title: '打开审阅',
    shortcut: '⌘ G'
  },
  {
    id: 'terminal',
    icon: 'terminal',
    title: '打开终端',
    shortcut: '⌘ J'
  }
]
</script>

<template>
  <aside
    v-show="visible"
    class="flex h-full min-w-0 flex-col bg-(--ant-color-fill-quaternary) px-4"
  >
    <!-- 右边留给右上角按钮，拖拽层不能盖住它们 -->
    <div class="flex h-14 shrink-0">
      <div data-window-drag-region class="min-w-0 flex-1" @mousedown="onTitlebarMouseDown" />
      <div class="w-32 shrink-0" />
    </div>
    <ul class="flex min-h-0 flex-col gap-3 pb-4">
      <li v-for="entry in entries" :key="entry.id">
        <div
          class="flex items-center gap-3 rounded-(--ant-border-radius-lg) border border-(--ant-color-border-secondary) bg-(--ant-color-bg-container) px-3 py-3"
        >
          <span
            class="flex size-10 shrink-0 items-center justify-center rounded-(--ant-border-radius) bg-(--ant-color-fill-tertiary) text-(--ant-color-text-secondary)"
          >
            <Icon :icon="entry.icon" :size="18" />
          </span>
          <span class="min-w-0 flex-1">
            <span class="block truncate text-sm font-medium text-(--ant-color-text)">
              {{ entry.title }}
            </span>
            <span class="mt-0.5 block truncate text-xs text-(--ant-color-text-tertiary)">
              {{ entry.shortcut ?? entry.description }}
            </span>
          </span>
        </div>
      </li>
    </ul>
  </aside>
</template>
