import { cloneDeep, merge } from 'lodash-es'
import { defineStore } from 'pinia'
import { FontSizeEnum, ThemeEnum } from '@/enums/appEnum'
import { darkMode } from '@/settings/designSetting'
import setting from '@/settings/projectSetting'
import { store } from '@/store'
import type {
  DeepPartial,
  HeaderSetting,
  MenuSetting,
  ProjectConfig,
  TransitionSetting
} from '@/types/config'
import type { BeforeMiniState } from '@/types/store'

// app store：管理"应用级别"的状态——主题、项目配置、全局 loading。
// 对应 vben v2 的 src/store/modules/app.ts（结构、命名、行为都照着来）。
//
// 这里用的是 defineStore 的"选项式"写法（对象里分 state / getters / actions 三段），
// vben v2 就是这种写法；上一个大版本 Vuex 也是这三段，从 Vuex 迁移过来最好认。
// （另一种"setup 函数式"写法在模块多起来时更灵活，等以后新增 store 时再说）
interface AppState {
  // 当前主题模式。undefined 表示"用户还没手动切过"，这时用 settings 里的默认值
  darkMode?: ThemeEnum
  // 文字大小。undefined 表示还没手动选过，回退到标准
  fontSize?: FontSizeEnum
  // 全局加载中标志（页面切换、数据加载时用），比如控制顶部那条加载动画
  pageLoading: boolean
  // 项目配置。类型写死成 ProjectConfig（不是 vben 的 `ProjectConfig | null`），
  // 因为我们的初值就是 cloneDeep(setting)，永远不为 null，
  // 这样后面用的时候不用到处判空
  projectConfig: ProjectConfig
  // 侧边栏在"折叠/迷你"状态下的记忆信息（折叠前是什么形态，展开时还原回去）
  beforeMiniInfo: BeforeMiniState
}

// 存 setTimeout 的返回值。浏览器里 setTimeout 返回数字，Node 里返回对象，
// 所以不能直接写 number——用 ReturnType<typeof setTimeout> 让 TS 自己推断
let timeId: ReturnType<typeof setTimeout> | undefined

/** 把主题偏好解析成实际要用的深色或浅色。系统模式读取操作系统的配色方案。 */
export function resolveTheme(mode: ThemeEnum | string): ThemeEnum.DARK | ThemeEnum.LIGHT {
  if (mode === ThemeEnum.SYSTEM) {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    return prefersDark ? ThemeEnum.DARK : ThemeEnum.LIGHT
  }
  return mode === ThemeEnum.LIGHT ? ThemeEnum.LIGHT : ThemeEnum.DARK
}

