// locales/useLocale.ts —— 组件里"读 / 切语言"用的组合式函数（composable）。
// 用法（任意组件的 <script setup> 里）：
//   import { useLocale } from "@/locales/useLocale";
//   const { getLocale, changeLocale } = useLocale();
//   getLocale.value              // 当前语言（响应式，切完自动更新）
//   await changeLocale("en-US"); // 切换语言
//
// 对照 vben：vben 的 useLocale 还会返回组件库语言包、语言选择开关，
// 并把语言存进 Pinia store。antdv-next 的 locale 在 AppProvider 里映射，
// 这里只保留"读"和"切"这两个最小能力

import { computed } from 'vue'
// Composer：组合式模式下 i18n.global 实例的类型（下面会用它做类型断言）
import type { Composer } from 'vue-i18n'
// i18n 实例由 setupI18n.ts 创建；这里 import 进来，保证拿到的是同一个实例
import { i18n } from './setupI18n'
import type { LocaleEntry, LocaleType } from './helper'
import { loadLocalePool, setHtmlPageLang } from './helper'

// 把"当前语言"真正落下去：改 i18n 实例 + 同步 <html lang>。
// 切换语言的最后一步都走它 —— 不管是"已加载直接切"还是"先 import 再切"
function setI18nLanguage(locale: LocaleType) {
  // i18n.global 的静态类型是"旧版实例 | 组合式实例"的联合类型
  // （vue-i18n 看 legacy 配置决定给哪种），而"用 .locale.value 读写语言"
  // 是组合式实例才有的能力。我们创建时传了 legacy: false，运行时一定是
  // 组合式实例，所以先断言成 Composer 再使用
  const globalI18n = i18n.global as Composer
  // 改当前语言：组合式模式下 locale 是个 ref，要写 .value。
  // 改完之后，所有用到 $t() / t() 的地方都会用新语言自动重渲染
  globalI18n.locale.value = locale
  // 顺手把 <html lang="..."> 也改掉
  setHtmlPageLang(locale)
}

export function useLocale() {
  // 当前语言（只读）。用 computed 包成响应式的：切完语言用到它的地方会自动更新
  const getLocale = computed<LocaleType>(() => {
    const globalI18n = i18n.global as Composer
    // i18n 内部的 locale 是宽泛的 string，断言回我们自己的 LocaleType。
    // 说明：这个 ref 是响应式的，所以外面包一层 computed 才能"跟着变"
    return globalI18n.locale.value as LocaleType
  })

  // 切换语言。设计成 async：第一次切到某语言时要去"动态加载"它的语言包
  async function changeLocale(locale: LocaleType) {
    // 已经在这个语言上了 -> 什么都不用做
    if (getLocale.value === locale) {
      return locale
    }

    // 这个语言包之前加载过（在登记表里）-> 只切换，不用再 import
    if (loadLocalePool.includes(locale)) {
      setI18nLanguage(locale)
      return locale
    }

    // 第一次切到这门语言：动态 import 它的入口文件。
    // 和 setupI18n.ts 启动时加载语言包是同一套路
    const langModule = (await import(`./lang/${locale}.ts`)).default as LocaleEntry | undefined
    // 防御：万一文件里没写默认导出，就放弃本次切换
    if (!langModule) return

    const globalI18n = i18n.global as Composer
    // 把新语言的文案注册进 i18n 实例（按语言代码存一份）
    globalI18n.setLocaleMessage(locale, langModule.message)
    // 登记：下次再切到它就走上面的"直接切"分支，不用重新 import
    loadLocalePool.push(locale)
    // 最后一步：写 locale 这个 ref + 同步 <html lang>
    setI18nLanguage(locale)

    return locale
  }

  return { getLocale, changeLocale }
}
