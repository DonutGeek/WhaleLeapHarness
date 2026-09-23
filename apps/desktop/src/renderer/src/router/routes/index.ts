import type { RouteRecordRaw } from 'vue-router'

// vben 约定：业务路由不直接写在这里，而是放到 modules/ 文件夹里，
// 一个文件（一个业务模块）default 导出自己那几条路由。
//
// import.meta.glob() 是 Vite 独有的语法：构建时把匹配到的文件一次性全部引入，
// 所以以后往 modules/ 里新增文件会自动生效，这里不需要改（eager: true = 同步引入）
const modules = import.meta.glob<{
  default?: RouteRecordRaw | RouteRecordRaw[]
}>('./modules/**/*.ts', { eager: true })

// 把每个模块导出的路由收集进列表（default 导出单个对象或数组都支持）
const routeModuleList: RouteRecordRaw[] = []

Object.keys(modules).forEach((key) => {
  const mod = modules[key].default
  // 没写 default 导出的文件直接跳过
  if (!mod) return
  const modList = Array.isArray(mod) ? [...mod] : [mod]
  routeModuleList.push(...modList)
})

// 对外的路由表：router/index.ts 从这里取 routes 交给 createRouter。
// 以后要加"根路由 / 兜底 404"这类固定路由（vben 的 basic.ts 那类），也在下面合并
export const routes: RouteRecordRaw[] = routeModuleList
