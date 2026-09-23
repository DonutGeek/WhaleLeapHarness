// 路由守卫中心：所有"页面跳转前后要执行的逻辑"统一在这里注册，
// 比如登录校验、根据路由动态修改窗口标题、进度条开关等。
// guard 做成目录（vben 结构）：守卫多了以后可以拆成多个文件
// （如 title-guard.ts、progress-guard.ts），由这个 index.ts 逐个调用
import type { Router } from 'vue-router'

// 参数带下划线是因为方法体现在是空的（tsconfig 开了 noUnusedParameters，
// 未使用的参数不加 _ 会报错）；开始写守卫后把下划线去掉即可
export function setupRouterGuard(_router: Router) {
  // 示例（需要时取消注释、按业务改写）：
  // _router.beforeEach((to) => {
  //   document.title = `${to.meta.title ?? "gito"}`;
  // });
}
