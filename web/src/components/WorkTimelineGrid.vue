<script setup lang="ts">
/**
 * 半日格时间线网格：任务视图（一行一个任务）与人员视图（一行一个人）共用。
 *
 * 布局：每行是一个 CSS 网格——最左是粘性名称列，右侧每个「半天」一列（每天两列），
 * 行内色块按泳道分层摆放（同一行同一天的多个活不叠在一起，最多 3 层，超出用「+N」提示）。
 * 色块用 `grid-column: 起始列 / 结束列 + 1` 跨列，因此不需要绝对定位与手工宽度估算。
 *
 * 样式只引用全局令牌（`--color-*` 与时间线色板 `--color-work-bar-*`），明暗两档都成立。
 * Shift + 滚轮横向滚动由组件自己处理（Naive UI 的表格滚动容器钩子只认 n-data-table）。
 */
import { computed } from 'vue'
import { NEmpty, NTag, NTooltip } from 'naive-ui'
import type { WorkRecord } from '@/api/generated'
import LoadingMask from '@/components/LoadingMask.vue'
import type { WorkDaySlot, WorkHalfColumn, WorkInterval, WorkTimelineRow } from '@/utils/work'

const props = withDefaults(
  defineProps<{
    /** 左侧列标题（任务视图「任务」、人员视图「人员」） */
    labelTitle: string
    days: WorkDaySlot[]
    columns: WorkHalfColumn[]
    rows: WorkTimelineRow<WorkRecord>[]
    loading?: boolean
    emptyText?: string
    /** 色块上的文字（任务视图显示参与人员、人员视图显示任务名） */
    labelOf: (record: WorkRecord) => string
    /** 悬停浮层的完整信息 */
    titleOf: (record: WorkRecord) => string
    /** 色板下标（同一任务 / 同一姓名颜色稳定） */
    colorOf: (record: WorkRecord) => number
  }>(),
  { loading: false, emptyText: '暂无可显示的数据' },
)

const emit = defineEmits<{ selectInterval: [record: WorkRecord] }>()

/** 每行的列模板一致：名称列 + 每个半天一列。 */
const gridStyle = computed(() => ({
  gridTemplateColumns: `var(--timeline-label-width) repeat(${props.columns.length}, var(--timeline-half-width))`,
}))

function rowStyle(row: WorkTimelineRow<WorkRecord>): Record<string, string> {
  const lanes = Math.max(1, ...row.intervals.map((interval) => interval.lane + 1))
  return { '--timeline-lane-count': String(lanes) }
}

function barStyle(interval: WorkInterval<WorkRecord>): Record<string, string> {
  return {
    gridColumn: `${interval.startIndex + 2} / ${interval.endIndex + 3}`,
    gridRow: String(interval.lane + 1),
  }
}

/** 日期表头跨当天的两个半天列。 */
function dayStyle(day: WorkDaySlot): Record<string, string> {
  const index = props.days.indexOf(day) * 2
  return { gridColumn: `${index + 2} / ${index + 4}` }
}

