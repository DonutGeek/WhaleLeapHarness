<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { VirtualList } from '@/components/VirtualList'
import BackTop from '../BackTop/index.vue'
import Bubble from '../Bubble/index.vue'
import BubbleLoading from '../BubbleLoading/index.vue'
import Sender from '../Sender/index.vue'
import type { AgentMessage, AgentSource, AgentSuggestion } from '../types'

const props = withDefaults(
  defineProps<{
    messages?: AgentMessage[]
    sending?: boolean
    paused?: boolean
    showContext?: boolean
  }>(),
  {
    messages: () => [],
    sending: false,
    paused: false,
    showContext: true
  }
)

const emit = defineEmits<{
  send: [prompt: string]
  stop: []
  resume: []
  openSource: [source: AgentSource]
  chooseSuggestion: [suggestion: AgentSuggestion]
}>()

type StageItem =
  | { id: string; kind: 'message'; message: AgentMessage }
  | { id: string; kind: 'status' }

const listRef = ref<{ getScrollElement: () => HTMLElement | null } | null>(null)
const scrollTarget = ref<HTMLElement | null>(null)
const stickToBottom = ref(true)
let contentObserver: ResizeObserver | null = null
/** 滚轮、触摸后的一小段时间里，才根据位置决定要不要取消贴底 */
let userScrollUntil = 0
/** 正在拖滚动条。这段时间先让开，松手再回到最新一条 */
let pointerHolding = false

function markUserScroll() {
  userScrollUntil = performance.now() + 200
}

function onPointerDown(event: PointerEvent) {
  if (event.button !== 0) return
  const el = scrollElement()
  // 点在消息上不算拖滚动条，避免一点复制就把贴底取消
  if (!el || event.target !== el) return
  pointerHolding = true
}

function onPointerUp() {
  if (!pointerHolding) return
  pointerHolding = false
  stickToBottom.value = true
  scrollToBottom()
}

const stageItems = computed<StageItem[]>(() => {
  const items: StageItem[] = props.messages.map((message) => ({
    id: message.id,
    kind: 'message',
    message
  }))
  if (props.sending || props.paused) {
    items.push({ id: '__status__', kind: 'status' })
  }
  return items
})

function scrollElement() {
  return scrollTarget.value ?? listRef.value?.getScrollElement() ?? null
}

function isNearBottom(gap = 96) {
  const el = scrollElement()
  if (!el) return true
  return el.scrollHeight - el.scrollTop - el.clientHeight < gap
}

function onStageScroll() {
  if (pointerHolding || performance.now() > userScrollUntil) return
  stickToBottom.value = isNearBottom()
}

/** 滚到滚动高度底部。拖滚动条时跳过，避免和用户抢位置 */
function scrollToBottom() {
  if (pointerHolding) return
  const el = scrollElement()
  if (!el) return
  if (el.scrollHeight - el.scrollTop - el.clientHeight < 1) return
  el.scrollTo({ top: el.scrollHeight })
}

/** 回到最新消息，并重新贴底。先清掉滚动意图，避免这次滚动被当成用户上滑 */
function jumpToBottom() {
  userScrollUntil = 0
  stickToBottom.value = true
  scrollToBottom()
}

function watchContentSize() {
  const el = scrollElement()
  const content = el?.firstElementChild
  if (!el || !content) return
  contentObserver?.disconnect()
  el.removeEventListener('wheel', markUserScroll)
  el.removeEventListener('touchmove', markUserScroll)
  el.removeEventListener('pointerdown', onPointerDown)
  window.removeEventListener('pointerup', onPointerUp)
  window.removeEventListener('pointercancel', onPointerUp)
  contentObserver = new ResizeObserver(() => {
    if (stickToBottom.value) scrollToBottom()
  })
  contentObserver.observe(content)
  el.addEventListener('wheel', markUserScroll, { passive: true })
  el.addEventListener('touchmove', markUserScroll, { passive: true })
  el.addEventListener('pointerdown', onPointerDown)
  window.addEventListener('pointerup', onPointerUp)
  window.addEventListener('pointercancel', onPointerUp)
}

onMounted(async () => {
  await nextTick()
  scrollTarget.value = listRef.value?.getScrollElement() ?? null
  watchContentSize()
  scrollToBottom()
})

onUnmounted(() => {
  contentObserver?.disconnect()
  const el = scrollElement()
  el?.removeEventListener('wheel', markUserScroll)
  el?.removeEventListener('touchmove', markUserScroll)
  el?.removeEventListener('pointerdown', onPointerDown)
  window.removeEventListener('pointerup', onPointerUp)
  window.removeEventListener('pointercancel', onPointerUp)
})

watch(
  () => [props.messages.length, props.sending, props.paused] as const,
  async () => {
    await nextTick()
    if (stickToBottom.value) scrollToBottom()
  }
)
</script>

<template>
  <!-- 命名容器给消息列的 @md 内边距用，宽度按对话区而不是窗口算 -->
  <section class="@container/conversation flex h-full min-h-0 flex-1 flex-col overflow-hidden">
    <VirtualList
      ref="listRef"
      :items="stageItems"
      list-class="mx-auto w-full max-w-3xl"
      @scroll="onStageScroll"
    >
      <template #empty>
        <slot name="empty" />
      </template>
      <template #item="{ item, index }">
        <div
          :class="
            index === 0 ? 'px-4 pt-6 pb-4 @md/conversation:px-6' : 'px-4 pb-4 @md/conversation:px-6'
          "
        >
          <Bubble
            v-if="item.kind === 'message'"
            :role="item.message.role"
            :content="item.message.content"
            :created-at="item.message.createdAt"
            :pending="item.message.pending"
            :attachments="item.message.attachments"
          />
          <BubbleLoading v-else :sending="sending" :paused="paused" />
        </div>
      </template>
      <template #footer>
        <div class="sticky bottom-0 z-20 w-full shrink-0">
          <div class="relative mx-auto w-full max-w-3xl px-4">
            <BackTop v-if="stageItems.length && !stickToBottom" @click="jumpToBottom" />
            <Sender
              :sending="sending"
              :paused="paused"
              :show-context="showContext"
              @send="emit('send', $event)"
              @stop="emit('stop')"
              @resume="emit('resume')"
            />
          </div>
        </div>
      </template>
    </VirtualList>
  </section>
</template>
