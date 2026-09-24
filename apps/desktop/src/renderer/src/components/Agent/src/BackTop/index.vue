<script setup lang="ts">
import { Icon } from '@/components/Icon'

const emit = defineEmits<{
  click: []
}>()
</script>

<template>
  <!-- 挂在输入框上沿正中，离开底部时才出现，点了回到最新消息 -->
  <button
    class="absolute bottom-full left-1/2 z-30 mb-2 flex size-9 -translate-x-1/2 items-center justify-center rounded-full border border-(--ant-color-border) bg-(--ant-color-bg-container) text-(--ant-color-icon) shadow-[--ant-box-shadow-secondary] hover:bg-[linear-gradient(var(--ant-color-fill-tertiary),var(--ant-color-fill-tertiary))]"
    type="button"
    title="回到底部"
    @click="emit('click')"
  >
    <Icon icon="arrow-down" :size="16" />
  </button>
</template>
