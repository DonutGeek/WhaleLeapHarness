<script setup lang="ts">
import { computed, ref } from 'vue'
import { Button, Splitter, SplitterPanel, Tooltip } from 'antdv-next'
import { Agent } from '@/components/Agent'
import { Heatmap } from '@/components/Heatmap'
import { Icon } from '@/components/Icon'
import SidePanel, { type SidePanelExpose } from './components/SidePanel.vue'
import TerminalPanel, { type TerminalPanelExpose } from './components/TerminalPanel.vue'
import { useMenuSetting } from '@/hooks/setting/useMenuSetting'
import { useAgentStore } from '@/store/modules/agent'

const agent = useAgentStore()
const { getSiderHidden } = useMenuSetting()
const terminalRef = ref<TerminalPanelExpose | null>(null)
const sidePanelRef = ref<SidePanelExpose | null>(null)
/** 终端面板高度，交给 Splitter 控制 */
const terminalPanelSize = ref(240)
/** 右侧栏宽度，交给 Splitter 控制 */
const sidePanelSize = ref(320)

function onTerminalResize(sizes: number[]) {
  const next = sizes?.[1]
  if (typeof next !== 'number' || !Number.isFinite(next)) return
  // 受控高度必须在拖动过程中写回，否则 Splitter 会把面板弹回原位
  terminalPanelSize.value = Math.round(Math.min(640, Math.max(180, next)))
}

function onSidePanelResize(sizes: number[]) {
  const next = sizes[1]
  if (next >= 280) sidePanelSize.value = next
}
const agentTitle = computed(() =>
  agent.activeTitle === '未命名任务' || agent.activeTitle === '新任务'
    ? '开始在 gito 项目中创建任务'
    : agent.activeTitle
)

const welcomeHeatmapData = Array.from({ length: 365 }, (_, index) => {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  date.setDate(date.getDate() - (364 - index))
  return {
    timestamp: date.getTime(),
    value: (index * 7 + (index % 3) * 11) % 45
  }
})
</script>

