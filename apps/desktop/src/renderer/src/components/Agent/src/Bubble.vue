<script setup lang="ts">
import { computed, ref } from 'vue'
import { Button, Tooltip } from 'antdv-next'
import { Icon } from '@/components/Icon'
import CodeHighlighter from './CodeHighlighter.vue'
import type { AgentAttachment, AgentRole } from './types'

const props = withDefaults(
  defineProps<{
    role: AgentRole
    content: string
    createdAt?: string
    pending?: boolean
    attachments?: AgentAttachment[]
  }>(),
  { pending: false, attachments: () => [] }
)

const isUser = computed(() => props.role === 'user')
const copied = ref(false)
const sentAt = computed(() => {
  if (!props.createdAt) return ''

  const date = new Date(props.createdAt)
  if (Number.isNaN(date.getTime())) return ''

  const now = new Date()
  const isToday =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  const pad = (value: number) => String(value).padStart(2, '0')
  const weekday = ['日', '一', '二', '三', '四', '五', '六'][date.getDay()]
  const time = `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`

  return isToday
    ? `星期${weekday} ${time}`
    : `${date.getFullYear()}年${pad(date.getMonth() + 1)}月${pad(date.getDate())}日 星期${weekday} ${time}`
})

type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'code'; language: string; code: string }

/** 把围栏代码块拆出来，走 highlight.js；其余当纯文本 */
const blocks = computed<ContentBlock[]>(() => {
  const content = props.content
  const result: ContentBlock[] = []
  const fence = /```(\w*)\n?([\s\S]*?)```/g
  let last = 0
  let match: RegExpExecArray | null
  while ((match = fence.exec(content))) {
    if (match.index > last) {
      result.push({ type: 'text', text: content.slice(last, match.index) })
    }
    result.push({
      type: 'code',
      language: match[1] || 'plaintext',
      code: match[2].replace(/\n$/, '')
    })
    last = match.index + match[0].length
  }
  if (last < content.length) {
    result.push({ type: 'text', text: content.slice(last) })
  }
  return result.length ? result : [{ type: 'text', text: content }]
})

async function copyContent() {
  await navigator.clipboard?.writeText(props.content)
  copied.value = true
  window.setTimeout(() => {
    copied.value = false
  }, 1200)
}
</script>

<template>
  <article class="agent-bubble group flex w-full">
    <div
      class="flex min-w-0 max-w-full flex-col"
      :class="isUser ? 'ml-auto items-end @xl/conversation:max-w-xl' : 'items-start'"
    >
      <div
        v-if="attachments.length"
        class="mb-2 flex flex-wrap gap-2"
        :class="isUser ? 'justify-end' : ''"
      >
        <span
          v-for="item in attachments"
          :key="item.id"
          class="relative block size-14 shrink-0 overflow-hidden rounded-(--ant-border-radius) border border-solid border-(--ant-color-border-secondary) bg-(--ant-color-fill-secondary)"
          :class="
            item.kind !== 'image' ? 'flex w-auto min-w-14 max-w-45 items-center px-2 py-1.5' : ''
          "
          :title="item.name"
        >
          <img
            v-if="item.kind === 'image' && item.previewUrl"
            class="block size-full object-cover"
            :src="item.previewUrl"
            :alt="item.name"
          />
          <span v-else class="flex items-center gap-1.5 text-(--ant-color-text)">
            <Icon icon="file" :size="14" />
            <span class="line-clamp-2 text-xs leading-4 break-all">{{ item.name }}</span>
          </span>
        </span>
      </div>

      <div
        v-if="isUser"
        class="w-max max-w-full rounded-(--ant-border-radius-lg) border border-solid border-(--ant-color-border) bg-(--ant-color-fill-secondary) px-4 py-3 text-sm leading-relaxed break-words whitespace-pre-wrap text-(--ant-color-text)"
      >
        {{ content.replace(/[\r\n]+$/u, '') }}
      </div>
      <div v-else class="w-full text-sm leading-relaxed text-(--ant-color-text)">
        <template v-for="(block, index) in blocks" :key="index">
          <p
            v-if="block.type === 'text' && block.text.trim()"
            class="mb-2.5 break-words whitespace-pre-wrap last:mb-0"
          >
            {{ block.text.trim() }}
          </p>
          <CodeHighlighter
            v-else-if="block.type === 'code'"
            :code="block.code"
            :language="block.language"
          />
        </template>
      </div>

      <div
        class="mt-1.5 flex w-max max-w-full items-center gap-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100"
      >
        <time
          v-if="sentAt && isUser"
          class="flex h-6 shrink-0 items-center px-1 text-xs text-(--ant-color-text-tertiary)"
          :datetime="createdAt"
        >
          {{ sentAt }}
        </time>
        <Tooltip :title="copied ? '已复制' : '复制'" :open="copied ? true : undefined">
          <Button type="text" size="small" aria-label="复制" @click="copyContent">
            <template #icon>
              <Icon v-if="copied" icon="check" :size="14" />
              <Icon v-else icon="copy" :size="14" />
            </template>
          </Button>
        </Tooltip>
        <Tooltip v-if="!isUser" title="重新尝试">
          <Button type="text" size="small" aria-label="重新尝试">
            <template #icon><Icon icon="rotate-ccw" :size="14" /></template>
          </Button>
        </Tooltip>
        <time
          v-if="sentAt && !isUser"
          class="flex h-6 shrink-0 items-center px-1 text-xs text-(--ant-color-text-tertiary)"
          :datetime="createdAt"
        >
          {{ sentAt }}
        </time>
      </div>
    </div>
  </article>
</template>
