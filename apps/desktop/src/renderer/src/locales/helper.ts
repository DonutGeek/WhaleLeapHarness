// locales/helper.ts —— i18n 的"工具 + 配置"文件，放三类东西：
//   1. 类型与配置：LocaleType、localeSetting（支持哪些语言、默认用哪种）
//   2. loadLocalePool：记录"哪些语言包已经加载过"
//   3. 两个工具函数：setHtmlPageLang（同步 <html lang>）、
//      genMessage（把一堆零散的文案文件合并成一棵"消息树"）
//
// vben v2 里这些内容分散在 /@/settings/localeSetting.ts（配置）、
// /#/config（类型）几个地方；我们还没有 settings / # 模块，先都收在这个文件里，
// 等以后相应模块落地了再搬（搬的时候只改 import，逻辑不动）

// lodash-es 的 set：按"路径"给对象写值，比如 set(obj, "menu.file", x)
// 会自动把中间层 menu 建出来再赋值。es 后缀是 ES Module 版本，
// 打包时只打进真正用到的函数（tree-shaking）
import { set } from 'lodash-es'

// ---------- 1. 类型与配置 ----------

// 支持的语言代码。写成"字面量联合类型"而不是 string 的好处：
// 别处把 "en-Us" 这种拼错的值传进来，TS 在编译期就会报错。
// 取值要和 lang/ 目录下的文件名一一对应（zh-CN.ts / en-US.ts）
export type LocaleType = 'zh-CN' | 'en-US'

// "消息树"：合并后的文案对象，一层套一层。
// 值要么是最终文案（string），要么是下一层对象 —— 这是个递归类型
export interface MessageTree {
  [key: string]: string | MessageTree
}

// 单个文案文件（如 lang/zh-CN/common.json）作为"模块"的形状：
// 模块对象上挂着它的默认导出（JSON 被 Vite 加载后也是模块，
// 文件里那个对象就是它的 default）。default 后面的 ? 表示"可能取不到"
// （import.meta.glob 收集来的模块，类型层面按可选处理）
export interface MessageFile {
  default?: MessageTree
}

// 语言包"入口文件"（lang/zh-CN.ts）默认导出的形状。
// 固定包一层 message，是为了以后还能加别的字段（比如 dayjs 的语言代码）
// 而不改变 setupI18n.ts 里 defaultLocal.default?.message 的读法
export interface LocaleEntry {
  message: MessageTree
}

// 语言相关的默认配置。vben 把它叫 localeSetting，放在 settings 模块里。
// 说明：值后面的 `as LocaleType` 是类型断言 —— 不加的话 TS 会把 "zh-CN"
// 推断成宽泛的 string，加上才固定成我们定义的 LocaleType
export const localeSetting = {
  // 应用启动时使用的语言
  defaultLocale: 'zh-CN' as LocaleType,
  // 兜底语言：当前语言里找不到某个 key 时，回头到这个语言里找
  fallbackLocale: 'zh-CN' as LocaleType,
  // 应用支持的所有语言
  availableLocales: ['zh-CN', 'en-US'] as LocaleType[]
}

// ---------- 2. 已加载语言包的登记表 ----------

// 记录哪些语言的语言包已经加载进内存。用途：切换语言时，
// 目标语言"加载过"就直接切，没加载过才去动态 import（见 useLocale.ts）。
// 用数组存是跟着 vben 的写法；语言数量很少，查找性能无所谓
export const loadLocalePool: LocaleType[] = []

// ---------- 3. 工具函数 ----------

// 把当前语言同步到 <html lang="zh-CN"> 属性上。
// 浏览器、读屏软件、翻译插件都读这个属性，所以切语言要顺手改它。
// ?. 是可选链：querySelector("html") 理论上可能返回 null，是 null 就跳过不报错
export function setHtmlPageLang(locale: LocaleType) {
  document.querySelector('html')?.setAttribute('lang', locale)
}

// 把 import.meta.glob 收集到的"一堆文案文件"合并成一棵消息树。
// 输入 langs 形如（key 是文件路径）：
//   { "./zh-CN/common.json": { default: {...} }, ... }
// 输出形如（第一层 key 来自文件名/目录名）：
//   { common: {...} }
// 规矩：路径里第一段当"一级 key"（模块名），剩下的段当嵌套 key。
// 以后加了子目录也能用，比如 lang/zh-CN/menu/header.json 会合并成
// { menu: { header: {...} } }，组件里写 t("menu.header.title")
export function genMessage(langs: Record<string, MessageFile>, prefix = 'lang'): MessageTree {
  // 合并结果，类型就是上面定义的递归"消息树"
  const obj: MessageTree = {}

  // 遍历每个文案文件
  Object.keys(langs).forEach((key) => {
    // 文件里 export default 出来的那个对象
    const langFileModule = langs[key]?.default
    // 把路径洗成"纯名字"：以 "./zh-CN/common.json" 为例
    //   第一步 去掉 "./zh-CN/"（前缀就是参数 prefix）-> "common.json"
    //   第二步 去掉开头的 "./"（兜底：防止路径不是以 prefix 开头）-> 不变
    let fileName = key.replace(`./${prefix}/`, '').replace(/^\.\//, '')
    // 去掉扩展名：从最后一个 "." 处截断 -> "common"
    //（不管扩展名是 .ts 还是 .json，这一步都通吃）
    const lastIndex = fileName.lastIndexOf('.')
    fileName = fileName.substring(0, lastIndex)
    // 按 "/" 切开：单层文件得到 ["common"]；子目录文件得到 ["menu", "header"]
    const keyList = fileName.split('/')
    // shift() 取出并移除第一段，作为一级 key（模块名）
    const moduleName = keyList.shift()
    // 剩下的段用 "." 连起来作为模块内部的路径；单层文件剩空数组，join 出 ""
    const objKey = keyList.join('.')

    if (moduleName) {
      if (objKey) {
        // 子目录文件：把一级 key 对应的对象取出来（没有就新建一个空的），
        // 再把这份文案挂到内部的路径上
        const module = (obj[moduleName] ?? {}) as MessageTree
        obj[moduleName] = module
        set(module, objKey, langFileModule || {})
      } else {
        // 单层文件：直接把文案挂到一级 key 上
        set(obj, moduleName, langFileModule || {})
      }
    }
  })

  return obj
}