<template>
  <main class="relative flex h-full min-w-0 flex-col overflow-hidden">
    <!-- 终端和侧边栏属于右侧栏，固定在窗口右上角 -->
    <div class="no-drag absolute top-0 right-2.5 z-30 -mt-1 flex h-12 items-center gap-2">
      <Tooltip v-if="!sidePanelRef?.visible" title="任务清单">
        <Button size="small">
          <template #icon><Icon icon="list-checks" :size="16" /></template>
        </Button>
      </Tooltip>
      <Tooltip title="终端面板">
        <Button
          size="small"
          :type="terminalRef?.visible ? 'primary' : 'default'"
          @click="terminalRef?.toggle()"
        >
          <template #icon><Icon icon="panel-bottom" :size="16" /></template>
        </Button>
      </Tooltip>
      <Tooltip :title="sidePanelRef?.visible ? '关闭侧边栏' : '打开侧边栏'">
        <Button
          size="small"
          :type="sidePanelRef?.visible ? 'primary' : 'default'"
          @click="sidePanelRef?.toggle()"
        >
          <template #icon><Icon icon="panel-right" :size="16" /></template>
        </Button>
      </Tooltip>
    </div>

    <Splitter
      orientation="vertical"
      class="terminal-split min-h-0 flex-1"
      :class="terminalRef?.visible ? '' : '[&>.ant-splitter-bar]:hidden'"
      @resize="onTerminalResize"
    >
      <SplitterPanel class="min-h-0" :min="160">
        <Splitter
          class="h-full min-h-0"
          :class="sidePanelRef?.visible ? '' : '[&>.ant-splitter-bar]:hidden'"
          @resize="onSidePanelResize"
        >
          <SplitterPanel class="min-h-0 min-w-0" :min="280">
            <div class="flex h-full min-w-0 flex-col overflow-hidden">
              <header
                data-window-drag-region
                class="flex h-12 shrink-0 items-center gap-2 -mt-1 transition-[margin,padding] duration-200 ease-out"
                :class="[
                  getSiderHidden ? 'ml-52' : 'ml-4',
                  sidePanelRef?.visible ? 'pr-4' : 'mr-32'
                ]"
              >
                <Icon icon="folder" :size="16" class="shrink-0 text-(--ant-color-text-secondary)" />
                <h1 class="min-w-0 max-w-120 truncate text-sm font-medium text-(--ant-color-text)">
                  {{ agentTitle }}
                </h1>
                <Tooltip title="更多操作">
                  <Button size="small">
                    <template #icon><Icon icon="ellipsis" :size="16" /></template>
                  </Button>
                </Tooltip>
                <span v-if="sidePanelRef?.visible" class="ml-auto inline-flex">
                  <Tooltip title="任务清单">
                    <Button size="small">
                      <template #icon><Icon icon="list-checks" :size="16" /></template>
                    </Button>
                  </Tooltip>
                </span>
              </header>

              <section class="min-h-0 flex-1 overflow-hidden">
                <Agent
                  :messages="agent.messages"
                  :sending="agent.sending"
                  :paused="agent.paused"
                  :show-context="false"
                  @send="agent.sendPrompt"
                  @stop="agent.stopPrompt"
                  @resume="agent.resumePrompt"
                  @choose-suggestion="agent.chooseSuggestion"
                >
                  <template #empty>
                    <div class="flex w-full max-w-7xl flex-col items-center px-6 text-center">
                      <img class="h-16 w-16" src="/vite.svg" alt="Vite" />
                      <h2 class="mt-4 text-xl font-semibold text-(--ant-color-text)">gito</h2>
                      <p class="mt-1 text-sm text-(--ant-color-text-secondary)">
                        从一个想法开始，让 Agent 帮你完成项目任务
                      </p>
                      <Heatmap
                        class="mt-8 w-full text-left [&_.heatmap\_\_content]:flex [&_.heatmap\_\_content]:justify-center"
                        :data="welcomeHeatmapData"
                        :first-day-of-week="1"
                        :fill-calendar-leading="true"
                        :show-color-indicator="false"
                        :show-week-labels="false"
                        :x-gap="1"
                        :y-gap="1"
                        size="large"
                      />
                    </div>
                  </template>
                </Agent>
              </section>
            </div>
          </SplitterPanel>
          <SplitterPanel
            class="min-h-0 overflow-hidden"
            :size="sidePanelRef?.visible ? sidePanelSize : 0"
            :min="sidePanelRef?.visible ? 280 : 0"
            :max="520"
            :resizable="!!sidePanelRef?.visible"
          >
            <SidePanel ref="sidePanelRef" />
          </SplitterPanel>
        </Splitter>
      </SplitterPanel>
      <SplitterPanel
        class="min-h-0"
        :size="terminalRef?.visible ? terminalPanelSize : 0"
        :min="terminalRef?.visible ? 180 : 0"
        :max="640"
        :resizable="!!terminalRef?.visible"
      >
        <TerminalPanel ref="terminalRef" />
      </SplitterPanel>
    </Splitter>
  </main>
</template>

<style>
/* 分割条不占高度，避免在输入框和终端之间留出一条缝；热区叠在接缝两侧 */
.terminal-split.ant-splitter-vertical > .ant-splitter-panel {
  position: relative;
  z-index: 0;
}

.terminal-split.ant-splitter-vertical > .ant-splitter-bar {
  z-index: 30;
  height: 0 !important;
  overflow: visible;
  cursor: row-resize;
  -webkit-app-region: no-drag;
  app-region: no-drag;
}

.terminal-split.ant-splitter-vertical > .ant-splitter-bar > .ant-splitter-bar-dragger {
  top: -4px !important;
  left: 0 !important;
  width: 100% !important;
  height: 8px !important;
  transform: none !important;
  -webkit-app-region: no-drag;
  app-region: no-drag;
}
</style>
