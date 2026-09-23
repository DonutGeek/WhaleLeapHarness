<script setup lang="ts">
import { computed, ref } from 'vue'
import { Button, Tooltip } from 'antdv-next'
import { Icon } from '@/components/Icon'
import hljs from 'highlight.js/lib/common'

const props = withDefaults(defineProps<{ code: string; language?: string; showCopy?: boolean }>(), {
  language: 'plaintext',
  showCopy: true
})

const copied = ref(false)

const highlightedCode = computed(() => {
  const language = props.language.toLowerCase()
  return hljs.getLanguage(language)
    ? hljs.highlight(props.code, { language }).value
    : hljs.highlightAuto(props.code).value
})

async function copyCode() {
  await navigator.clipboard?.writeText(props.code)
  copied.value = true
  window.setTimeout(() => {
    copied.value = false
  }, 1200)
}
</script>

<template>
  <figure
    class="agent-code my-3 overflow-hidden rounded-(--ant-border-radius) border border-solid border-(--ant-color-border) bg-(--ant-color-fill-quaternary) first:mt-0.5 last:mb-0"
  >
    <header
      class="flex min-h-9 items-center justify-between gap-3 border-b border-solid border-(--ant-color-border-secondary) bg-(--ant-color-fill-secondary) pr-2 pl-3.5"
    >
      <span class="text-xs leading-none text-(--ant-color-text-secondary)">
        {{ language }}
      </span>
      <Tooltip
        v-if="showCopy"
        :title="copied ? '已复制' : '复制'"
        :open="copied ? true : undefined"
      >
        <Button type="text" size="small" aria-label="复制" @click="copyCode">
          <template #icon>
            <Icon v-if="copied" icon="check" :size="14" />
            <Icon v-else icon="copy" :size="14" />
          </template>
        </Button>
      </Tooltip>
    </header>
    <pre class="m-0 overflow-x-auto px-3.5 pt-3 pb-3.5"><code
      class="font-mono text-xs leading-relaxed whitespace-pre text-(--ant-color-text) [&_.hljs]:bg-transparent [&_.hljs]:p-0"
      v-html="highlightedCode"
    /></pre>
  </figure>
</template>

<style scoped>
@reference "../../../design/tailwind.css";

/* 语法色跟着 Ant Design 语义色走，亮色和暗色不用两套高亮主题 */
.agent-code :deep(.hljs-keyword),
.agent-code :deep(.hljs-selector-tag),
.agent-code :deep(.hljs-template-tag),
.agent-code :deep(.hljs-type),
.agent-code :deep(.hljs-built_in) {
  @apply text-(--ant-color-info);
}

.agent-code :deep(.hljs-string),
.agent-code :deep(.hljs-regexp),
.agent-code :deep(.hljs-addition) {
  @apply text-(--ant-color-success);
}

.agent-code :deep(.hljs-number),
.agent-code :deep(.hljs-literal),
.agent-code :deep(.hljs-attr),
.agent-code :deep(.hljs-attribute) {
  @apply text-(--ant-color-warning);
}

.agent-code :deep(.hljs-title),
.agent-code :deep(.hljs-title.class_),
.agent-code :deep(.hljs-section) {
  @apply text-(--ant-color-primary);
}

.agent-code :deep(.hljs-comment),
.agent-code :deep(.hljs-quote),
.agent-code :deep(.hljs-deletion) {
  @apply text-(--ant-color-text-tertiary);
}

.agent-code :deep(.hljs-variable),
.agent-code :deep(.hljs-template-variable),
.agent-code :deep(.hljs-params),
.agent-code :deep(.hljs-meta) {
  @apply text-(--ant-color-text);
}
</style>
