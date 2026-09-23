<script setup lang="ts">
import { Icon } from '@/components/Icon'
import { Button } from 'antdv-next'
import type { AgentSource } from './types'

defineProps<{ sources: AgentSource[] }>()
const emit = defineEmits<{ open: [source: AgentSource] }>()
function sourceIcon(kind: AgentSource['kind']) {
  return kind === 'url' ? 'link' : kind === 'file' ? 'paperclip' : 'file-text'
}
</script>

<template>
  <section v-if="sources.length">
    <h4 class="mb-2 mt-0">引用来源</h4>
    <Button
      v-for="item in sources"
      :key="item.id"
      class="cursor-pointer items-start gap-2"
      block
      type="text"
      @click="emit('open', item)"
    >
      <Icon :icon="sourceIcon(item.kind)" :size="16" />
      <span>
        <strong>{{ item.title }}</strong>
        <p v-if="item.description" class="mt-0.5 mb-0 text-xs text-(--ant-color-text-secondary)">
          {{ item.description }}
        </p>
      </span>
    </Button>
  </section>
</template>
