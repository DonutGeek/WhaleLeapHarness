<script setup lang="ts">
import { Icon } from '@/components/Icon'
import { Card, Tooltip } from 'antdv-next'
import CodeHighlighter from '../CodeHighlighter/index.vue'

defineProps<{ code: string; title?: string }>()
</script>

<template>
  <Card size="small" class="agent-mermaid" :title="title || 'Mermaid 图表'">
    <template #extra>
      <Tooltip title="尚未接入 Mermaid 渲染运行时，当前安全展示图表源码">
        <span class="inline-flex">
          <Icon icon="info" :size="16" />
        </span>
      </Tooltip>
    </template>
    <CodeHighlighter :code="code" language="mermaid" />
  </Card>
</template>
