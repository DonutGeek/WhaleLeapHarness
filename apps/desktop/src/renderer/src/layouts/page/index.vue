<template>
  <!--
    PageLayout：真正装"页面"的那层壳（对应 vben v2 的 src/layouts/page/index.vue）。
    在整体布局里的位置：DefaultLayout（页头/侧边栏）
      └── PageLayout（本组件：只负责内容区 + 切换动画 + iframe）
            └── 具体页面（如 home/index.vue）

    <RouterView> 配"作用域插槽"是 vue-router 的用法：
    普通 <router-view /> 只负责把匹配到的组件渲染出来；
    写成 <RouterView v-slot="{ Component, route }"> 就能拿到"要渲染的组件"和"当前路由"两个值，
    这样才能自己包 <transition>（动画）和 <keep-alive>（缓存）
  -->
  <div class="flex h-full min-h-0 w-full flex-col" :class="contentFixed ? 'mx-auto max-w-6xl' : ''">
    <RouterView>
      <template #default="{ Component, route }">
        <!--
        transition：Vue 内置组件，负责"换页时旧页面淡出、新页面淡入"。
        name 决定用哪套 CSS 类名（见 design/transition/index.css）；
        mode="out-in" = 等旧页面动画播完再进场新页面（不加会出现两个页面重叠）；
        appear = 首次渲染也播一次动画
      -->
        <transition
          :name="
            getTransitionName({
              route,
              enableTransition: getEnableTransition,
              def: getBasicTransition
            })
          "
          mode="out-in"
          appear
        >
          <component :is="Component" :key="route.fullPath" class="h-full min-h-0" />
        </transition>
      </template>
    </RouterView>

    <!--
    iframe 页面容器：只有配置里允许内嵌 iframe 时才渲染。
    它的作用是让"嵌入外部网页"的页面在切走之后也留在内存里（普通 <iframe> 切走会重载，
    网页里的状态就丢了）。详情见 layouts/iframe/index.vue
  -->
    <FrameLayout v-if="getCanEmbedIFramePage" />
  </div>
</template>

<script lang="ts" setup>
import FrameLayout from '@/layouts/iframe/index.vue'

import { computed } from 'vue'
import { ContentEnum } from '@/enums/appEnum'
import { useRootSetting } from '@/hooks/setting/useRootSetting'
import { useTransitionSetting } from '@/hooks/setting/useTransitionSetting'
import { getTransitionName } from './transition'

defineOptions({ name: 'PageLayout' })

// 是否允许内嵌 iframe（决定下面要不要渲染 FrameLayout）
const { getCanEmbedIFramePage, getLayoutContentMode } = useRootSetting()
/** 固定宽度时内容居中收窄，自适应时铺满卡片 */
const contentFixed = computed(() => getLayoutContentMode.value === ContentEnum.FIXED)

// 动画配置：默认动画名 + 动画总开关
const { getBasicTransition, getEnableTransition } = useTransitionSetting()
</script>
