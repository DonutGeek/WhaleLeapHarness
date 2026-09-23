// store 相关的类型定义（对应 vben 模板的 types/store.d.ts，
// 它里面还有 UserInfo、ErrorLogInfo 等类型，等做到登录/错误日志那一步再补）
import type { MenuModeEnum, MenuTypeEnum } from '@/enums/menuEnum'

/**
 * "窗口缩小"时记住的状态。
 * 场景：窗口很窄时侧边栏会自动折叠/隐藏，等窗口拉大回来，要能恢复成原来的样子，
 * 所以就趁缩小前把这几项记下来。
 */
export interface BeforeMiniState {
  // 缩小前菜单是否处于折叠状态
  menuCollapsed?: boolean
  // 缩小前菜单是否为"分离"模式（顶部一级 + 侧边子菜单）
  menuSplit?: boolean
  // 缩小前的菜单展开方式
  menuMode?: MenuModeEnum
  // 缩小前的菜单放置位置
  menuType?: MenuTypeEnum
}
