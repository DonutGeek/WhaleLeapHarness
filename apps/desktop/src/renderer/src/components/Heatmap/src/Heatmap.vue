<script setup lang="ts">
import { computed } from 'vue'
import type { HeatmapDataItem, HeatmapFirstDayOfWeek, HeatmapTooltipFormatter } from './types'

interface DayCell {
  item: HeatmapDataItem
  loading: boolean
}

const props = withDefaults(
  defineProps<{
    /** 日历数据，格式与 Naive UI Heatmap 保持一致。 */ data?: HeatmapDataItem[]
    /** 加载中展示的数据；未提供时以骨架格填充。 */ loadingData?: HeatmapDataItem[]
    /** 活动色阶，从低到高排列。 */ activeColors?: string[]
    /** 值为 0 时使用的颜色。 */ minimumColor?: string
    /** 一周的第一天，0 为周日。 */ firstDayOfWeek?: HeatmapFirstDayOfWeek
    /** 是否补齐首周开始日前的空格。 */ fillCalendarLeading?: boolean
    showColorIndicator?: boolean
    showWeekLabels?: boolean
    showMonthLabels?: boolean
    /** 是否将全部周列自适应到容器宽度内。 */
    fit?: boolean
    size?: 'small' | 'medium' | 'large'
    xGap?: number
    yGap?: number
    loading?: boolean
    tooltip?: boolean
    tooltipFormatter?: HeatmapTooltipFormatter
  }>(),
  {
    data: () => [],
    loadingData: undefined,
    activeColors: () => [
      'var(--ant-color-primary-bg-hover)',
      'var(--ant-color-primary-border)',
      'var(--ant-color-primary-border-hover)',
      'var(--ant-color-primary)'
    ],
    minimumColor: 'var(--ant-color-fill-tertiary)',
    firstDayOfWeek: 0,
    fillCalendarLeading: false,
    showColorIndicator: true,
    showWeekLabels: true,
    showMonthLabels: true,
    fit: true,
    size: 'medium',
    xGap: undefined,
    yGap: undefined,
    loading: false,
    tooltip: false,
    tooltipFormatter: undefined
  }
)
const emit = defineEmits<{ cellClick: [item: HeatmapDataItem] }>()
const sizeMap = {
  small: { cell: 8, gap: 2 },
  medium: { cell: 11, gap: 3 },
  large: { cell: 14, gap: 4 }
} as const
const activeData = computed(() =>
  props.loading && props.loadingData?.length ? props.loadingData : props.data
)
const normalizedData = computed(() => {
  const byDay = new Map<string, HeatmapDataItem>()
  for (const item of activeData.value) {
    if (!Number.isFinite(item.timestamp)) continue
    const date = startOfDay(new Date(item.timestamp))
    byDay.set(dateKey(date), { ...item, timestamp: date.getTime() })
  }
  return [...byDay.values()].sort((a, b) => a.timestamp - b.timestamp)
})
const dataByDay = computed(
  () => new Map(normalizedData.value.map((item) => [dateKey(new Date(item.timestamp)), item]))
)
const calendarStart = computed(() => {
  const first = normalizedData.value[0]
  if (!first) return null
  const date = new Date(first.timestamp)
  return props.fillCalendarLeading ? startOfWeek(date, props.firstDayOfWeek) : date
})
const calendarEnd = computed(() =>
  normalizedData.value.at(-1) ? new Date(normalizedData.value.at(-1)!.timestamp) : null
)
const weekCount = computed(() =>
  calendarStart.value && calendarEnd.value
    ? Math.floor(daysBetween(calendarStart.value, calendarEnd.value) / 7) + 1
    : 0
)
const matrix = computed<(DayCell | null)[][]>(() => {
  if (!calendarStart.value || !calendarEnd.value) return []
  const rows = Array.from({ length: 7 }, () =>
    Array.from<DayCell | null>({ length: weekCount.value }).fill(null)
  )
  const cursor = new Date(calendarStart.value)
  while (cursor <= calendarEnd.value) {
    const week = Math.floor(daysBetween(calendarStart.value, cursor) / 7)
    const row = (cursor.getDay() - props.firstDayOfWeek + 7) % 7
    rows[row][week] = {
      item: dataByDay.value.get(dateKey(cursor)) ?? {
        timestamp: cursor.getTime(),
        value: null
      },
      loading: props.loading
    }
    cursor.setDate(cursor.getDate() + 1)
  }
  return rows
})
const maxValue = computed(() =>
  Math.max(
    0,
    ...normalizedData.value.map((item) =>
      typeof item.value === 'number' && Number.isFinite(item.value) ? item.value : 0
    )
  )
)
const weekdayLabels = computed(() => {
  const labels = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  return Array.from({ length: 7 }, (_, index) => labels[(index + props.firstDayOfWeek) % 7])
})
const monthLabels = computed(() => {
  const labels: Array<{ label: string; span: number }> = []
  let current = ''
  let span = 0
  for (let week = 0; week < weekCount.value; week += 1) {
    const item = matrix.value.map((row) => row[week]?.item).find(Boolean)
    const label = item
      ? new Intl.DateTimeFormat('zh-CN', { month: 'short' }).format(item.timestamp)
      : ''
    if (label === current) span += 1
    else {
      if (current) labels.push({ label: current, span })
      current = label
      span = 1
    }
  }
  if (current) labels.push({ label: current, span })
  return labels
})
const cssVars = computed(() => ({
  '--heatmap-preferred-cell-size': `${sizeMap[props.size].cell}px`,
  '--heatmap-cell-size': `${sizeMap[props.size].cell}px`,
  '--heatmap-week-count': weekCount.value,
  '--heatmap-x-gap': `${props.xGap ?? 1}px`,
  '--heatmap-y-gap': `${props.yGap ?? 1}px`
}))
function startOfDay(date: Date) {
  date.setHours(0, 0, 0, 0)
  return date
}
function startOfWeek(date: Date, firstDay: HeatmapFirstDayOfWeek) {
  const result = startOfDay(new Date(date))
  result.setDate(result.getDate() - ((result.getDay() - firstDay + 7) % 7))
  return result
}
function daysBetween(from: Date, to: Date) {
  return Math.round(
    (startOfDay(new Date(to)).getTime() - startOfDay(new Date(from)).getTime()) / 86_400_000
  )
}
function dateKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
}
function getColor(cell: DayCell | null) {
  if (!cell || cell.item.value === null || cell.item.value === undefined) return 'transparent'
  if (cell.item.value <= 0 || maxValue.value <= 0) return props.minimumColor
  const index = Math.min(
    props.activeColors.length - 1,
    Math.ceil((cell.item.value / maxValue.value) * props.activeColors.length) - 1
  )
  return props.activeColors[Math.max(0, index)]
}
function getTooltip(cell: DayCell) {
  if (props.tooltipFormatter) return props.tooltipFormatter(cell.item)
  const date = new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium' }).format(cell.item.timestamp)
  return cell.item.value === null || cell.item.value === undefined
    ? date
    : `${date}：${cell.item.value}`
}
</script>

