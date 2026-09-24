<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Button, Splitter, SplitterPanel } from 'antdv-next'
import { Icon } from '@/components/Icon'
import { useMenuSetting } from '@/hooks/setting/useMenuSetting'
import Sider from '@/layouts/default/sider/index.vue'
import Content from '@/layouts/default/content/index.vue'

/** 再窄会压住左上角那排按钮，再宽会把对话区挤没 */
const SIDER_MIN = 220
const SIDER_MAX = 480

const { getMenuWidth, getSiderHidden, setMenuWidth, toggleSiderHidden } = useMenuSetting()
const openWidth = ref(getMenuWidth.value)
/** 拖拽时关掉宽度过渡，松手后的收起/展开才动画 */
const resizing = ref(false)

watch(getMenuWidth, (width) => {
  if (!resizing.value) openWidth.value = width
})

const siderSize = computed(() => (getSiderHidden.value ? 0 : openWidth.value))

function onSiderResize(sizes: number[]) {
  const next = sizes?.[0]
  if (typeof next !== 'number' || !Number.isFinite(next) || next < SIDER_MIN) return
  openWidth.value = Math.round(Math.min(SIDER_MAX, next))
}

function onSiderResizeStart() {
  resizing.value = true
}

function onSiderResizeEnd(sizes: number[]) {
  onSiderResize(sizes)
  resizing.value = false
  if (!getSiderHidden.value) setMenuWidth(openWidth.value)
}
</script>

<template>
  <div class="relative flex h-full min-h-0">
    <!-- 相对窗口定位，侧栏宽度变化时这三个按钮停在原地 -->
    <div class="no-drag absolute top-0 left-2.5 z-30 flex h-12 items-center gap-2 pl-22 pt-1">
      <Button size="small" @click="toggleSiderHidden">
        <template #icon><Icon icon="panel-left" :size="16" /></template>
      </Button>
      <Button size="small">
        <template #icon><Icon icon="arrow-left" :size="16" /></template>
      </Button>
      <Button size="small">
        <template #icon><Icon icon="arrow-right" :size="16" /></template>
      </Button>
    </div>
    <Splitter
      class="sider-split h-full min-h-0 min-w-0 flex-1"
      :class="[getSiderHidden ? '[&>.ant-splitter-bar]:hidden' : '', resizing ? 'is-resizing' : '']"
      @resize="onSiderResize"
      @resizeStart="onSiderResizeStart"
      @resizeEnd="onSiderResizeEnd"
    >
      <SplitterPanel
        class="overflow-hidden!"
        :size="siderSize"
        :min="getSiderHidden ? 0 : SIDER_MIN"
        :max="SIDER_MAX"
        :resizable="!getSiderHidden"
      >
        <!-- 内层保持展开宽度，收起时由外层裁切，菜单不会被挤扁 -->
        <div class="h-full" :style="{ width: `${openWidth}px` }">
          <Sider />
        </div>
      </SplitterPanel>
      <SplitterPanel class="min-w-0 overflow-hidden!">
        <Content />
      </SplitterPanel>
    </Splitter>
  </div>
</template>

<style>
/* 拖动时跟着指针走；收起和展开再过渡宽度 */
.sider-split:not(.is-resizing) > .ant-splitter-panel {
  transition: flex-basis 200ms ease-out;
}
</style>
