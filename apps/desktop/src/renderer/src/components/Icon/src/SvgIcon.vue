<script setup lang="ts">
import { computed, useAttrs } from 'vue'
import type { CSSProperties } from 'vue'

defineOptions({ name: 'SvgIcon', inheritAttrs: false })

const props = withDefaults(
  defineProps<{
    /** 雪碧图 symbol 前缀，对应 #icon-名称 */
    prefix?: string
    name: string
    size?: number | string
    spin?: boolean
  }>(),
  {
    prefix: 'icon',
    size: 16,
    spin: false
  }
)

const attrs = useAttrs()
const symbolId = computed(() => `#${props.prefix}-${props.name}`)

const iconStyle = computed((): CSSProperties => {
  const raw = `${props.size}`.replace(/px$/i, '')
  const size = /^\d+(\.\d+)?$/.test(raw) ? `${raw}px` : `${props.size}`
  return { width: size, height: size }
})
</script>

<template>
  <svg
    :class="[
      'inline-block overflow-hidden fill-current align-[-0.15em]',
      attrs.class,
      spin && 'animate-spin'
    ]"
    :style="iconStyle"
    aria-hidden="true"
  >
    <use :href="symbolId" />
  </svg>
</template>
