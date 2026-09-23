<script setup lang="ts">
import { motion } from 'motion-v'

withDefaults(
  defineProps<{
    sending?: boolean
    paused?: boolean
  }>(),
  { sending: false, paused: false }
)

/** 三点依次错开跳动 */
const delays = [0, 150, 300]
</script>

<template>
  <motion.div
    v-if="sending"
    class="inline-flex h-6 items-center gap-1.5 py-1"
    :initial="{ opacity: 0 }"
    :animate="{ opacity: 1 }"
  >
    <span
      v-for="delay in delays"
      :key="delay"
      class="size-1.5 animate-typing-dot rounded-full bg-(--ant-color-icon)"
      :style="{ animationDelay: `${delay}ms` }"
    />
  </motion.div>
  <p
    v-else-if="paused"
    class="m-0 text-(length:--ant-font-size) leading-(--ant-line-height) text-(--ant-color-text-secondary)"
  >
    已停止生成
  </p>
</template>
