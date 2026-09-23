<script setup lang="ts">
import { Icon } from '@/components/Icon'

withDefaults(defineProps<{ title?: string }>(), {
  title: '当前任务目标'
})

const progress = [
  '分析任务范围与相关模块',
  '读取并确认现有实现',
  '完成第一轮改动',
  '验证构建与交互流程'
]
</script>

<template>
  <aside
    class="m-4 hidden w-80 shrink-0 rounded-(--ant-border-radius-lg) border border-(--ant-color-border) bg-(--ant-color-bg-container) p-4 xl:block"
  >
    <section>
      <h2 class="m-0 text-lg font-semibold text-(--ant-color-text)">Git 工具</h2>
      <div class="mt-5 space-y-4 text-sm text-(--ant-color-text-secondary)">
        <div class="flex items-center gap-3">
          <Icon icon="file" :size="18" /><span>变更</span
          ><span class="ml-auto text-(--ant-color-success)">+0</span
          ><span class="text-(--ant-color-error)">-0</span>
        </div>
        <div class="flex items-center gap-3">
          <Icon icon="git-branch" :size="18" /><span>main</span
          ><Icon icon="ellipsis" :size="18" class="ml-auto" />
        </div>
        <div class="flex items-center gap-3">
          <Icon icon="circle-dashed" :size="18" /><span>提交</span
          ><Icon icon="ellipsis" :size="18" class="ml-auto" />
        </div>
      </div>
    </section>

    <section class="mt-6 border-t border-(--ant-color-border) pt-5">
      <div class="flex items-center justify-between">
        <h2 class="m-0 text-base font-semibold text-(--ant-color-text)">目标</h2>
        <span class="text-sm text-(--ant-color-text-secondary)">进行中</span>
      </div>
      <p class="mt-4 mb-2 text-sm leading-relaxed text-(--ant-color-text)">{{ title }}</p>
      <p class="m-0 text-xs text-(--ant-color-text-secondary)">1/4 · 本地 Agent</p>
    </section>

    <section class="mt-6 border-t border-(--ant-color-border) pt-5">
      <h2 class="m-0 text-base font-semibold text-(--ant-color-text)">进度</h2>
      <ul class="mt-4 space-y-4 p-0">
        <li
          v-for="item in progress"
          :key="item"
          class="flex items-start gap-3 text-sm leading-relaxed text-(--ant-color-text-secondary)"
        >
          <Icon
            icon="circle-check"
            :size="18"
            class="mt-0.5 shrink-0 text-(--ant-color-success)"
          /><span class="line-through">{{ item }}</span>
        </li>
      </ul>
    </section>
  </aside>
</template>
