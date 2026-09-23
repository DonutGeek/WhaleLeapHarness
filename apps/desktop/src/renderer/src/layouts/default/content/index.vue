<script setup lang="ts">
import Page from '@/layouts/page/index.vue'
import { useMenuSetting } from '@/hooks/setting/useMenuSetting'

const { getSiderHidden } = useMenuSetting()
</script>

<template>
  <!-- 右侧主区域是一张卡片：上、右、下留缝，四角圆角，缺口露出侧栏同色底。侧栏收起后左边也留同样的缝 -->
  <div
    class="flex h-full min-h-0 min-w-0 flex-1 flex-col pt-1 pr-1 pb-1 transition-[padding] duration-200 ease-out"
    :class="getSiderHidden ? 'pl-1' : ''"
  >
    <div
      class="flex min-h-0 flex-1 flex-col overflow-hidden rounded-(--ant-border-radius-lg) border border-(--ant-color-border) bg-(--ant-color-bg-container)"
    >
      <Page />
    </div>
  </div>
</template>
