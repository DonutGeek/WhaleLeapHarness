import { computed } from 'vue'
import { useAppStore } from '@/store/modules/app'

/**
 * 读/写侧边栏菜单配置。
 * 对应 vben 的 useMenuSetting：布局部件不要直接碰 appStore 的整份 projectConfig。
 */
export function useMenuSetting() {
  const appStore = useAppStore()

  /** 侧边栏是否折叠成窄条 */
  const getCollapsed = computed(() => appStore.getMenuSetting.collapsed)

  /** 展开时的侧边栏宽度 */
  const getMenuWidth = computed(() => appStore.getMenuSetting.menuWidth)

  /** 侧栏是否整块收起（不留占位） */
  const getSiderHidden = computed(() => appStore.getMenuSetting.hidden)

  function setCollapsed(collapsed: boolean) {
    appStore.setProjectConfig({ menuSetting: { collapsed } })
  }

  function toggleSiderHidden() {
    appStore.setProjectConfig({ menuSetting: { hidden: !getSiderHidden.value } })
  }

  function toggleCollapsed() {
    setCollapsed(!getCollapsed.value)
  }

  function setMenuWidth(menuWidth: number) {
    appStore.setProjectConfig({ menuSetting: { menuWidth } })
  }

  return {
    getCollapsed,
    getMenuWidth,
    getSiderHidden,
    setCollapsed,
    setMenuWidth,
    toggleCollapsed,
    toggleSiderHidden
  }
}
