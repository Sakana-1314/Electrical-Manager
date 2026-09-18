/**
 * 工作管理的纯逻辑：日期区间与快捷档、筛选条件与 URL 互转、半日格与时间线行（泳道打包）。
 * 这里不放请求，全部可在单测里直接断言（页面只做渲染与交互）。
 *
 * 半日占用口径与后端 `server/app/services/work_service.py` 的 `record_slots` 完全一致：
 * 起始日之后全天占用；起始日只在上午档时占上午；结束日之前全天占用；结束日只在下午档时占下午。
 * 两侧各有一份实现（后端判定接口返回的时段、前端判定时间线色块的范围），改动必须同步。
 */
import type { WorkHalfDay, WorkOverviewRow, WorkRecord, WorkTaskStatus } from '@/api/generated'
import { toShanghaiDate } from './time'

/** 项目内最长的查询区间（含端点，与后端 `WORK_RANGE_MAX_DAYS` 一致）。 */
export const WORK_RANGE_MAX_DAYS = 92

/** 一天的两个半天档（值用后端的 AM / PM，界面展示中文）。 */
export const workHalfOptions: { label: string; value: WorkHalfDay }[] = [
  { label: '上午', value: 'AM' },
  { label: '下午', value: 'PM' },
]

export function workHalfLabel(half: WorkHalfDay): string {
  return half === 'AM' ? '上午' : '下午'
}

/** 任务状态：取值与后端 `WorkTaskStatus` 一致（界面就是中文，不需要再映射）。 */
export const workTaskStatuses: WorkTaskStatus[] = ['未开始', '进行中', '已完成', '已暂停']

export const workTaskStatusOptions = workTaskStatuses.map((value) => ({ label: value, value }))

/** 状态标签色：未开始中性、进行中蓝、已完成绿、已暂停橙（与全站状态语义一致）。 */
export const workTaskStatusTypes: Record<
  WorkTaskStatus,
  'default' | 'info' | 'success' | 'warning'
> = {
  未开始: 'default',
  进行中: 'info',
  已完成: 'success',
  已暂停: 'warning',
}

/** 时间线色块的固定色板（按任务 id / 姓名哈希取模，样式类在组件内定义）。 */
export const WORK_BAR_PALETTE_SIZE = 6

export function workBarPaletteIndex(seed: number): number {
  return Math.abs(Math.trunc(seed)) % WORK_BAR_PALETTE_SIZE
}

/** 关键字哈希：姓名这类字符串键也要落到固定色板（同一姓名颜色稳定）。 */
export function workBarHash(value: string): number {
  let hash = 0
  for (const char of value) hash = (hash * 31 + char.codePointAt(0)!) % 100000
  return hash
}

/* ===== 日期区间 ===== */

export interface WorkRange {
  /** 开始日期（含），`YYYY-MM-DD` */
  start: string
  /** 结束日期（含），`YYYY-MM-DD` */
  end: string
}

export interface WorkRangePreset {
  label: string
  range: (today: string) => WorkRange
}

/** 东八区「今天」：页面默认区间与「今天」高亮都用它，避免浏览器时区差异。 */
export function shanghaiToday(now: number = Date.now()): string {
  return toShanghaiDate(now)
}

/** 纯日期字符串加减天数（按 UTC 解析，不受本地时区影响）。 */
export function addDays(value: string, days: number): string {
  const day = new Date(`${value}T00:00:00Z`)
  day.setUTCDate(day.getUTCDate() + days)
  return day.toISOString().slice(0, 10)
}

/** 所在周的周一（ISO 周：周一为一周第一天）。 */
function weekStart(value: string): string {
  const day = new Date(`${value}T00:00:00Z`)
  const weekday = day.getUTCDay() // 0 = 周日
  return addDays(value, weekday === 0 ? -6 : 1 - weekday)
}

/** 所在月的 1 号 / 月末。 */
function monthRange(value: string): WorkRange {
  const day = new Date(`${value}T00:00:00Z`)
  const first = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), 1))
  const last = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth() + 1, 0))
  return { start: first.toISOString().slice(0, 10), end: last.toISOString().slice(0, 10) }
}

function previousMonthRange(value: string): WorkRange {
  const day = new Date(`${value}T00:00:00Z`)
  const previous = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth() - 1, 1))
  return monthRange(previous.toISOString().slice(0, 10))
}

/** 快捷档：今天 / 本周 / 下周 / 本月 / 上月。 */
export const workRangePresets: WorkRangePreset[] = [
  { label: '今天', range: (today) => ({ start: today, end: today }) },
  {
    label: '本周',
    range: (today) => ({ start: weekStart(today), end: addDays(weekStart(today), 6) }),
  },
  {
    label: '下周',
    range: (today) => ({ start: addDays(weekStart(today), 7), end: addDays(weekStart(today), 13) }),
  },
  { label: '本月', range: monthRange },
  { label: '上月', range: previousMonthRange },
]

