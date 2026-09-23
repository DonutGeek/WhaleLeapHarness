import { h, type VNode } from 'vue'
import Icon from './Icon.vue'

/** 在脚本里渲染图标，等价于模板中的 <Icon :icon="name" :size="size" /> */
export function renderIcon(name: string, size = 16): VNode {
  return h(Icon, { icon: name, size })
}
