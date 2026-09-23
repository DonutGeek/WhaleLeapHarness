// 中文（简体）语言包入口。
// 这个文件本身不写文案，只负责"收集 + 组装"：
//   1. import.meta.glob 把 lang/zh-CN/ 目录下所有 .json 文案文件收进来
//   2. genMessage 把"文件路径"翻译成"嵌套 key"
// 于是 lang/zh-CN/common.json 里的 { appName: "gito" }，
// 在组件里就写成 t("common.appName")。
// 每支持一种新语言，就仿照这个文件再建一个 en-US.ts
//
// 文案为什么用 .json 不用 .ts：
//   1. JSON 是 i18n 领域的事实标准格式，翻译平台/工具都直接认，
//      以后把文案交给别人翻译（或接自动翻译）不用转换格式
//   2. 纯数据文件里没有任何代码，是"能放心交给非开发者编辑"的文件
// 唯一的代价：JSON 语法不允许写注释，所以文案相关的说明
// 都收在这个入口文件和 ../helper.ts 的注释里
import type { MessageFile } from '../helper'
import { genMessage } from '../helper'

// import.meta.glob：Vite 提供的能力，按 glob 模式批量收集模块。
// "./zh-CN/**/*.json" 是相对"当前文件所在目录"（也就是 lang/）的路径；
// { eager: true } 表示同步读进来（不写的话每个文件会变成异步加载的 chunk）。
// JSON 文件被 Vite 加载后同样是个"模块对象"：文件里那个对象挂在它的
// default 导出上（genMessage 里读的 langs[key].default 就是它）
const modules = import.meta.glob<MessageFile>('./zh-CN/**/*.json', {
  eager: true
})

// 默认导出的结构固定为 { message: ... }，
// 和 setupI18n.ts 里 `defaultLocal.default?.message` 的读法对应。
// 第二个参数传目录名 "zh-CN"：genMessage 用它把路径前缀剪掉
export default {
  message: genMessage(modules, 'zh-CN')
}
