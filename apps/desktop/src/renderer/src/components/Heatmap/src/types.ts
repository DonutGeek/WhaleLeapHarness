export interface HeatmapDataItem {
  /** Unix 时间戳，单位为毫秒。相同日期的数据以后一个为准。 */
  timestamp: number
  /** 当天的活动值；null 表示该日期没有数据。 */
  value?: number | null
}

export type HeatmapFirstDayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6

export type HeatmapTooltipFormatter = (item: HeatmapDataItem) => string
