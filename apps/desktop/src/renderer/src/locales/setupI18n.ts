import type { App } from 'vue'
// vue-i18n：Vue 生态里最常用的多语言库，提供 $t() 和 useI18n()。
// I18n 是"i18n 实例"的类型；I18nOptions 是 createI18n() 的配置对象类型
import type { I18n, I18nOptions } from 'vue-i18n'
import { createI18n } from 'vue-i18n'
// 语言配置 + 工具函数，都在同目录的 helper.ts 里
import type { LocaleType } from './helper'
import { loadLocalePool, localeSetting, setHtmlPageLang } from './helper'

// 准备"创建 i18n 实例"要用的配置。
// 为什么是 async：语言包用"动态 import"加载 —— 运行时才去请求
// lang/zh-CN.ts 对应的代码块，而不是把它打进主包。
// 效果：支持的语言再多，主包体积也不涨（每种语言是一个独立的小文件）
async function createI18nOptions(): Promise<I18nOptions> {
  // 当前语言。vben 里是从 Pinia 的 locale store 读（设置页可改、可持久化）；
  // 我们还没做语言设置，先用 helper.ts 里的默认值
  const locale: LocaleType = localeSetting.defaultLocale

  // 关键一行：动态 import 语言包。
  // Vite 打包时会"读懂"这个模板字符串，把 ./lang/ 下每种语言
  // 都处理成一个可被按需加载的 chunk；运行时 locale 是 "zh-CN"，
  // 这里就等价于 import("./lang/zh-CN.ts")
  const defaultLocal = await import(`./lang/${locale}.ts`)
  // 入口文件的形状是 { message: {...} }，把 message 取出来。
  // ?. 和 ?? 是兜底写法：万一取不到就退回空对象，避免启动直接崩
  const message = defaultLocal.default?.message ?? {}

  // 同步 <html lang="zh-CN"> 属性
  setHtmlPageLang(locale)
  // 登记：这个语言包已经加载过了（之后切换语言时不用重复加载）
  loadLocalePool.push(locale)

  return {
    // legacy: false = 组合式 API 模式（配合 <script setup> 里的 useI18n()）。
    // 旧教程里的 legacy: true 是 Options API 模式，vue-i18n v12 会移除它，别再用了
    legacy: false,
    // 当前语言
    locale,
    // 兜底语言：当前语言缺某个 key 时，回头到它里面找
    fallbackLocale: localeSetting.fallbackLocale,
    // 启动时注册的文案：只放"当前语言"这一份。
    // 其它语言等真正切过去时再注册（见 useLocale.ts 的 changeLocale）
    messages: {
      [locale]: message
    },
    // 告诉 vue-i18n 总共有哪些语言（以后做语言切换器直接遍历它）
    availableLocales: localeSetting.availableLocales,
    // 缺翻译时不打控制台警告，保持控制台干净；
    // 想排查"这里为什么没翻译"，把这两个临时改成 true 就能看到警告
    missingWarn: false,
    fallbackWarn: false
  }
}

// i18n 实例。用 let 而不是 const：它要在 setupI18n() 里异步创建完才有值。
// 导出它，是为了 useLocale.ts 等模块能拿到"同一个"实例。
// 注意：不要在模块顶层直接读 i18n.global —— 那时它还没被赋值，是 undefined
export let i18n: I18n

// main.ts 里是 `await setupI18n(app)`：等语言包加载完、i18n 注册好才 mount 应用。
// 所以第一个页面渲染时翻译一定已经就绪，不会出现"先闪一下 key 再变成文案"
export async function setupI18n(app: App) {
  // 先异步准备配置（内部会加载当前语言的语言包）
  const options = await createI18nOptions()
  // createI18n 根据配置创建实例；断言成 I18n 类型，方便别处统一使用
  i18n = createI18n(options) as I18n
  // 注册进 Vue 应用：之后组件模板里能用 $t()，<script setup> 里能用 useI18n()
  app.use(i18n)
}