/** 默认区间：本月整月（排活常在本月内，不默认成「今天」这种过窄的范围）。 */
export function defaultWorkRange(today: string): WorkRange {
  return monthRange(today)
}

/** 区间天数（含端点）。 */
export function rangeDays(range: WorkRange): number {
  const start = Date.parse(`${range.start}T00:00:00Z`)
  const end = Date.parse(`${range.end}T00:00:00Z`)
  return Math.floor((end - start) / 86_400_000) + 1
}

/**
 * 把区间收窄到上限内：结束早于开始时按同一天处理；超长时保留结束日期、把开始日期往后收，
 * 让「最近的活」始终在视野里（与后端 400 `WORK_RANGE_TOO_LONG` 之前的前端兜底）。
 */
export function clampWorkRange(range: WorkRange): WorkRange {
  if (range.end < range.start) return { start: range.end, end: range.end }
  if (rangeDays(range) <= WORK_RANGE_MAX_DAYS) return range
  return { start: addDays(range.end, -(WORK_RANGE_MAX_DAYS - 1)), end: range.end }
}

/* ===== 筛选条件与 URL 互转 ===== */

export interface WorkOverviewFilters {
  range: WorkRange
  task_ids: number[]
  participants: string[]
  keyword: string
}

export interface WorkTaskFilters {
  range: WorkRange
  statuses: WorkTaskStatus[]
  keyword: string
}

export interface WorkWorkerFilters {
  range: WorkRange
  keyword: string
}

export function initialWorkOverviewFilters(today: string): WorkOverviewFilters {
  return { range: defaultWorkRange(today), task_ids: [], participants: [], keyword: '' }
}

export function initialWorkTaskFilters(today: string): WorkTaskFilters {
  return { range: defaultWorkRange(today), statuses: [], keyword: '' }
}

export function initialWorkWorkerFilters(today: string): WorkWorkerFilters {
  return { range: defaultWorkRange(today), keyword: '' }
}

/** 逗号分隔的正整数 id 串 → 去重升序数组（非数字项丢弃）。 */
export function parseIdList(value: string | null | undefined): number[] {
  if (!value) return []
  const ids = new Set<number>()
  for (const part of value.split(',')) {
    const trimmed = part.trim()
    if (!/^\d+$/.test(trimmed)) continue
    const id = Number(trimmed)
    if (id > 0) ids.add(id)
  }
  return [...ids].sort((a, b) => a - b)
}

/** 逗号分隔的姓名串 → 去重保序数组（姓名本身不含逗号）。 */
export function parseNameList(value: string | null | undefined): string[] {
  if (!value) return []
  const names: string[] = []
  for (const part of value.split(',')) {
    const name = part.trim()
    if (name && !names.includes(name)) names.push(name)
  }
  return names
}

/** 逗号分隔的状态串 → 合法状态数组（非法值丢弃）。 */
export function parseStatusList(value: string | null | undefined): WorkTaskStatus[] {
  if (!value) return []
  const statuses: WorkTaskStatus[] = []
  for (const part of value.split(',')) {
    const status = part.trim() as WorkTaskStatus
    if (workTaskStatuses.includes(status) && !statuses.includes(status)) statuses.push(status)
  }
  return statuses
}

export function formatIdList(ids: number[]): string | undefined {
  const unique = [...new Set(ids.filter((id) => Number.isInteger(id) && id > 0))].sort(
    (a, b) => a - b,
  )
  return unique.length ? unique.join(',') : undefined
}

export function formatNameList(names: string[]): string | undefined {
  const unique = names.map((name) => name.trim()).filter(Boolean)
  return unique.length ? unique.join(',') : undefined
}

/**
 * 三个视图的接口查询参数：类型别名（不是 interface），这样既保证区间字段必填，
 * 又能赋给 usePagedTable 的 urlSync 需要的 `Record<string, string | number | undefined>`。
 */
export type WorkOverviewQueryParams = {
  start_date: string
  end_date: string
  keyword?: string
  task_ids?: string
  participants?: string
}

export type WorkTaskQueryParams = {
  start_date: string
  end_date: string
  keyword?: string
  status?: string
}

export type WorkWorkerQueryParams = {
  start_date: string
  end_date: string
  keyword?: string
}

function rangeQuery(range: WorkRange): { start_date: string; end_date: string } {
  return { start_date: range.start, end_date: range.end }
}

