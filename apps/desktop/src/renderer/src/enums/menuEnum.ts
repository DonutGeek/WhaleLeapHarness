// 菜单相关的枚举（对应 vben 模板的 src/enums/menuEnum.ts，
// 它里面还有"混合侧边栏"的触发方式等枚举，等用到再补）

/** 菜单整体放在哪里 */
export enum MenuTypeEnum {
  // 左侧边栏（最常见的后台布局）
  SIDEBAR = 'sidebar',
  // 混合模式：一级菜单在顶部、子菜单在侧边
  MIX_SIDEBAR = 'mix-sidebar',
  // 全部放顶部横向排列
  HEADER = 'header'
}

/** 菜单的展开方式 */
export enum MenuModeEnum {
  // 竖向：菜单文字和图标横排，展开时向下弹出子菜单
  VERTICAL = 'vertical',
  // 横向：顶部菜单条
  HORIZONTAL = 'horizontal',
  // 内联：子菜单展开在父项下方（侧边栏最常用的那种）
  INLINE = 'inline'
}

/** 侧边栏"收起/展开"按钮的位置 */
export enum TriggerEnum {
  // 不显示这个按钮
  NONE = 'none',
  BOTTOM = 'bottom',
  TOP = 'top',
  CENTER = 'center'
}
