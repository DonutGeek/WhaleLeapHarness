import type { App } from 'vue'
import { createRouter, createWebHashHistory } from 'vue-router'
// 路由表：集中定义在 routes/ 目录里（vben 结构），这里只负责消费
import { routes } from '@/router/routes'

// 创建路由实例。放在模块顶层创建（而不是 setupRouter 函数里），
// 是因为 router/guard/ 和 main.ts 都要直接引用这个实例。
// 用 hash 模式（createWebHashHistory）：桌面应用没有 web 服务器，
// 路由以 # 开头变化，直接打开文件也能正常工作
export const router = createRouter({
  history: createWebHashHistory(),
  routes
})

// setup 函数：把路由注册进 Vue 应用。
// vben 风格的特点：每个模块导出一个 setup*(app)，注册逻辑收在模块自己里面，
// main.ts 的 bootstrap 只负责按顺序调度
export function setupRouter(app: App) {
  app.use(router)
}
