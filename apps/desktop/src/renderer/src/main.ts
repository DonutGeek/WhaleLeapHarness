import { createApp } from 'vue'
import App from './App.vue'

// 设计层样式总入口：design/ 目录放"设计层"资源（样式入口、主题变量、字体等），
// index.css 里按顺序 @import 了 tailwind / theme / public / antdv / transition 五部分，
// 所以 main.ts 只需要引这一个文件
import '@/design/index.css'
// JetBrains Mono 等宽字体（Fontsource 官方包，字体文件打进本地产物，
// 桌面应用离线也能用——不依赖 Google Fonts 这类在线服务）。
// 默认只含 400 字重；需要其他字重按下面注释的格式加
import '@fontsource/jetbrains-mono'
// import "@fontsource/jetbrains-mono/500.css";
// import "@fontsource/jetbrains-mono/700.css";
import { registerGlobComp } from '@/components/registerGlobComp'
import { setupGlobDirectives } from '@/directives'
import { setupI18n } from '@/locales/setupI18n'
import { router, setupRouter } from '@/router'
import { setupRouterGuard } from '@/router/guard'
import { setupStore } from '@/store'

// bootstrap：应用启动的唯一入口。
// vben 风格的三个特点：
//   1. 每个模块（状态、路由、守卫、指令、i18n…）导出一个 setup*(app) 函数，
//      注册逻辑收在各自模块里，main.ts 不堆细节
//   2. main.ts 只做调度，启动顺序一眼看清
//   3. 包成 async 函数，是为了能用 await 做异步初始化（下面的 setupI18n 就是）
async function bootstrap() {
  const app = createApp(App)

  // 注册 Pinia 状态管理（含本地持久化插件）
  setupStore(app)
  // 注册项目自己的全局组件；第三方组件与图标由页面按需导入
  registerGlobComp(app)
  // 注册多语言。语言包用动态 import 异步加载（src/locales/lang/ 下每种语言一个文件），
  // 所以要 await：加载完再注册，页面渲染时翻译已经就绪
  await setupI18n(app)
  // 注册路由：地址栏（hash）匹配到的页面会显示在 <router-view /> 里
  setupRouter(app)
  // 注册路由守卫：页面跳转前后的统一逻辑（登录校验、改标题等）以后写在这里
  setupRouterGuard(router)
  // 注册全局自定义指令（v-focus、v-auth 这类直接操作 DOM 的指令）
  setupGlobDirectives(app)
  app.mount('#app')
}

// 顶层 await：等 bootstrap() 里所有初始化完成后才真正渲染页面
// （顶层 await 是 ES2022 特性，tsconfig 的 target 已相应升到 ES2022）
await bootstrap()
