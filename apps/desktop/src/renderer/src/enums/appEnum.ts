// enums/ 目录集中放"枚举"：把一个字段允许的取值写成有名字的常量，
// 用的时候写 ThemeEnum.DARK 而不是散落各处的字符串 'dark'。
// 好处：编辑器能自动补全、写错会立刻报红、以后改取值只改这一处。
//
// 对应 vben 模板的 src/enums/appEnum.ts（它里面还有权限模式、会话超时等枚举，用到再补）

/** 主题模式：深色 / 浅色 / 跟随系统 */
export enum ThemeEnum {
  DARK = 'dark',
  LIGHT = 'light',
  SYSTEM = 'system'
}

/** 文字大小：小 / 标准 / 大 */
export enum FontSizeEnum {
  SMALL = 'small',
  MEDIUM = 'medium',
  LARGE = 'large'
}

/** 内容区宽度模式 */
export enum ContentEnum {
  // 自适应：内容铺满可用宽度
  FULL = 'full',
  // 固定宽度：内容居中、两侧留白（大屏阅读更舒服）
  FIXED = 'fixed'
}

/**
 * 路由/页面切换动画。
 * 取值必须和 design/transition/index.css 里写的类名前缀一致
 * （<Transition name="fade"> 会去找 .fade-enter-active 这些类名）
 */
export enum RouterTransitionEnum {
  FADE = 'fade',
  SLIDE_UP = 'slide-up',
  SCALE = 'scale',
  ZOOM = 'zoom'
}
