import type { RouteRecordName, RouteRecordNormalized } from 'vue-router'

import { computed, toRaw, unref } from 'vue'
import { useRouter } from 'vue-router'
import { uniqBy } from 'lodash-es'

/**
 * useFrameKeepAlive —— iframe 页面的"保活"逻辑（对应 vben v2 的同名文件）。
 *
 * 要解决的问题：普通 <iframe> 是写在某个页面组件里的，页面一切走、组件被销毁，
 * iframe 也就没了；切回来重新加载，网页里的状态（填了一半的表单、滚动位置）全丢。
 * 所以 vben 的套路是：把 iframe 从页面组件里"提"出来，统一由 FrameLayout 渲染，
 * 每个 iframe 页面用一个 <FramePage> 承载，靠 v-show 显示/隐藏（而不是销毁），
 * 这样切来切去 iframe 一直活着。
 *
 * 这个 hook 负责回答三个问题：
 *   getFramePages    项目里一共有哪些"iframe 页面"（路由 meta 里写了 frameSrc 的）
 *   hasRenderFrame   某个 iframe 页面现在该不该被渲染出来（不渲染 = 彻底不加载）
 *   showIframe       某个 iframe 页面现在是"显示"还是"藏着"（v-show 用）
 */
export function useFrameKeepAlive() {
  const router = useRouter()
  // currentRoute 是个 ref：它指向"当前路由对象"，并且会随跳转自动更新。
  // 注意这里解构出来的是 ref 本身（不是它的值），下面用 unref 取值
  const { currentRoute } = router
  /**
   * 项目里所有"内嵌 iframe 的页面"路由。
   * 数据来源是 router.getRoutes()：vue-router 里注册过的全部路由记录
   *（自己写进 routes/modules 的 + 以后动态添加的，都在这）
   */
  const getFramePages = computed(() => {
    // toRaw 是把响应式代理还原成原始对象：这里只是"读一下路由表"，
    // 不需要建立响应式依赖，也避免把路由对象存进状态里时带上代理
    // 类型上 router.getRoutes() 返回的就是"归一化后的路由记录"（RouteRecordNormalized），
    // 所以 gito 用 vue-router 自带的类型，不用像 vben 那样再断言成自定义的 AppRouteRecordRaw
    const ret = getAllFramePages(toRaw(router.getRoutes())) || []
    return ret
  })

  /**
   * 递归收集所有带 frameSrc 的路由。
   * 路由表可能是嵌套的（父路由 children 里才是真正的页面），所以要一路往下找
   */
  function getAllFramePages(routes: RouteRecordNormalized[]): RouteRecordNormalized[] {
    let res: RouteRecordNormalized[] = []
    for (const route of routes) {
      // 这行是 vben 原版的写法：一次解构出两样东西——
      //   frameSrc → meta 里配的"要嵌的网址"（有值 = 这是 iframe 页面）
      //   children → 子路由，下面继续往下递归
      // 注意末尾的 `= {}` 默认值不能省：children 里装的是"原始"路由记录，
      // 没写 meta 的路由在运行时 meta 就是 undefined，没有这个默认值会直接崩。
      //（类型上 meta 看着是必有的——又是"类型撑不住运行时"的一处）
      const { meta: { frameSrc } = {}, children } = route
      if (frameSrc) {
        res.push(route)
      }
      if (children && children.length) {
        // 说明：router.getRoutes() 返回的其实已经是"拍平"过的列表（各层路由都在里面），
        // 正常场景下这段递归不会重复收集；保留 vben 的递归写法是为了不依赖这个细节。
        // children 的类型是 RouteRecordRaw（"原始"路由记录，字段是归一化记录的子集），
        // 我们只读 name/meta/children，所以断言成同一种类型继续递归
        res.push(...getAllFramePages(children as unknown as RouteRecordNormalized[]))
      }
    }
    // 按 name 去重：同一个页面理论上可能被匹配到两次，重复渲染会导致 iframe 加载两遍
    res = uniqBy(res, 'name')
    return res
  }

  /** 这个 iframe 页面是不是"当前正在看"的那个（是就 v-show 显示，不是就藏着） */
  function showIframe(item: RouteRecordNormalized) {
    return item.name === unref(currentRoute).name
  }

  /**
   * 某个 iframe 页面要不要渲染成真实 DOM。
   * 返回 false 时模板里连 <FramePage> 都不会创建，iframe 自然也不会去加载那个网址
   */
  function hasRenderFrame(name: RouteRecordName) {
    return router.currentRoute.value.name === name
  }

  return { hasRenderFrame, getFramePages, showIframe, getAllFramePages }
}