<template>
  <div
    class="text-xs text-(--ant-color-text-secondary)"
    :class="{ 'heatmap--fit': fit }"
    :style="cssVars"
    aria-label="活动热力图"
  >
    <div
      v-if="!matrix.length && !loading"
      class="grid min-h-28 place-items-center text-(--ant-color-text-tertiary)"
    >
      暂无数据
    </div>
    <div v-else class="heatmap__content overflow-x-auto">
      <table
        class="heatmap__calendar border-separate [border-spacing:var(--heatmap-x-gap)_var(--heatmap-y-gap)]"
        aria-label="活动日历"
      >
        <thead v-if="showMonthLabels">
          <tr>
            <th
              v-if="showWeekLabels"
              class="w-[30px] py-0 pr-1 pl-0 text-right font-normal whitespace-nowrap"
            />
            <th
              v-for="({ label, span }, index) in monthLabels"
              :key="`${label}-${index}`"
              :colspan="span"
              class="h-[18px] p-0 text-left font-normal whitespace-nowrap"
            >
              {{ label }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, rowIndex) in matrix" :key="rowIndex">
            <th
              v-if="showWeekLabels"
              scope="row"
              class="w-[30px] py-0 pr-1 pl-0 text-right font-normal whitespace-nowrap"
            >
              {{ rowIndex % 2 ? weekdayLabels[rowIndex] : '' }}
            </th>
            <td
              v-for="(cell, weekIndex) in row"
              :key="weekIndex"
              class="size-(--heatmap-cell-size) p-0"
            >
              <button
                v-if="cell"
                class="box-border block size-(--heatmap-cell-size) cursor-pointer rounded-(--ant-border-radius-sm) border-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--ant-color-primary)"
                :class="{ 'heatmap__day--loading': cell.loading }"
                :style="{ backgroundColor: getColor(cell) }"
                type="button"
                :title="tooltip ? getTooltip(cell) : undefined"
                :aria-label="getTooltip(cell)"
                @click="emit('cellClick', cell.item)"
              />
              <span
                v-else
                class="box-border block size-(--heatmap-cell-size) rounded-(--ant-border-radius-sm)"
                aria-hidden="true"
              />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <div
      v-if="showColorIndicator && matrix.length"
      class="mt-2 flex items-center justify-between gap-3"
    >
      <slot name="footer" />
      <div class="ml-auto inline-flex items-center gap-1 text-xs" aria-label="活动色阶">
        <slot name="indicator-leading-text">少</slot
        ><span
          v-for="(color, index) in [minimumColor, ...activeColors]"
          :key="index"
          class="size-(--heatmap-cell-size) rounded-(--ant-border-radius-sm)"
          :style="{ backgroundColor: color }"
        /><slot name="indicator-trailing-text">多</slot>
      </div>
    </div>
  </div>
</template>

<style scoped>
@reference "../../../design/tailwind.css";

/* 按容器宽度反推格子尺寸，工具类写不出这条 cqw 计算 */
.heatmap--fit .heatmap__content {
  container-type: inline-size;
  @apply overflow-hidden;
}
.heatmap--fit .heatmap__calendar {
  --heatmap-cell-size: min(
    var(--heatmap-preferred-cell-size),
    max(8px, calc((100cqw - 62px) / var(--heatmap-week-count) - var(--heatmap-x-gap)))
  );
}
.heatmap__day--loading {
  background: linear-gradient(
    90deg,
    var(--ant-color-fill-tertiary),
    var(--ant-color-fill-secondary),
    var(--ant-color-fill-tertiary)
  ) !important;
  background-size: 200% 100% !important;
  animation: heatmap-shimmer 1.4s linear infinite;
}
@keyframes heatmap-shimmer {
  to {
    background-position: -200% 0;
  }
}
</style>
