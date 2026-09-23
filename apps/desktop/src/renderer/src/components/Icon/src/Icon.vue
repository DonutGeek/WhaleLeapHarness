<script setup lang="ts">
import { computed, useAttrs, watch } from 'vue'
import type { CSSProperties } from 'vue'
import { Icon as LucideSvg } from '@lucide/vue'
import { resolveIcon } from './registry'
import SvgIcon from './SvgIcon.vue'
import './lucide'

defineOptions({ name: 'Icon', inheritAttrs: false })

/** 本地雪碧图：icon 以 |svg 结尾时走 SvgIcon，其余走已登记的 lucide 名称 */
const SVG_END_WITH_FLAG = '|svg'

const props = withDefaults(
  defineProps<{
    /** 图标名。lucide 用 kebab-case（panel-left），雪碧图用 名称|svg */
    icon?: string
    color?: string
    size?: string | number
    spin?: boolean
    /** 图标集前缀，例如 lucide，会拼成 lucide:panel-left */
    prefix?: string
  }>(),
  {
    size: 16,
    spin: false,
    prefix: ''
  }
)

const attrs = useAttrs()

const isSvgIcon = computed(() => props.icon?.endsWith(SVG_END_WITH_FLAG) ?? false)
const svgName = computed(() => (props.icon ?? '').replace(SVG_END_WITH_FLAG, ''))

const iconName = computed(() => {
  if (!props.icon || isSvgIcon.value) return ''
  return props.prefix ? `${props.prefix}:${props.icon}` : props.icon
})

const iconNode = computed(() => {
  const name = iconName.value
  return name ? resolveIcon(name) : undefined
})

watch(
  iconName,
  (name) => {
    if (name && !resolveIcon(name) && import.meta.env.DEV) {
      console.warn(`[Icon] 未登记的图标：${name}`)
    }
  },
  { immediate: true }
)

const pixelSize = computed(() => {
  const { size } = props
  if (typeof size === 'number') return size
  const parsed = Number.parseFloat(size)
  return Number.isFinite(parsed) ? parsed : 16
})

const wrapStyle = computed((): CSSProperties => ({
  width: `${pixelSize.value}px`,
  height: `${pixelSize.value}px`,
  fontSize: `${pixelSize.value}px`,
  color: props.color,
  display: 'inline-flex',
  lineHeight: 0
}))

/** class / style 画在外层，其余属性（如 fill）交给 svg */
const svgAttrs = computed(() => {
  const { class: _class, style: _style, ...rest } = attrs
  return rest
})
</script>

<template>
  <SvgIcon
    v-if="isSvgIcon"
    :size="size"
    :name="svgName"
    :class="[attrs.class, 'anticon']"
    :spin="spin"
  />
  <span v-else :class="[attrs.class, 'anticon', spin && 'animate-spin']" :style="wrapStyle">
    <LucideSvg
      v-if="iconNode"
      v-bind="svgAttrs"
      :name="iconName"
      :icon-node="iconNode"
      :size="pixelSize"
      :color="color"
      aria-hidden="true"
    />
  </span>
</template>
