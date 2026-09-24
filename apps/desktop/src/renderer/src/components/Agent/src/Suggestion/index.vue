<script setup lang="ts">
import { Icon } from '@/components/Icon'
import { Button } from 'antdv-next'
import type { AgentSuggestion } from '../types'

defineProps<{ suggestions: AgentSuggestion[] }>()
const emit = defineEmits<{ choose: [suggestion: AgentSuggestion] }>()
</script>

<template>
  <div v-if="suggestions.length" class="flex flex-wrap gap-2">
    <Button
      v-for="suggestion in suggestions"
      :key="suggestion.id"
      class="inline-flex items-center"
      size="small"
      @click="emit('choose', suggestion)"
    >
      <Icon icon="sparkles" :size="14" />{{ suggestion.label }}
    </Button>
  </div>
</template>
