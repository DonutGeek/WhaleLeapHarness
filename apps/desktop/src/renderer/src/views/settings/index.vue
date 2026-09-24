<script setup lang="ts">
import { ref } from 'vue'
import { Button } from 'antdv-next'
import { Icon } from '@/components/Icon'
import { useMenuSetting } from '@/hooks/setting/useMenuSetting'
import ModelFormModal, { type ModelFormModalExpose } from './components/ModelFormModal.vue'

const { getSiderHidden } = useMenuSetting()
const modelFormRef = ref<ModelFormModalExpose | null>(null)

function openAddModel() {
  modelFormRef.value?.open()
}
</script>

<template>
  <div class="flex h-full min-h-0 flex-col overflow-hidden">
    <!-- 和会话页同一条顶栏，设置页没有标题，只留出高度和拖拽区域 -->
    <header
      data-window-drag-region
      class="h-14 shrink-0 transition-[margin] duration-200 ease-out"
      :class="getSiderHidden ? 'ml-52' : 'ml-4'"
    />

    <div class="flex min-h-0 flex-1 flex-col overflow-y-auto px-8 py-6">
      <div class="flex items-start justify-between gap-4">
        <div class="min-w-0 flex-1">
          <h1 class="m-0 text-xl font-semibold text-(--ant-color-text)">模型</h1>
          <p class="mt-1 mb-0 text-sm text-(--ant-color-text-secondary)">
            使用自有 API Key 管理自定义模型。
          </p>
        </div>
        <Button type="primary" @click="openAddModel">
          <template #icon><Icon icon="plus" :size="16" /></template>
          添加模型
        </Button>
      </div>

      <ModelFormModal ref="modelFormRef" />

      <div
        class="mt-6 flex min-h-80 flex-col items-center justify-center rounded-(--ant-border-radius-lg) border border-dashed border-(--ant-color-border) px-6 py-16"
      >
        <span
          class="flex size-12 items-center justify-center rounded-(--ant-border-radius) border border-solid border-(--ant-color-border) bg-(--ant-color-fill-quaternary) text-(--ant-color-text-secondary)"
        >
          <Icon icon="settings" :size="20" />
        </span>
        <p class="mt-4 mb-0 text-sm text-(--ant-color-text)">
          暂无自定义模型，点击添加模型开始使用
        </p>
      </div>
    </div>
  </div>
</template>
