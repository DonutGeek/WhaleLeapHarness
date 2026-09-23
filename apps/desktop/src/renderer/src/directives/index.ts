import type { App } from 'vue'
// 代码语法高亮指令（实现和用法见 directives/highlight.ts）
import { vHighlight } from '@/directives/highlight'

// 全局自定义指令注册中心：app.directive(...) 调用统一放这里。
// 自定义指令用来直接操作 DOM（如 v-focus 自动聚焦、v-auth 权限控制），
// 写普通组件用不到它，但 admin 类项目基本都会预备这个入口。
export function setupGlobDirectives(app: App) {
  // v-highlight：代码语法高亮，用法示例：
  //   <pre v-highlight="'rust'"><code>fn main() {}</code></pre>
  app.directive('highlight', vHighlight)
  // 示例（需要时取消注释）：
  // app.directive("focus", {
  //   mounted(el: HTMLElement) {
  //     el.focus();
  //   },
  // });
}
