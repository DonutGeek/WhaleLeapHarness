import { computed } from 'vue'
import { useAppStore } from '@/store/modules/app'
import { ContentEnum } from '@/enums/appEnum'

/**
 * 读"根配置"（ProjectConfig 里除分组配置之外的那些字段）。
 * 对应 vben v2 的 src/hooks/setting/useRootSetting.ts。
 *
 * 这一层是干什么的：组件里当然可以直接写 appStore.getProjectConfig.canEmbedIFramePage，
 * 但路径太长、而且每个组件都要先 useAppStore()。于是 vben 按"配置分组"做了几个 hook：
 *   useRootSetting         —— 根配置（开关类的零散字段）
 *   useTransitionSetting   —— transitionSetting 那一块
 *   useHeaderSetting / useMenuSetting —— 页头、菜单（以后用到再加）
 * 组件里 `const { getCanEmbedIFramePage } = useRootSetting()` 就拿到了。
 *
 * 注意返回的都是 computed（只读的响应式值），用的时候要 unref() 取值，
 * 或者直接放进模板（模板里会自动解包）
 */
export function useRootSetting() {
  const appStore = useAppStore()

  /** 全局 loading 是否在转 */
  const getPageLoading = computed(() => appStore.getPageLoading)

  /** 是否允许内嵌 iframe 页面（layouts/page 里决定要不要渲染 FrameLayout） */
  const getCanEmbedIFramePage = computed(() => appStore.getProjectConfig.canEmbedIFramePage)

  /** 是否显示 logo */
  const getShowLogo = computed(() => appStore.getProjectConfig.showLogo)

  /** 内容区宽度模式：自适应 / 固定宽度 */
  const getContentMode = computed(() => appStore.getProjectConfig.contentMode)

  /** 是否显示"回到顶部"按钮 */
  const getUseOpenBackTop = computed(() => appStore.getProjectConfig.useOpenBackTop)

  /** 是否显示右下角的"设置"按钮 */
  const getShowSettingButton = computed(() => appStore.getProjectConfig.showSettingButton)

  /** 是否显示页脚 */
  const getShowFooter = computed(() => appStore.getProjectConfig.showFooter)

  /** 是否显示面包屑 */
  const getShowBreadCrumb = computed(() => appStore.getProjectConfig.showBreadCrumb)

  /** 面包屑前面是否带图标 */
  const getShowBreadCrumbIcon = computed(() => appStore.getProjectConfig.showBreadCrumbIcon)

  /** 主题色 */
  const getThemeColor = computed(() => appStore.getProjectConfig.themeColor)

  /** 是否进入"全屏内容"模式 */
  const getFullContent = computed(() => appStore.getProjectConfig.fullContent)

  /** 灰色模式（整站变灰） */
  const getColorWeak = computed(() => appStore.getProjectConfig.colorWeak)

  /** 色弱模式（增强对比） */
  const getGrayMode = computed(() => appStore.getProjectConfig.grayMode)

  /** 是否显示"切换主题"按钮 */
  const getShowDarkModeToggle = computed(() => appStore.getProjectConfig.showDarkModeToggle)

  /** 当前主题（亮色/暗色） */
  const getDarkMode = computed(() => appStore.getDarkMode)

  /**
   * 布局内容宽度模式。
   * vben 这里做了一次归一化：配置里只要不是 FULL，就一律当 FIXED 处理，
   * 免得以后 contentMode 加了新取值，这里跟着漏改
   */
  const getLayoutContentMode = computed(() =>
    appStore.getProjectConfig.contentMode === ContentEnum.FULL
      ? ContentEnum.FULL
      : ContentEnum.FIXED
  )

  return {
    getPageLoading,
    getCanEmbedIFramePage,
    getShowLogo,
    getContentMode,
    getUseOpenBackTop,
    getShowSettingButton,
    getShowFooter,
    getShowBreadCrumb,
    getShowBreadCrumbIcon,
    getThemeColor,
    getFullContent,
    getColorWeak,
    getGrayMode,
    getShowDarkModeToggle,
    getDarkMode,
    getLayoutContentMode
  }
}