function rangeFromQuery(query: Record<string, unknown>, today: string): WorkRange {
  const start = String(query.start_date ?? '') || defaultWorkRange(today).start
  const end = String(query.end_date ?? '') || defaultWorkRange(today).end
  return clampWorkRange({ start, end })
}

export function workOverviewQuery(filters: WorkOverviewFilters): WorkOverviewQueryParams {
  return {
    ...rangeQuery(filters.range),
    keyword: filters.keyword.trim() || undefined,
    task_ids: formatIdList(filters.task_ids),
    participants: formatNameList(filters.participants),
  }
}

export function workOverviewFiltersFromQuery(
  query: Record<string, unknown>,
  today: string,
): WorkOverviewFilters {
  return {
    range: rangeFromQuery(query, today),
    task_ids: parseIdList(String(query.task_ids ?? '')),
    participants: parseNameList(String(query.participants ?? '')),
    keyword: String(query.keyword ?? ''),
  }
}

export function workTaskQuery(filters: WorkTaskFilters): WorkTaskQueryParams {
  return {
    ...rangeQuery(filters.range),
    keyword: filters.keyword.trim() || undefined,
    status: filters.statuses.length ? filters.statuses.join(',') : undefined,
  }
}

export function workTaskFiltersFromQuery(
  query: Record<string, unknown>,
  today: string,
): WorkTaskFilters {
  return {
    range: rangeFromQuery(query, today),
    statuses: parseStatusList(String(query.status ?? '')),
    keyword: String(query.keyword ?? ''),
  }
}

export function workWorkerQuery(filters: WorkWorkerFilters): WorkWorkerQueryParams {
  return {
    ...rangeQuery(filters.range),
    keyword: filters.keyword.trim() || undefined,
  }
}

export function workWorkerFiltersFromQuery(
  query: Record<string, unknown>,
  today: string,
): WorkWorkerFilters {
  return {
    range: rangeFromQuery(query, today),
    keyword: String(query.keyword ?? ''),
  }
}

/* ===== 半日格与时间线 ===== */

/** 日期表头：一个日期一列（列内再分上午 / 下午两个半日格）。 */
export interface WorkDaySlot {
  date: string
  /** 星期短名（一 / 二 / … / 日） */
  weekday: string
  isWeekend: boolean
  isToday: boolean
}

const WEEKDAY_LABELS = ['日', '一', '二', '三', '四', '五', '六']

export function buildDaySlots(range: WorkRange, today: string): WorkDaySlot[] {
  const slots: WorkDaySlot[] = []
  let current = range.start
  while (current <= range.end) {
    const weekdayIndex = new Date(`${current}T00:00:00Z`).getUTCDay()
    slots.push({
      date: current,
      weekday: WEEKDAY_LABELS[weekdayIndex]!,
      isWeekend: weekdayIndex === 0 || weekdayIndex === 6,
      isToday: current === today,
    })
    current = addDays(current, 1)
  }
  return slots
}

/** 半日格：每天两列，列 key 形如 `2026-09-07:AM`。 */
export interface WorkHalfColumn {
  key: string
  date: string
  half: WorkHalfDay
  isWeekend: boolean
  isToday: boolean
}

export function buildHalfColumns(days: WorkDaySlot[]): WorkHalfColumn[] {
  return days.flatMap((day) =>
    workHalfOptions.map((option) => ({
      key: `${day.date}:${option.value}`,
      date: day.date,
      half: option.value,
      isWeekend: day.isWeekend,
      isToday: day.isToday,
    })),
  )
}

/** 记录在指定日期占用的时段；不在记录区间内返回 null（口径与后端一致）。 */
export function recordSlotLabel(
  record: Pick<WorkRecord, 'start_date' | 'start_half' | 'end_date' | 'end_half'>,
  date: string,
): '全天' | '上午' | '下午' | null {
  if (date < record.start_date || date > record.end_date) return null
  const morning = date > record.start_date || record.start_half === 'AM'
  const afternoon = date < record.end_date || record.end_half === 'PM'
  if (morning && afternoon) return '全天'
  if (morning) return '上午'
  if (afternoon) return '下午'
  return null
}

/** 记录在查询区间内占用的半日格 key（按时间顺序），用于时间线色块的起止列。 */
export function recordHalfKeys(
  record: Pick<WorkRecord, 'start_date' | 'start_half' | 'end_date' | 'end_half'>,
  range: WorkRange,
): string[] {
  const keys: string[] = []
  let current = record.start_date > range.start ? record.start_date : range.start
  const last = record.end_date < range.end ? record.end_date : range.end
  while (current <= last) {
    const morning = current > record.start_date || record.start_half === 'AM'
    const afternoon = current < record.end_date || record.end_half === 'PM'
    if (morning) keys.push(`${current}:AM`)
    if (afternoon) keys.push(`${current}:PM`)
    current = addDays(current, 1)
  }
  return keys
}

