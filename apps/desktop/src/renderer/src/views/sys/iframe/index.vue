<template>
  <!--
    FramePage：单个 iframe 的"壳"（对应 vben v2 的 src/views/sys/iframe/index.vue）。
    用它在 FrameLayout 里承载每一个内嵌网页：
      - 外层 div + Spin 的像素高度，由脚本按窗口大小算出来（calcHeight）
      - Spin 负责"网页还在加载"时转圈，默认插槽里就是那个 <iframe>
  -->
  <div
    class="h-full [&_.ant-spin]:box-border [&_.ant-spin]:size-full [&_.ant-spin-container]:box-border [&_.ant-spin-container]:size-full"
    :style="getWrapStyle"
  >
    <Spin :spinning="loading" size="large" :style="getWrapStyle">
      <!--
        iframe 是浏览器原生的内嵌网页容器：src 指向要嵌进来的网址。
        @load：网页加载完成时触发 → 关掉转圈动画，并重新算一次高度
        ref：脚本里要用它拿到这个 DOM 元素（改高度、给子页面发消息）
      -->
      <iframe
        :src="frameSrc"
        class="box-border block size-full overflow-hidden border-0 bg-(--ant-color-bg-container)"
        ref="frameRef"
        @load="hideLoading"
      ></iframe>
    </Spin>
  </div>
</template>
<script lang="ts" setup>
import type { CSSProperties } from 'vue'
import { computed, onMounted, onUnmounted, ref, unref, watch } from 'vue'
import { Spin } from 'antdv-next'
import { useDebounceFn, useWindowSize } from '@vueuse/core'

/*
  和 vben 原版的差异（都是因为 gito 还没有对应模块，做等价替换）：
  1. propTypes（@/utils/propTypes）→ withDefaults + 类型化 defineProps，效果一样还更简单
  2. useDesign('iframe-page') → 布局直接写 Tailwind 工具类
  3. useLayoutHeight().headerHeightRef（布局层算出来的页头高度）→ 先用固定值 50，
     等 DefaultLayout 把高度算出来，换成读它的值即可
  4. useWindowSizeFn（@vben/hooks）→ @vueuse/core 的 useWindowSize + useDebounceFn
  5. <style lang="less"> → Tailwind 工具类（gito 不装 less）
  6. vben 里那段没用上的 &__mask（全屏遮罩）样式没有照搬
*/
const emit = defineEmits(['message'])

// frameSrc：要嵌入的网页地址。可不传（默认空字符串），传空时 iframe 什么都不加载
withDefaults(defineProps<{ frameSrc?: string }>(), { frameSrc: '' })

// 是否显示"加载中"的转圈动画。先当成"正在加载"，iframe 触发 load 后关掉
const loading = ref(true)
// 页头占掉的高度（iframe 不能盖住它，要往下让出这么多像素）。
// vben 是从布局层动态取的，gito 先用 50px 顶上
const topRef = ref(50)
// iframe 容器的高度（像素），窗口一变就重新算
const heightRef = ref(window.innerHeight)
// iframe 的 DOM 元素引用：Vue 模板里写 ref="frameRef"，这里就能拿到真实 DOM
const frameRef = ref<HTMLIFrameElement>()

// 窗口高度（响应式的）：窗口大小变化时它会自动更新，好让我们跟着重算 iframe 高度
const { height: windowHeight } = useWindowSize()

// 外面套的 div 和 Spin 都用同一个高度样式
const getWrapStyle = computed((): CSSProperties => {
  return {
    height: `${unref(heightRef)}px`
  }
})

/**
 * 重新计算 iframe 的高度。
 * 容器的像素高度 = 窗口高度 - 页头高度；
 * 另外再直接给 <iframe> 元素写一个行内高度 —— 因为 iframe 在 Spin 的插槽里，
 * 靠 CSS 百分比撑高度不一定生效，写死像素最稳
 */
function calcHeight() {
  const iframe = unref(frameRef)
  // 组件刚创建、DOM 还没挂载时拿不到 iframe，直接返回（等挂载/加载后还会再调）
  if (!iframe) {
    return
  }
  const top = unref(topRef)
  heightRef.value = window.innerHeight - top
  const clientHeight = document.documentElement.clientHeight - top
  iframe.style.height = `${clientHeight}px`
}

// 窗口大小变化时重算高度。用防抖包一层：拖动窗口会疯狂触发 resize，
// 150ms 内只执行最后一次，免得一直重排页面
const recalcHeight = useDebounceFn(calcHeight, 150)
watch(windowHeight, recalcHeight, { immediate: true })

/** iframe 里的网页加载完成：关掉转圈，然后按真实位置重算一次高度 */
function hideLoading() {
  loading.value = false
  calcHeight()
}

// 子页面（iframe 里的网页）用 window.parent.postMessage 发消息过来时，转发成组件的 message 事件
const messageHandler = (e: MessageEvent) => {
  emit('message', e.data)
}

/**
 * 给 iframe 里的子页面发消息。
 * targetOrigin 指定"哪些源能收到"（安全考虑，别一律用 '*'）；
 * transfer 是可转移对象（比如 ArrayBuffer），传了就是零拷贝转移所有权
 */
const postMessage = (message: unknown, targetOrigin: string, transfer?: Transferable[]) => {
  const iframe = unref(frameRef)
  if (!iframe) return
  iframe.contentWindow?.postMessage(message, targetOrigin, transfer)
}

/** 重新加载 iframe 里的网页。 */
const reload = () => {
  loading.value = true
  const iframe = frameRef.value
  if (!iframe) return
  iframe.contentWindow?.location.reload()
  loading.value = false
}

onMounted(() => {
  // 监听子页面发来的消息（消息可能来自任何 iframe，具体是谁进来由业务自己判断）
  window.addEventListener('message', messageHandler)
})

onUnmounted(() => {
  // 组件销毁时把监听摘掉，否则监听会越积越多（内存泄漏）
  window.removeEventListener('message', messageHandler)
})

// 把这两个方法暴露出去：父组件拿到 <FramePage> 的 ref 后可以调 framePageRef.postMessage(...)
defineExpose({ postMessage, reload })
</script>