// 注意：vben v2 用的是老版 Pinia 的写法 defineStore({ id: 'app', state, ... })——
// 把 id 写在配置对象里面。我们装的 Pinia 4 已经把这个"单对象"形式去掉了，
// 现在必须先传 id、再传配置对象：defineStore('app', { state, ... })，行为完全一样
export const useAppStore = defineStore('app', {
  // state 是个函数：每次创建 store 时调用一次，返回初始状态。
  // 写成函数而不是对象，是为了避免多个 store 实例共享同一份数据（引用被复用）
  state: (): AppState => ({
    // 初始 undefined = 还没手动切过主题，getDarkMode 会回退到 settings 的默认值
    darkMode: undefined,
    // 默认标准；用户改过之后以存盘的值为准
    fontSize: FontSizeEnum.MEDIUM,
    pageLoading: false,
    // cloneDeep 深拷贝一份默认配置：如果直接用 setting 这个对象本身，
    // 后面改配置就改到"出厂设置"那个模块上去了（模块是单例，改一次污染全局）。
    // 深拷贝后 store 里这份和 settings 里那份彻底互不影响
    projectConfig: cloneDeep(setting),
    // 折叠记忆信息一开始是空的 {}，等布局组件上报后才有值
    beforeMiniInfo: {}
  }),

  getters: {
    // getter 就是"由 state 算出来的值"，组件里像读属性一样用：appStore.getPageLoading。
    // 它们是只读的、并且有缓存（依赖的 state 不变就不会重算）。
    // 在选项式写法里，getter 之间可以用 this 相互调用
    // （TS 推断不出 this 的类型，所以要显式标注返回类型）

    /** 全局 loading 是否在转 */
    getPageLoading(state): boolean {
      return state.pageLoading
    },

    /** 当前主题：用户切过就用用户的，没切过就用 settings/designSetting.ts 里的默认值 */
    getDarkMode(state): ThemeEnum | string {
      return state.darkMode || darkMode
    },

    /** 当前文字大小，缺省时仍是标准 */
    getFontSize(state): FontSizeEnum {
      return state.fontSize || FontSizeEnum.MEDIUM
    },

    /** 折叠前的侧边栏形态记忆 */
    getBeforeMiniInfo(state): BeforeMiniState {
      return state.beforeMiniInfo
    },

    /** 完整的项目配置 */
    getProjectConfig(state): ProjectConfig {
      return state.projectConfig
    },

    // 下面四个是"从大配置里取一小块"的便捷 getter。
    // 组件里写 appStore.getMenuSetting.collapsed 比 appStore.getProjectConfig.menuSetting.collapsed 短得多。
    // this 指向当前 store，所以能直接调其它 getter

    /** 页头配置 */
    getHeaderSetting(): HeaderSetting {
      return this.getProjectConfig.headerSetting
    },

    /** 侧边栏菜单配置 */
    getMenuSetting(): MenuSetting {
      return this.getProjectConfig.menuSetting
    },

    /** 页面切换动画配置 */
    getTransitionSetting(): TransitionSetting {
      return this.getProjectConfig.transitionSetting
    }
  },

  actions: {
    // action 就是普通函数，可以改 state、也可以是异步的。
    // 组件里用 appStore.setPageLoading(false) 这样调用

    /** 直接设置全局 loading（一般用下面的带防抖版本，见 setPageLoadingAction） */
    setPageLoading(loading: boolean): void {
      this.pageLoading = loading
    },

    /**
     * 切换主题偏好（深色 / 浅色 / 系统）。
     * 页面上的 data-theme 只写解析后的深色或浅色。
     */
    setDarkMode(mode: ThemeEnum): void {
      this.darkMode = mode
      // data-theme 只写解析后的深色或浅色。选「系统」时不能写成 system，否则样式对不上。
      document.documentElement.dataset.theme = resolveTheme(mode)
    },

    /** 切换文字大小，并写到 html 上，样式表按 data-font-size 缩放根字号 */
    setFontSize(size: FontSizeEnum): void {
      this.fontSize = size
      document.documentElement.dataset.fontSize = size
    },

    /** 记录侧边栏折叠前的形态（传给布局组件用于还原） */
    setBeforeMiniInfo(state: BeforeMiniState): void {
      this.beforeMiniInfo = state
    },

    /**
     * 改项目配置。只传想改的部分就行，例如：
     *   appStore.setProjectConfig({ menuSetting: { collapsed: true } });
     * 这里用 lodash 的 merge 做"深合并"：嵌套对象是逐层合并，不是整个替换，
     * 所以只写 { menuSetting: { collapsed: true } } 不会把 menuSetting 里别的字段弄丢。
     * 改完不用手动存盘——本地持久化插件监听到 state 变化会自动保存
     */
    setProjectConfig(config: DeepPartial<ProjectConfig>): void {
      this.projectConfig = merge({}, this.projectConfig, config) as ProjectConfig
    },

    /**
     * 把所有状态恢复到初始值（退出登录、切换工作区的场景会用）。
     * $reset() 是 Pinia 自带的方法，把 state 重置回 state() 函数返回的初值
     */
    async resetAllState() {
      this.$reset()
      // vben 这里还会调 resetRouter() 把动态注册的路由清掉，我们暂时没有动态路由，先不加。
    },

    /**
     * 带防抖的全局 loading 开关。
     * 为什么需要防抖：页面切换很快时，loading 一闪而过反而显得卡顿。
     * 打开时刻意等 50ms——如果 50ms 内又被关掉，那这个 loading 根本不会显示出来。
     */
    async setPageLoadingAction(loading: boolean): Promise<void> {
      if (loading) {
        // 打开：延迟 50ms 再真正生效（期间若被关闭，定时器会被取消）
        clearTimeout(timeId)
        timeId = setTimeout(() => {
          this.setPageLoading(loading)
        }, 50)
      } else {
        // 关闭：立即生效，并取消上面那个还没到点的定时器
        this.setPageLoading(loading)
        clearTimeout(timeId)
      }
    }
  }
})

/**
 * 在组件外面用 store。
 * 组件里直接 useAppStore() 就能拿到 store（Pinia 会自动把当前实例注入进去），
 * 但在路由守卫、工具函数这些"不在组件里"的地方，Pinia 拿不到当前实例，
 * 就必须显式把 store/index.ts 里创建的那个 pinia 实例传进去。
 * vben 给这种用法起了个名字叫 WithOut（"没有组件上下文也能用"）
 */
export function useAppStoreWithOut() {
  return useAppStore(store)
}
