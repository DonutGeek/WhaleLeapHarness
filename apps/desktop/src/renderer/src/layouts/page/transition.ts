import type { FunctionalComponent } from 'vue'
import type { RouteLocation } from 'vue-router'

/**
 * 路由上下文：<RouterView> 的"作用域插槽"给我们的两样东西——
 * 要渲染的组件（Component）和当前路由信息（route）。
 * 见 layouts/page/index.vue 模板里的 `#default="{ Component, route }"`
 */
export interface DefaultContext {
  // vue-router 给的组件是个"函数式组件"，type 上是函数；
  // 后面的 Record<string, unknown> 是 vben 为了兼容各种写法加的宽松约束
  Component: FunctionalComponent & { type: Record<string, unknown> }
  route: RouteLocation
}

/**
 * 决定这次页面切换用哪个动画名（对应 vben v2 的 src/layouts/page/transition.ts）。
 *
 * 名字会被绑到 <transition :name="..."> 上，Vue 就会去找
 * design/transition/index.css 里 .fade-slide-enter-active 这类类名。
 *
 * 返回 undefined = 不加动画（<transition> 什么都不做）
 *
 * 参数说明：
 *   route            当前要切过去的路由
 *   enableTransition 动画总开关（settings 里 transitionSetting.enable）
 *   def              默认动画名（transitionSetting.basicTransition）
 */
export function getTransitionName({
  route,
  enableTransition,
  def
}: Pick<DefaultContext, 'route'> & {
  enableTransition: boolean
  def: string
}): string | undefined {
  // 总开关关了，直接不加动画
  if (!enableTransition) {
    return undefined
  }

  // 页面切换统一用 fade-slide（淡入 + 横向滑动），
  // 对应 vben 的 design/transition/fade.less 里的 .fade-slide-*
  const transitionName = 'fade-slide'
  // 优先级：本次算出来的名字 > 页面自己指定的 transitionName > 全局默认动画
  return transitionName || (route.meta.transitionName as string) || def
}
