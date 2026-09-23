import { computed } from 'vue'
import { useAppStore } from '@/store/modules/app'
import type { TransitionSetting } from '@/types/config'

/**
 * 读/改"页面切换动画"配置（ProjectConfig.transitionSetting 那一块）。
 * 对应 vben v2 的 src/hooks/setting/useTransitionSetting.ts。
 * 写法说明见 useRootSetting.ts 顶部的注释
 */
export function useTransitionSetting() {
  const appStore = useAppStore()

  /** 总开关：是否启用页面切换动画。
   *  这里的 ?. 是 vben 原样保留的——理论上 getTransitionSetting 一定有值，
   *  但 getter 链路上任何一环拿到 undefined 时，?. 能让它安全地返回 undefined
   *  而不是直接抛错，页面还不至于白屏 */
  const getEnableTransition = computed(() => appStore.getTransitionSetting?.enable)

  /** 是否显示顶部进度条（nprogress） */
  const getOpenNProgress = computed(() => appStore.getTransitionSetting?.openNProgress)

  /** 切换页面时是否显示"加载中"遮罩。
   *  !! 是把任意值强制转成 boolean，保证这个 computed 的类型是 boolean
   *  （否则是 boolean | undefined，用它的地方还得再判空） */
  const getOpenPageLoading = computed((): boolean => {
    return !!appStore.getTransitionSetting?.openPageLoading
  })

  /** 默认动画名（对应 design/transition/index.css 里的类名前缀） */
  const getBasicTransition = computed(() => appStore.getTransitionSetting?.basicTransition)

  /** 改动画配置。只传想改的字段，其余保持不变（内部走 app store 的深合并） */
  function setTransitionSetting(transitionSetting: Partial<TransitionSetting>) {
    appStore.setProjectConfig({ transitionSetting })
  }

  return {
    setTransitionSetting,
    getEnableTransition,
    getOpenNProgress,
    getOpenPageLoading,
    getBasicTransition
  }
}
