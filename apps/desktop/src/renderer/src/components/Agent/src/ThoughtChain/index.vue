<script setup lang="ts">
import { computed } from 'vue'
import { Timeline, TimelineItem } from 'antdv-next'
import type { AgentThoughtStep } from '../types'

const props = defineProps<{ steps: AgentThoughtStep[] }>()
const timelineColor = computed(
  () => (status: AgentThoughtStep['status']) =>
    (
      ({
        completed: 'green',
        running: 'blue',
        failed: 'red',
        pending: 'gray'
      }) as const
    )[status]
)
</script>

<template>
  <Timeline>
    <TimelineItem v-for="step in props.steps" :key="step.id" :color="timelineColor(step.status)">
      <strong>{{ step.title }}</strong>
      <p v-if="step.detail" class="mt-1 mb-0 text-(--ant-color-text-secondary)">
        {{ step.detail }}
      </p>
    </TimelineItem>
  </Timeline>
</template>
