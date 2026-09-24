<script setup lang="ts">
import { computed, ref } from 'vue'
import { Icon } from '@/components/Icon'
import type { AgentConversation, AgentConversationGroup } from '../types'

const props = withDefaults(
  defineProps<{
    conversations?: AgentConversation[]
    groups?: AgentConversationGroup[]
    activeId?: string
  }>(),
  {
    conversations: () => []
  }
)

const emit = defineEmits<{ select: [id: string] }>()

/** 未出现在表里的分组默认展开 */
const collapsed = ref<Record<string, boolean>>({})

function isOpen(groupId: string) {
  return !collapsed.value[groupId]
}

const PANEL_MS = 200
const panelEls = new Map<string, HTMLElement>()
const panelMotions = new Map<string, Animation>()

function bindPanel(groupId: string) {
  return (el: unknown) => {
    if (el instanceof HTMLElement) panelEls.set(groupId, el)
    else panelEls.delete(groupId)
  }
}

function toggleGroup(groupId: string) {
  const node = panelEls.get(groupId)
  const willOpen = !isOpen(groupId)
  collapsed.value = {
    ...collapsed.value,
    [groupId]: !willOpen
  }
  if (!node) return

  const running = panelMotions.get(groupId)
  if (running) {
    const height = node.getBoundingClientRect().height
    running.cancel()
    node.style.height = `${height}px`
  }

  const from = node.getBoundingClientRect().height
  const to = willOpen ? node.scrollHeight : 0
  const opacity = Number(getComputedStyle(node).opacity)
  node.style.overflow = 'hidden'
  const motion = node.animate(
    [
      { height: `${from}px`, opacity },
      { height: `${to}px`, opacity: willOpen ? 1 : 0 }
    ],
    { duration: PANEL_MS, easing: 'ease-out' }
  )
  panelMotions.set(groupId, motion)
  motion.onfinish = () => {
    panelMotions.delete(groupId)
    node.style.height = willOpen ? 'auto' : '0px'
    node.style.opacity = willOpen ? '1' : '0'
  }
}

const groups = computed<AgentConversationGroup[]>(() => {
  if (props.groups) return props.groups
  return [
    {
      id: 'default',
      name: '',
      conversations: props.conversations
    }
  ]
})

function timeText(item: AgentConversation) {
  if (item.timeLabel) return item.timeLabel
  const updated = new Date(item.updatedAt).getTime()
  if (Number.isNaN(updated)) return ''
  const minutes = Math.max(0, Math.round((Date.now() - updated) / 60000))
  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes}分钟`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}小时`
  const days = Math.round(hours / 24)
  return `${days}天`
}
</script>

<template>
  <!-- 分组任务列表：antd 的菜单和按钮对不上这套「标题 + 时间」行，所以样式写在组件里 -->
  <div class="min-h-0 space-y-1 overflow-y-auto text-sm">
    <section v-for="group in groups" :key="group.id">
      <button
        v-if="group.name"
        type="button"
        class="flex w-full cursor-pointer items-center gap-2 rounded-(--ant-border-radius) border-0 bg-transparent px-2 py-1 text-left text-(--ant-color-text) hover:bg-(--ant-color-fill-tertiary) focus-visible:bg-(--ant-color-fill-tertiary) focus-visible:outline-none"
        :aria-expanded="isOpen(group.id)"
        @click="toggleGroup(group.id)"
      >
        <span class="relative inline-flex size-4 shrink-0">
          <Icon
            icon="folder"
            :size="16"
            class="absolute text-(--ant-color-text-tertiary) transition-opacity duration-200"
            :class="isOpen(group.id) ? 'opacity-0' : 'opacity-100'"
          />
          <Icon
            icon="folder-open"
            :size="16"
            class="text-(--ant-color-text-tertiary) transition-opacity duration-200"
            :class="isOpen(group.id) ? 'opacity-100' : 'opacity-0'"
          />
        </span>
        <span class="min-w-0 truncate">{{ group.name }}</span>
      </button>

      <!-- 列表高度、透明度用动画过渡；文件夹图标在按钮里做透明度过渡 -->
      <div
        :ref="bindPanel(group.id)"
        class="overflow-hidden"
        :class="isOpen(group.id) ? '' : 'pointer-events-none'"
      >
        <p
          v-if="!group.conversations.length"
          class="m-0 py-1 pr-2 pl-8 text-(--ant-color-text-tertiary)"
        >
          暂无任务
        </p>
        <div v-else>
          <button
            v-for="item in group.conversations"
            :key="item.id"
            type="button"
            class="flex w-full cursor-pointer items-center gap-3 rounded-(--ant-border-radius) border-0 py-1 pr-2 pl-8 text-left text-(--ant-color-text) focus-visible:outline-none"
            :class="
              item.id === activeId
                ? 'bg-(--ant-color-fill-secondary)'
                : 'bg-transparent hover:bg-(--ant-color-fill-tertiary) focus-visible:bg-(--ant-color-fill-tertiary)'
            "
            :aria-current="item.id === activeId ? 'true' : undefined"
            @click="emit('select', item.id)"
          >
            <span class="min-w-0 flex-1 truncate">{{ item.title }}</span>
            <span class="shrink-0 text-xs text-(--ant-color-text-tertiary)">{{
              timeText(item)
            }}</span>
          </button>
        </div>
      </div>
    </section>
  </div>
</template>
