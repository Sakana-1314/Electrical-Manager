<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { NDataTable } from 'naive-ui'
import type { DataTableBaseColumn, DataTableColumns, DataTableRowData } from 'naive-ui'
import { useMediaQuery } from '@vueuse/core'
import MobileTableCards from '@/components/MobileTableCards.vue'

/**
 * 可拖动列宽的数据表格：在 Naive DataTable 外包一层，按页面记住用户拖过的列宽。
 *
 * - 每列自动加 `resizable: true`（有宽度的列），拖动表头分隔线即可调整；
 * - 调整结果按 `storageKey` 写入 localStorage，刷新 / 切页返回仍生效；
 * - 横向滚动宽度按当前列宽实时求和，拖宽后不会被旧的 scroll-x 截断；
 * - **移动端（≤768px）改渲染成「一条记录一张卡」**：第一列做标题、其余列做「标签 + 值」、
 *   操作列放卡片底部；桌面端仍是宽表格，两种排版共用同一份 columns / data。
 *
 * 页面替换 `<n-data-table>` 为 `<PersistentDataTable storage-key="模块/页面">` 即可，其它 props 原样透传。
 */
const props = defineProps<{
  /** 调用方列定义；泛型行类型由各页面自行保证，这里只做列宽加工。 */
  columns: unknown
  /** 页面唯一标识（如 `procurement/purchase-materials`），列宽按它隔离持久化。 */
  storageKey: string
}>()

const widths = ref<Record<string, number>>({})

const storageKey = computed(() => `table-column-widths:v1:${props.storageKey}`)

function loadWidths(): Record<string, number> {
  try {
    const raw = localStorage.getItem(storageKey.value)
    if (!raw) return {}
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return {}
    const out: Record<string, number> = {}
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof value === 'number' && Number.isFinite(value) && value > 0) out[key] = value
    }
    return out
  } catch {
    return {}
  }
}

watch(
  storageKey,
  () => {
    widths.value = loadWidths()
  },
  { immediate: true },
)

/** 递归给有宽度的列打开拖动，并用本地保存的宽度覆盖默认值。 */
function withResizableWidths(
  columns: DataTableColumns<DataTableRowData>,
): DataTableColumns<DataTableRowData> {
  return columns.map((column) => {
    if ('children' in column && Array.isArray(column.children)) {
      return { ...column, children: withResizableWidths(column.children) }
    }
    if ('type' in column) return column // 选择列 / 展开列不参与拖动
    const base = column as DataTableBaseColumn<DataTableRowData>
    const saved =
      base.key !== undefined && base.key !== null ? widths.value[String(base.key)] : undefined
    if (base.width === undefined && base.minWidth === undefined && saved === undefined) return base
    return {
      ...base,
      resizable: true,
      ...(saved !== undefined ? { width: saved } : {}),
    }
  }) as DataTableColumns<DataTableRowData>
}

function columnWidth(column: DataTableColumns<DataTableRowData>[number]): number {
  if ('children' in column && Array.isArray(column.children) && column.children.length) {
    return column.children.reduce((total, child) => total + columnWidth(child), 0)
  }
  const width = Number(column.width ?? column.minWidth ?? 0)
  return Number.isFinite(width) && width > 0 ? width : 160
}

const resolvedColumns = computed(() =>
  withResizableWidths(props.columns as DataTableColumns<DataTableRowData>),
)
const scrollX = computed(() =>
  resolvedColumns.value.reduce((total, column) => total + columnWidth(column), 0),
)

/** 移动端（与布局抽屉同一断点）：宽表切成卡片，避免横向拖表。 */
const isMobile = useMediaQuery('(max-width: 768px)')
const rows = computed(() => (props as unknown as { data?: DataTableRowData[] }).data ?? [])
const rowKey = computed(
  () => (props as unknown as { rowKey?: (row: DataTableRowData) => string | number }).rowKey,
)
const rowProps = computed(
  () =>
    (props as unknown as { rowProps?: (row: DataTableRowData) => Record<string, unknown> })
      .rowProps,
)

/** 拖动中的宽度先攒着：每帧都重算列 / 写 localStorage 会卡，停手后再落一次。 */
const pendingWidths = new Map<string, number>()
let persistTimer: ReturnType<typeof setTimeout> | undefined

function flushPendingWidths(): void {
  if (pendingWidths.size === 0) return
  const next = { ...widths.value }
  for (const [key, width] of pendingWidths) next[key] = width
  pendingWidths.clear()
  widths.value = next
  try {
    localStorage.setItem(storageKey.value, JSON.stringify(next))
  } catch {
    // 持久化失败只影响下次进入，当前表格已按新宽度渲染
  }
}

function onColumnResize(
  resizedWidth: number,
  _limitedWidth: number,
  column: DataTableBaseColumn<DataTableRowData>,
): void {
  const key = column?.key
  if (key === undefined || key === null || !Number.isFinite(resizedWidth)) return
  pendingWidths.set(String(key), Math.round(resizedWidth))
  if (persistTimer !== undefined) clearTimeout(persistTimer)
  persistTimer = setTimeout(() => {
    persistTimer = undefined
    flushPendingWidths()
  }, 150)
}

onBeforeUnmount(() => {
  if (persistTimer !== undefined) clearTimeout(persistTimer)
  flushPendingWidths()
})
</script>

<template>
  <MobileTableCards
    v-if="isMobile"
    :columns="resolvedColumns"
    :data="rows"
    :row-key="rowKey"
    :row-props="rowProps"
  />
  <n-data-table
    v-else
    v-bind="$attrs"
    table-layout="fixed"
    :columns="resolvedColumns"
    :scroll-x="scrollX"
    @unstable-column-resize="onColumnResize"
  />
</template>
