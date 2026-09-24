<script setup lang="ts">
import { Icon } from '@/components/Icon'
import {
  Badge,
  Collapse,
  CollapsePanel,
  Descriptions,
  DescriptionsItem,
  Timeline,
  TimelineItem,
  Typography
} from 'antdv-next'
import type { AgentThoughtStep } from '../types'

defineProps<{ steps: AgentThoughtStep[] }>()

function timelineColor(status: AgentThoughtStep['status']) {
  if (status === 'completed') return 'green'
  if (status === 'failed') return 'red'
  if (status === 'running') return 'blue'
  return 'gray'
}
</script>

<template>
  <Collapse class="max-w-3xl bg-(--ant-color-fill-quaternary)">
    <CollapsePanel key="execution">
      <template #header>
        <div class="flex items-center gap-2">
          <Badge dot status="processing" />
          <span>智能体执行记录</span>
          <span class="text-(--ant-color-text-secondary)">{{ steps.length }} 个步骤</span>
        </div>
      </template>
      <Timeline>
        <TimelineItem v-for="step in steps" :key="step.id" :color="timelineColor(step.status)">
          <div class="flex items-start gap-2">
            <Icon v-if="step.status === 'completed'" icon="circle-check" :size="16" />
            <Icon v-else-if="step.status === 'failed'" icon="circle-x" :size="16" />
            <Icon v-else-if="step.status === 'running'" icon="loader-circle" :size="16" spin />
            <Icon v-else icon="circle-dashed" :size="16" />
            <div>
              <strong>{{ step.title }}</strong>
              <Typography.Text v-if="step.detail" class="mb-0!" type="secondary" component="p">
                {{ step.detail }}
              </Typography.Text>
            </div>
          </div>
        </TimelineItem>
      </Timeline>
      <Collapse class="mt-2">
        <CollapsePanel key="read" header="读取文件">
          <Descriptions :column="1" size="small">
            <DescriptionsItem label="输入">
              <code>src/components/Sidebar.vue</code>
            </DescriptionsItem>
            <DescriptionsItem label="结果">文件读取成功</DescriptionsItem>
          </Descriptions>
        </CollapsePanel>
        <CollapsePanel key="command" header="运行命令">
          <Descriptions :column="1" size="small">
            <DescriptionsItem label="输入">
              <code>pnpm dev</code>
            </DescriptionsItem>
            <DescriptionsItem label="结果">开发服务器已启动</DescriptionsItem>
          </Descriptions>
        </CollapsePanel>
      </Collapse>
    </CollapsePanel>
  </Collapse>
</template>
