<template>
  <!--
    FrameLayout：iframe 页面的"容器层"（对应 vben v2 的 src/layouts/iframe/index.vue）。
    在整体布局里的位置：它是 PageLayout 的"兄弟组件"，和 RouterView 平级：
      PageLayout
        ├── RouterView      → 渲染普通页面
        └── FrameLayout     → 渲染所有 iframe 页面（本组件）

    为什么要单独拎出来：普通 <router-view> 切页面时会把旧组件销毁，
    页面里的 <iframe> 跟着一起没了；而 iframe 里往往是个完整的第三方网页，
    重新加载又慢、状态又丢。所以 iframe 页面不进 <router-view>，
    而是全部在这里渲染，用 v-show（而不是 v-if）控制显示/隐藏，让它们一直活着
  -->
  <div v-if="showFrame">
    <!--
      v-for 遍历"项目里所有 iframe 页面"。
      注意这里 v-for 和 v-if 是"兄弟"写法（v-if 在外层 template 上），
      所以每次有路由变化时，这一串 iframe 会整体重新计算，不会漏掉新开的页面
    -->
    <template v-for="frame in getFramePages" :key="frame.path">
      <!--
        三层判断，各管一件事：
        1. frame.meta.frameSrc —— 这条路由确实配了要嵌的网址
        2. hasRenderFrame(frame.name) —— 它现在"该不该被渲染"（没打开就不渲染，省内存）
        3. v-show="showIframe(frame)" —— 已经渲染的里面，只有当前页显示，其它都藏着
      -->
      <FramePage
        v-if="frame.meta.frameSrc && hasRenderFrame(frame.name)"
        v-show="showIframe(frame)"
        :frameSrc="frame.meta.frameSrc"
      />
    </template>
  </div>
</template>
<script lang="ts" setup>
import { computed, unref } from 'vue'

// iframe 页面的"壳"：里面就一个 <iframe>，负责加载网址、显示加载动画
import FramePage from '@/views/sys/iframe/index.vue'

import { useFrameKeepAlive } from './useFrameKeepAlive'

// 组件名（DevTools 里显示的就是它）
defineOptions({ name: 'FrameLayout' })

// 从 hook 里拿三个判断方法 + 一份"所有 iframe 页面"的列表，具体逻辑见 useFrameKeepAlive.ts
const { getFramePages, hasRenderFrame, showIframe } = useFrameKeepAlive()

// 一个 iframe 页面都没有时（比如项目里没配 frameSrc），整个容器都不渲染。
// unref 是因为 getFramePages 是 computed，取值要 unref 一下
const showFrame = computed(() => unref(getFramePages).length > 0)
</script>
