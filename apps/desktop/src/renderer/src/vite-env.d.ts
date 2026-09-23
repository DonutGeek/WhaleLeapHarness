/// <reference types="vite/client" />
// 上面这行让 TS 认识 Vite 注入的能力：import.meta.env、import.meta.hot 等。
// 注意：旧教程会在这里再写一段 declare module "*.vue"，现在不要写——
// .vue 文件的类型由 Volar / vue-tsc 直接解析，不需要手动声明；
// 手写那个声明的后果是所有 .vue 组件的 props 都被当成 any，类型检查形同虚设

// 给 import.meta.env 上我们自己加的变量补类型（Vite 官方推荐就写在这个文件里）。
// 不写也能跑——vite/client 里留了索引签名，读出来是 any——但 any 意味着写错变量名
// 也不会报错，所以要在这里逐个声明清楚。
// 变量实际的值在根目录的 .env / .env.development / .env.production / .env.test 里
interface ImportMetaEnv {
  /** 应用标题，index.html 的 <title> 用的就是它 */
  readonly VITE_GLOB_APP_TITLE: string
  /** 接口前缀，src/api/request.ts 里 axios 实例的 baseURL */
  readonly VITE_GLOB_API_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
