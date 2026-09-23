// Icon 组件包，对齐 vben v2 的用法：业务只写 <Icon icon="名称" />。
// lucide 用 kebab-case（panel-left，也可写 lucide:panel-left）；
// 本地雪碧图用「名称|svg」，由 SvgIcon 读取 #icon-名称。

import './src/lucide'

export { default as Icon } from './src/Icon.vue'
export { default as SvgIcon } from './src/SvgIcon.vue'
export { renderIcon } from './src/renderIcon'
