// 全局组件注册中心。
// 这里只保留项目内部、确实需要全局可用的组件；第三方组件与图标都必须由使用它们的
// feature / 页面按需导入，避免将整包组件库或图标注册到应用实例。
import type { App } from 'vue'

export function registerGlobComp(_app: App) {}
