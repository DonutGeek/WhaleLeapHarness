// v-highlight 指令：给绑定的元素做代码语法高亮。
// 用法（写在 pre 或 code 上都可以）：
//   <pre v-highlight><code>const a = 1;</code></pre>          ← 自动猜测语言
//   <pre v-highlight="'rust'"><code>fn main() {}</code></pre>  ← 明确指定语言
import type { Directive } from 'vue'
// highlight.js 的"核心版"：本体很小，语言包按需注册。
// 全量版（import hljs from "highlight.js"）会把 190 种语言全打进产物，桌面应用也没必要
import hljs from 'highlight.js/lib/core'
// 按需注册常用语言（Git 工作台里最常见的几种；以后要加语言就按同样的格式加一行）
import typescript from 'highlight.js/lib/languages/typescript'
import javascript from 'highlight.js/lib/languages/javascript'
import json from 'highlight.js/lib/languages/json'
import rust from 'highlight.js/lib/languages/rust'
import xml from 'highlight.js/lib/languages/xml' // xml 高亮同样覆盖 .vue 的模板部分
import css from 'highlight.js/lib/languages/css'
import shell from 'highlight.js/lib/languages/shell'

hljs.registerLanguage('typescript', typescript)
hljs.registerLanguage('javascript', javascript)
hljs.registerLanguage('json', json)
hljs.registerLanguage('rust', rust)
hljs.registerLanguage('xml', xml)
hljs.registerLanguage('css', css)
hljs.registerLanguage('shell', shell)

// Directive<绑定的元素类型, 指令参数类型>：v-highlight="'rust'" 时 binding.value === "rust"
export const vHighlight: Directive<HTMLElement, string | undefined> = {
  // mounted：元素第一次插入页面时调用——做初次高亮
  mounted(el, binding) {
    highlight(el, binding.value)
  },
  // updated：所在组件每次更新后调用——代码内容变了就重新高亮
  updated(el, binding) {
    highlight(el, binding.value)
  }
}

function highlight(el: HTMLElement, language?: string) {
  // textContent 拿到元素里的纯文本代码（上次高亮产生的 <span> 不会算进去，只有文字）
  const code = el.textContent ?? ''
  // 指定语言就按语言解析；没指定就让 hljs 自动猜测
  const result = language ? hljs.highlight(code, { language }) : hljs.highlightAuto(code)
  // result.value 是高亮后的 HTML 字符串，里面的 < > & 都已被转义，直接赋给 innerHTML 是安全的
  el.innerHTML = result.value
}
