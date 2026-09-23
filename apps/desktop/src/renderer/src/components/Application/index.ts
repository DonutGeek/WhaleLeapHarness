// Application 组件包：放"应用级"基础组件（vben 约定，例如 AppLogo、AppProvider、AppDarkModeToggle 等）。
//
// 目录约定（vben 风格）：
//   src/      真正的 .vue 组件源码都放在这个子目录里
//   index.ts  "桶文件"（barrel file）：只负责把 src/ 里的组件转发出去，
//             外部就可以统一写成 import { AppLogo } from "@/components/Application"，
//             不用关心 src/ 内部的具体路径；以后组件多了还能在 index.ts 里挑哪些对外暴露
//
// 对外导出 src/ 里的组件（default 导出用 as 重命名成组件名）
export { default as AppProvider } from './src/AppProvider.vue'