/** 时间线色块：列区间 + 泳道 + 原始数据。 */
export interface WorkInterval<T> {
  item: T
  /** 在 `columns` 里的起始列下标（含） */
  startIndex: number
  /** 在 `columns` 里的结束列下标（含） */
  endIndex: number
  /** 泳道号（0 起）：同一行内时间重叠的色块分到不同泳道 */
  lane: number
}

export interface WorkTimelineRow<T> {
  key: string
  label: string
  /** 名称右侧的次要说明（任务视图放状态、人员视图放区间内记录数） */
  meta?: string
  intervals: WorkInterval<T>[]
  /** 超出泳道上限、没有位置的色块数量（行尾用「+N」提示） */
  hiddenCount: number
}

export interface BuildTimelineRowOptions<T> {
  key: string
  label: string
  meta?: string
  items: T[]
  /** 半日格列表（`buildHalfColumns` 的产物） */
  columns: WorkHalfColumn[]
  /** 一条数据占用的半日格 key（`recordHalfKeys` 的产物） */
  columnsOf: (item: T) => string[]
  /** 泳道上限：超出部分计入 `hiddenCount`（默认 3） */
  maxLanes?: number
}

/**
 * 把一行数据排成时间线色块：贪婪泳道打包，先放开始更早、跨度更长的色块。
 *
 * 同一天可能有多条记录（一人一天干多个活、一个活多人分时段），所以必须分层而不是叠在一条线上；
 * 层数有上限（默认 3 层），放不下的色块只计数（行尾「+N」），避免行高无上限地增长。
 */
export function buildTimelineRow<T>(options: BuildTimelineRowOptions<T>): WorkTimelineRow<T> {
  const { items, columns, columnsOf, maxLanes = 3 } = options
  const indexOfColumn = new Map(columns.map((column, index) => [column.key, index]))
  const placed = items
    .map((item) => {
      const indexes = columnsOf(item)
        .map((key) => indexOfColumn.get(key))
        .filter((index): index is number => index !== undefined)
      return indexes.length
        ? { item, startIndex: indexes[0]!, endIndex: indexes[indexes.length - 1]! }
        : null
    })
    .filter((entry): entry is { item: T; startIndex: number; endIndex: number } => entry !== null)
    .sort((a, b) => a.startIndex - b.startIndex || b.endIndex - a.endIndex)

  const laneEnds: number[] = []
  const intervals: WorkInterval<T>[] = []
  let hiddenCount = 0
  for (const entry of placed) {
    // 找第一条与前面色块不重叠的泳道（结束列 < 本次开始列即不重叠）。
    let lane = laneEnds.findIndex((end) => end < entry.startIndex)
    if (lane === -1) {
      if (laneEnds.length >= maxLanes) {
        hiddenCount += 1
        continue
      }
      laneEnds.push(entry.endIndex)
      lane = laneEnds.length - 1
    } else {
      laneEnds[lane] = entry.endIndex
    }
    intervals.push({ ...entry, lane })
  }
  return {
    key: options.key,
    label: options.label,
    meta: options.meta,
    intervals,
    hiddenCount,
  }
}

/* ===== 展示辅助 ===== */

/** 记录的时间范围文案，如「2026/09/01 下午 → 2026/09/03 上午」。 */
export function formatRecordRange(
  record: Pick<WorkRecord, 'start_date' | 'start_half' | 'end_date' | 'end_half'>,
): string {
  const start = `${record.start_date.replace(/-/g, '/')} ${workHalfLabel(record.start_half)}`
  const end = `${record.end_date.replace(/-/g, '/')} ${workHalfLabel(record.end_half)}`
  return start === end ? start : `${start} → ${end}`
}

/** 参与人姓名按中文排序（人员视图的行顺序；后端按码位排序，这里只做显示层修正）。 */
export function sortParticipantNames(names: string[]): string[] {
  return [...names].sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'))
}

/** 参与人下拉选项（`n-select` 的 tag 模式：选项之外的姓名允许直接输入）。 */
export function participantOptions(names: string[]): { label: string; value: string }[] {
  return sortParticipantNames(names).map((name) => ({ label: name, value: name }))
}

/** 工作总览行的稳定 key：一条记录在同一天只展开一行。 */
export function overviewRowKey(row: Pick<WorkOverviewRow, 'record_id' | 'date'>): string {
  return `${row.record_id}:${row.date}`
}

/** 工作总览的星期文案（与时间线表头同一套短名）。 */
export function weekdayLabel(date: string): string {
  return `周${WEEKDAY_LABELS[new Date(`${date}T00:00:00Z`).getUTCDay()]!}`
}
