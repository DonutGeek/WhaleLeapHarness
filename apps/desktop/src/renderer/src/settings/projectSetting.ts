import { ContentEnum, RouterTransitionEnum, ThemeEnum } from '@/enums/appEnum'
import { MenuModeEnum, MenuTypeEnum, TriggerEnum } from '@/enums/menuEnum'
import type { ProjectConfig } from '@/types/config'

// 项目默认配置（对应 vben v2 的 settings/projectSetting.ts）。
// 这里列出的每个开关的含义见 types/config.ts 里的注释。
// 运行时用户改配置走 app store（store/modules/app.ts）的 setProjectConfig，
// 改完由持久化插件存盘，不会写回这个文件——这个文件始终保持"出厂设置"。
const setting: ProjectConfig = {
  // 是否显示"设置"按钮（右下角齿轮，打开配置抽屉）
  showSettingButton: true,
  // 是否显示"主题切换"按钮（亮色/暗色）
  showDarkModeToggle: true,
  // 灰色模式：整站变灰（一般是悼念日临时打开，默认关）
  grayMode: false,
  // 色弱模式：增强颜色对比（默认关）
  colorWeak: false,
  // 主题色：antdv-next 默认主色（token.colorPrimary）
  themeColor: '#1677ff',

  // 是否显示 logo
  showLogo: true,
  // 是否显示页脚
  showFooter: false,
  // 是否进入"全屏内容"模式（把菜单和页头都隐藏，只留内容）
  fullContent: false,
  // 内容区宽度模式：FULL = 自适应铺满
  contentMode: ContentEnum.FULL,
  // 是否显示面包屑
  showBreadCrumb: true,
  // 面包屑前面是否带图标
  showBreadCrumbIcon: false,
  // 是否显示"回到顶部"按钮
  useOpenBackTop: true,
  // 是否允许嵌入 iframe 页面
  canEmbedIFramePage: true,
  // 切换页面时自动关掉还没关的提示弹窗
  closeMessageOnSwitch: true,
  // 切换页面时取消还没返回的 http 请求（避免慢请求回来时页面已经切走了）
  removeAllHttpPending: true,

  // ---- 页头（顶部栏）----
  headerSetting: {
    // 页头背景色：白色
    bgColor: '#ffffff',
    // 固定在顶部
    fixed: true,
    // 显示页头
    show: true,
    // 页头主题用亮色（白底配深色文字）
    theme: ThemeEnum.LIGHT,
    // 显示"全屏"按钮
    showFullScreen: true,
    // 锁屏功能（用密码锁住当前界面）
    useLockPage: true,
    // 显示"文档"按钮（点开跳转到项目文档）
    showDoc: true,
    // 显示"通知"按钮
    showNotice: true,
    // 显示全局搜索
    showSearch: true
  },

  // ---- 侧边栏菜单 ----
  menuSetting: {
    // 菜单背景色：vben 招牌的深蓝
    bgColor: '#001529',
    // 固定（内容滚动时菜单不动）
    fixed: true,
    // 不折叠（初始是完整宽度）
    collapsed: false,
    // 窗口太窄时是否自动隐藏侧边栏
    siderHidden: false,
    // 折叠时是否还显示菜单名
    collapsedShowTitle: false,
    // 允许拖拽调整菜单宽度
    canDrag: true,
    // 显示菜单
    show: true,
    // 整个隐藏菜单（连占位都不留）
    hidden: false,
    // 菜单宽度：对齐侧栏展开宽度（Tailwind w-60）
    menuWidth: 240,
    // 内联展开（子菜单在侧边栏里原地展开，不浮出来）
    mode: MenuModeEnum.INLINE,
    // 用"侧边栏"形态（另一种是顶部/混合）
    type: MenuTypeEnum.SIDEBAR,
    // 菜单主题用深色（深蓝底配浅色文字）
    theme: ThemeEnum.DARK,
    // 顶部菜单对齐方式（只有菜单在顶部时才看得出效果）
    topMenuAlign: 'start',
    // 触发折叠的按钮位置
    trigger: TriggerEnum.NONE,
    // 手风琴模式：展开一个子菜单时自动收起其它
    accordion: true
  },

  // ---- 页面切换动画 ----
  transitionSetting: {
    // 总开关：启用切换动画
    enable: true,
    // 默认用淡入淡出（对应 design/transition/index.css 的 .fade-*）
    basicTransition: RouterTransitionEnum.FADE,
    // 切换页面时显示加载中
    openPageLoading: true,
    // 顶部进度条（nprogress）：还没装这个库，先关着，装了再打开
    openNProgress: false
  }
}

export default setting
