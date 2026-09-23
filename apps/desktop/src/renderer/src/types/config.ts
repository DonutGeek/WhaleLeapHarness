// 项目配置的类型定义（对应 vben 模板的 types/config.d.ts）。
// "配置"指的是布局层面的开关：页头显示什么、菜单多宽、页面切换用哪个动画……
// 这些配置的值放在 settings/projectSetting.ts，运行时由 store/modules/app.ts 里的 app store 管
import type { ContentEnum, RouterTransitionEnum, ThemeEnum } from '@/enums/appEnum'
import type { MenuModeEnum, MenuTypeEnum, TriggerEnum } from '@/enums/menuEnum'

/**
 * 递归地把 T 的所有属性变成可选。
 * 用途：改配置时只传想改的那一小块，比如 setProjectConfig({ headerSetting: { show: false } })，
 * 不用把整个 ProjectConfig 写全。
 * （vben 把它放在全局类型 global.d.ts 里，谁都能直接用；我们这里显式导出，用的时候 import）
 */
export type DeepPartial<T> = {
  [P in keyof T]?: DeepPartial<T[P]>
}

/** 页头（顶部栏）配置 */
export interface HeaderSetting {
  // 页头背景色
  bgColor: string
  // 是否固定在顶部（内容滚动时页头不动）
  fixed: boolean
  // 是否显示页头
  show: boolean
  // 页头主题（决定页头上的文字/图标用深色还是浅色）
  theme: ThemeEnum
  // 是否显示"全屏"按钮
  showFullScreen: boolean
  // 是否启用锁屏功能（锁屏按钮 + 锁屏页）
  useLockPage: boolean
  // 是否显示"文档"按钮（点开跳到项目文档）
  showDoc: boolean
  // 是否显示"通知/消息"按钮
  showNotice: boolean
  // 是否显示全局搜索
  showSearch: boolean
}

/** 侧边栏菜单配置 */
export interface MenuSetting {
  // 菜单背景色
  bgColor: string
  // 是否固定（内容滚动时菜单不动）
  fixed: boolean
  // 是否折叠成"只剩图标"的窄条
  collapsed: boolean
  // 响应式隐藏：窗口太窄时自动把侧边栏藏起来
  siderHidden: boolean
  // 折叠状态下是否显示菜单名（配合 collapsed 用）
  collapsedShowTitle: boolean
  // 是否允许拖拽调整菜单宽度
  canDrag: boolean
  // 是否显示菜单
  show: boolean
  // 是否把菜单整个藏起来（连占位都不留）
  hidden: boolean
  // 菜单宽度（像素）
  menuWidth: number
  // 展开方式（内联 / 竖向 / 横向）
  mode: MenuModeEnum
  // 菜单放置位置（侧边 / 顶部 / 混合）
  type: MenuTypeEnum
  // 菜单主题（深色或浅色背景）
  theme: ThemeEnum
  // 顶部菜单的对齐方式
  topMenuAlign: 'start' | 'center' | 'end'
  // 折叠按钮的位置
  trigger: TriggerEnum
  // 手风琴模式：展开一个子菜单时自动收起其它已展开的
  accordion: boolean
}

/** 页面切换动画配置 */
export interface TransitionSetting {
  // 总开关：是否启用页面切换动画
  enable: boolean
  // 默认动画名，取值对应 design/transition/index.css 里的类名
  basicTransition: RouterTransitionEnum
  // 切换页面时是否显示加载中
  openPageLoading: boolean
  // 是否显示顶部进度条（nprogress 那种）
  openNProgress: boolean
}

/** 项目配置总表 */
export interface ProjectConfig {
  // 是否显示右下角的"设置"按钮（打开设置抽屉）
  showSettingButton: boolean
  // 是否显示"切换主题"按钮
  showDarkModeToggle: boolean
  // 是否允许切换成"灰色模式"（悼念日整站变灰）
  grayMode: boolean
  // 是否允许切换成"色弱模式"
  colorWeak: boolean
  // 主题色（主色调，影响按钮、链接等强调色）
  themeColor: string
  // 是否显示 logo
  showLogo: boolean
  // 是否显示页脚
  showFooter: boolean
  // 是否进入"全屏内容"模式：菜单和页头全不显示，只留内容区
  fullContent: boolean
  // 内容区宽度模式（自适应 / 固定宽度）
  contentMode: ContentEnum
  // 是否显示面包屑
  showBreadCrumb: boolean
  // 面包屑前面是否带图标
  showBreadCrumbIcon: boolean
  // 是否显示"回到顶部"按钮
  useOpenBackTop: boolean
  // 是否允许 iframe 页面（嵌入外部网页的功能）
  canEmbedIFramePage: boolean
  // 切换页面时是否关掉还没关闭的提示弹窗
  closeMessageOnSwitch: boolean
  // 切换页面时是否取消还没返回的 http 请求
  removeAllHttpPending: boolean

  // 以下四块是分组配置，字段见上面各自的 interface
  headerSetting: HeaderSetting
  menuSetting: MenuSetting
  transitionSetting: TransitionSetting
}
