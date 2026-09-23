<script setup lang="ts" generic="T">
import { ref } from 'vue'
import { Virtualizer } from 'virtua/vue'

defineProps<{
  items: T[]
  /** 虚拟列本身的布局类。宽度约束放这里，滚动容器保持全宽 */
  listClass?: string
}>()

const emit = defineEmits<{
  scroll: [event: Event]
}>()

const scrollRef = ref<HTMLElement | null>(null)

function onScroll(event: Event) {
  emit('scroll', event)
}

function getScrollElement() {
  return scrollRef.value
}

defineExpose({ getScrollElement })
</script>

<template>
  <!-- 滚动槽留在这一层，页脚（输入框）和消息共用同一条滚动条，左右才不会错开 -->
  <div
    ref="scrollRef"
    class="min-h-0 flex-1 overflow-x-hidden overflow-y-auto [scrollbar-gutter:stable]"
    @scroll="onScroll"
  >
    <div class="flex min-h-full flex-col">
      <div v-if="!items.length" class="flex min-h-0 flex-1 items-center justify-center">
        <slot name="empty" />
      </div>
      <div v-else :class="listClass">
        <!-- 滚动容器挂上之后再挂虚拟列表，这时 scrollRef 才是真实元素 -->
        <Virtualizer v-if="scrollRef" :data="items" :scroll-ref="scrollRef">
          <template #default="slotProps">
            <slot name="item" v-bind="slotProps" />
          </template>
        </Virtualizer>
      </div>
      <!-- 消息少的时候把页脚推到底；消息多了这一层不再占高度 -->
      <div v-if="items.length" class="min-h-0 flex-1" />
      <slot name="footer" />
    </div>
  </div>
</template>
