import type { IconNode } from 'lucide'

const registry = new Map<string, IconNode>()

/** 把 panel-left / lucide:panel-left / PanelLeft 收成同一种查找键 */
export function normalizeIconName(name: string) {
  return name
    .trim()
    .replace(/^lucide:/i, '')
    .replace(/Icon$/i, '')
    .replace(/[\s_]+/g, '-')
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Za-z])(\d)/g, '$1-$2')
    .toLowerCase()
}

/** 登记本项目会用到的 lucide 图标数据 */
export function registerIcons(icons: Record<string, IconNode>) {
  for (const [name, source] of Object.entries(icons)) {
    if (name === 'default') continue
    registry.set(normalizeIconName(name), source)
  }
}

/** 按名称取出图标数据；没登记则返回 undefined */
export function resolveIcon(name: string) {
  return registry.get(normalizeIconName(name))
}