/** Shift + 滚轮横向滚动（时间线比卡片宽时的常规操作）。 */
function onWheel(event: WheelEvent): void {
  if (!event.shiftKey || Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return
  const scroller = event.currentTarget as HTMLElement
  if (scroller.scrollWidth <= scroller.clientWidth) return
  const previous = scroller.scrollLeft
  scroller.scrollLeft += event.deltaY
  if (scroller.scrollLeft !== previous) event.preventDefault()
}
</script>

<template>
  <div class="timeline-host">
    <LoadingMask :show="loading" text="正在加载工作记录…" />
    <n-empty v-if="!rows.length && !loading" :description="emptyText" class="timeline-empty" />
    <div v-else class="timeline-scroll" @wheel="onWheel">
      <!-- 表头：第一行日期（跨两个半天列），第二行「上 / 下」 -->
      <div class="timeline-grid timeline-head" :style="gridStyle">
        <div class="timeline-corner">{{ labelTitle }}</div>
        <div
          v-for="day in days"
          :key="day.date"
          class="timeline-day"
          :class="{ 'is-weekend': day.isWeekend, 'is-today': day.isToday }"
          :style="dayStyle(day)"
        >
          <span class="timeline-day__date">{{ day.date.slice(5) }}</span>
          <span class="timeline-day__weekday">周{{ day.weekday }}</span>
        </div>
        <div
          v-for="column in columns"
          :key="column.key"
          class="timeline-half"
          :class="{ 'is-weekend': column.isWeekend, 'is-today': column.isToday }"
        >
          {{ column.half === 'AM' ? '上' : '下' }}
        </div>
      </div>

      <!-- 数据行 -->
      <div
        v-for="row in rows"
        :key="row.key"
        class="timeline-grid timeline-row"
        :style="{ ...gridStyle, ...rowStyle(row) }"
      >
        <div class="timeline-label">
          <div class="timeline-label__main">
            <slot name="label" :row="row">{{ row.label }}</slot>
          </div>
          <div class="timeline-label__meta">
            <span v-if="row.meta" class="timeline-label__meta-text">{{ row.meta }}</span>
            <n-tooltip v-if="row.hiddenCount" trigger="hover">
              <template #trigger>
                <n-tag size="small" :bordered="false" type="warning" class="timeline-label__more">
                  +{{ row.hiddenCount }}
                </n-tag>
              </template>
              还有 {{ row.hiddenCount }} 条记录未在时间线上显示
            </n-tooltip>
            <slot name="actions" :row="row" />
          </div>
        </div>

        <!-- 背景格：周末 / 今天弱底色，勾出每天的边界 -->
        <div
          v-for="column in columns"
          :key="column.key"
          class="timeline-cell"
          :class="{ 'is-weekend': column.isWeekend, 'is-today': column.isToday }"
        />

        <n-tooltip v-for="interval in row.intervals" :key="interval.item.id" trigger="hover">
          <template #trigger>
            <button
              type="button"
              class="timeline-bar"
              :class="`bar-${colorOf(interval.item)}`"
              :style="barStyle(interval)"
              @click="emit('selectInterval', interval.item)"
            >
              {{ labelOf(interval.item) }}
            </button>
          </template>
          {{ titleOf(interval.item) }}
        </n-tooltip>
      </div>
    </div>
  </div>
</template>

<style scoped>
.timeline-host {
  position: relative;
  --timeline-label-width: 208px;
  --timeline-half-width: 24px;
}

.timeline-empty {
  padding: 32px 0;
}

.timeline-scroll {
  overflow-x: auto;
  padding-bottom: 4px;
}

.timeline-grid {
  display: grid;
  align-items: stretch;
}

/* 表头 */
.timeline-head {
  background: var(--color-table-header);
  color: var(--color-table-header-text);
  border-bottom: 1px solid var(--color-border);
  grid-template-rows: 26px 20px;
}

.timeline-corner {
  position: sticky;
  left: 0;
  z-index: 2;
  display: flex;
  align-items: flex-end;
  padding: 0 12px 4px;
  background: var(--color-table-header);
  border-right: 1px solid var(--color-border);
  font-size: 13px;
  font-weight: 600;
}

.timeline-day,
.timeline-half {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 3px;
  font-size: 12px;
  white-space: nowrap;
}

.timeline-day {
  border-left: 1px solid var(--color-border-subtle);
}

.timeline-day__weekday {
  color: var(--color-text-muted);
}

.timeline-half {
  color: var(--color-text-muted);
  border-left: 1px dotted var(--color-border-subtle);
}

/* 数据行 */
.timeline-row {
  grid-template-rows: repeat(var(--timeline-lane-count, 1), 22px);
  border-bottom: 1px solid var(--color-border-subtle);
}

.timeline-row:hover {
  background: var(--color-table-row-hover);
}

.timeline-label {
  position: sticky;
  left: 0;
  z-index: 2;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 2px;
  grid-row: 1 / -1;
  padding: 4px 12px;
  background: var(--color-surface);
  border-right: 1px solid var(--color-border);
}

.timeline-row:hover .timeline-label {
  background: var(--color-table-row-hover);
}

.timeline-label__main {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  color: var(--color-text-strong);
  font-size: 13px;
  font-weight: 600;
}

.timeline-label__main :deep(.n-tag) {
  flex: none;
}

.timeline-label__meta {
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 20px;
  color: var(--color-text-muted);
  font-size: 12px;
}

.timeline-label__meta-text {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.timeline-label__more {
  flex: none;
}

.timeline-cell {
  grid-row: 1 / -1;
  border-left: 1px solid var(--color-border-subtle);
}

.timeline-cell.is-weekend,
.timeline-half.is-weekend,
.timeline-day.is-weekend {
  background: var(--color-surface-muted);
}

.timeline-cell.is-today,
.timeline-half.is-today,
.timeline-day.is-today {
  background: var(--color-primary-soft);
}

.timeline-bar {
  align-self: center;
  height: 18px;
  margin: 0 1px;
  padding: 0 6px;
  overflow: hidden;
  border: 1px solid transparent;
  border-radius: 6px;
  font-size: 11px;
  line-height: 16px;
  text-align: left;
  white-space: nowrap;
  text-overflow: ellipsis;
  cursor: pointer;
}

.timeline-bar:hover,
.timeline-bar:focus-visible {
  border-color: var(--color-text-strong);
  outline: none;
}

/* 色板：下标由 utils/work.ts 的 workBarPaletteIndex 给出（同一任务 / 同一姓名颜色稳定） */
.bar-0 {
  background: var(--color-work-bar-0-bg);
  color: var(--color-work-bar-0-fg);
}

.bar-1 {
  background: var(--color-work-bar-1-bg);
  color: var(--color-work-bar-1-fg);
}

.bar-2 {
  background: var(--color-work-bar-2-bg);
  color: var(--color-work-bar-2-fg);
}

.bar-3 {
  background: var(--color-work-bar-3-bg);
  color: var(--color-work-bar-3-fg);
}

.bar-4 {
  background: var(--color-work-bar-4-bg);
  color: var(--color-work-bar-4-fg);
}

.bar-5 {
  background: var(--color-work-bar-5-bg);
  color: var(--color-work-bar-5-fg);
}
</style>
