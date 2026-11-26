<script setup lang="ts">
import { computed, h } from 'vue'
import type { DataTableColumns, DataTableRowData } from 'naive-ui'
import { buildMobileCards } from '@/utils/mobileCards'

/**
 * 移动端「表格 → 卡片」渲染：与桌面表格共用同一份 columns / data / row-key / row-props。
 * 由 `PersistentDataTable` 在 ≤768px 时挂载，页面不需要改。
 *
 * 单元格内容是列定义的 `render` 结果（VNode / 字符串 / 数字），统一用函数式组件包一层渲染，
 * 避免把 VNode 塞进插值里被转成 `[object Object]`。
 */
const props = defineProps<{
  columns: DataTableColumns<DataTableRowData>
  data: DataTableRowData[]
  rowKey?: (row: DataTableRowData) => string | number
  rowProps?: (row: DataTableRowData) => Record<string, unknown>
}>()

const cards = computed(() => buildMobileCards(props.columns, props.data, props.rowKey))

/** 单元格 / 操作按钮内容 → 可直接挂载的组件。 */
function cellComponent(value: unknown) {
  return () =>
    typeof value === 'string' || typeof value === 'number'
      ? String(value)
      : h('span', null, [value as never])
}

/** 卡片与行一一对应：点击行为沿用页面传给表格的 row-props（整行可点）。 */
function onCardClick(index: number, event: MouseEvent) {
  const row = props.data[index]
  if (!row) return
  const handler = props.rowProps?.(row)?.onClick
  if (typeof handler === 'function') (handler as (e: MouseEvent) => void)(event)
}

/** 行内样式（页面用 row-props 传 `cursor: pointer` 这类）沿用，其它属性不逐项复制。 */
function cardStyle(index: number) {
  const style = props.rowProps?.(props.data[index] ?? {})?.style
  return typeof style === 'string' ? style : undefined
}
</script>

<template>
  <div class="mobile-table-cards">
    <div
      v-for="(card, index) in cards"
      :key="card.key"
      class="mobile-card"
      :style="cardStyle(index)"
      @click="onCardClick(index, $event)"
    >
      <div class="mobile-card-title">
        <component :is="cellComponent(card.title)" />
      </div>
      <div v-if="card.fields.length" class="mobile-card-fields">
        <div v-for="field in card.fields" :key="field.label" class="mobile-card-field">
          <span class="mobile-card-label">{{ field.label }}</span>
          <span class="mobile-card-value"><component :is="cellComponent(field.value)" /></span>
        </div>
      </div>
      <div v-if="card.actions.length" class="mobile-card-actions">
        <span
          v-for="(action, actionIndex) in card.actions"
          :key="actionIndex"
          class="mobile-card-action"
        >
          <component :is="cellComponent(action)" />
        </span>
      </div>
    </div>
    <div v-if="!cards.length" class="mobile-card-empty">暂无数据</div>
  </div>
</template>
