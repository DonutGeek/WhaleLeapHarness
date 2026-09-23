import type { App } from 'vue'
// Pinia：Vue 官方推荐的状态管理库（类比 React 的 Redux/Zustand，但 API 更简洁）
import { createPinia } from 'pinia'
// 持久化插件放在 plugin/ 文件夹里（vben 约定：一个插件一个文件），这里只负责调用
import { registerPiniaPersistPlugin } from '@/store/plugin/persist'

// 创建 Pinia 实例。放在模块顶层创建一次，之后所有组件里
// useXxxStore() 拿到的都是这同一个实例。
// 导出名 store（不叫 pinia）是 vben 的命名习惯
export const store = createPinia()

// 创建完立刻装持久化插件（vben v2 也是这个位置）。
// 时序上没问题：模块顶层代码在 import 时就执行，早于 main.ts 里的 setupStore(app)，
// 所以肯定发生在 app.use(store) 之前，插件能对所有 store 生效
registerPiniaPersistPlugin(store)

// setup 函数：把状态管理注册进 Vue 应用。
// vben 风格的特点：每个模块导出一个 setup*(app)，注册逻辑收在模块自己里面，
// main.ts 的 bootstrap 只负责按顺序调度
export function setupStore(app: App) {
  app.use(store)
}
