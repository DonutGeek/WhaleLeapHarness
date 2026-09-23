import type { RouteLocationRaw, Router } from 'vue-router'
import { useRouter } from 'vue-router'
import { PageEnum } from '@/enums/pageEnum'

/**
 * 页面跳转相关的小 hook（对应 vben v2 的 src/hooks/web/usePage.ts）。
 *
 * 为什么要有它：router.push('/xxx') 返回的是 Promise，跳转失败（比如被守卫拦下、
 * 地址不合法）会变成一个"未处理的 Promise 拒绝"，控制台一片红。
 * useGo 把 catch 统一处理掉，代码里就不用每次都写 .catch()。
 *
 * vben 还有两个小工具在这个文件里用到：
 *   isHttpUrl（判断是不是外部链接）+ openWindow（用系统浏览器打开）
 * 我们先不搬——目前所有跳转都是应用内页面，等真的需要"点链接开外部网页"时再加
 */

/** 跳转目标的类型：可以是路径字符串、{path}、{name} 等 vue-router 支持的各种写法 */
export type RouteLocationRawEx = RouteLocationRaw

/** 统一的失败处理：跳转失败只打日志，不让它冒成未捕获异常 */
function handleError(e: Error) {
  console.error(e)
}

/**
/**
 * 返回一个 go() 函数，用法：
 *   const go = useGo();
 *   go('/settings');                // 普通跳转
 *   go('/settings', true);          // 替换当前历史记录
 *
 * 参数 _router 可以不传：不传就用组件上下文里的 router（useRouter()）；
 * 但 store、路由守卫这些"不在组件里"的地方拿不到上下文，就必须显式把 router 传进来
 */
export function useGo(_router?: Router) {
  const { push, replace } = _router || useRouter()

  // 函数重载：只写一个实现，但对外暴露三种调用签名（有参数 / 布尔 / 枚举），
  // 这样调用方传什么都类型安全，实现里再统一解析
  function go(opt?: RouteLocationRawEx): void
  function go(opt: RouteLocationRawEx, isReplace: boolean): void
  function go(opt: RouteLocationRawEx = PageEnum.BASE_HOME, isReplace = false) {
    if (!opt) {
      return
    }
    if (isReplace) {
      replace(opt).catch(handleError)
    } else {
      push(opt).catch(handleError)
    }
  }
  return go
}
