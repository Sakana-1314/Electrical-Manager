import type { DataTableBaseColumn, DataTableColumns, DataTableRowData } from 'naive-ui'
import type { VNodeChild } from 'vue'

/**
 * 把「表格列 + 行数据」折叠成移动端阅读卡片。
 *
 * 手机屏幕上宽表只能左右拖着看，一次只看得到两三列；本模块把同一份列定义与数据重排成
 * 「一条记录一张卡」：第一列（通常是名称 / 单号）做卡片标题，其余列做「标签 + 值」的两列行，
 * 操作列（标题含「操作」，或纯按钮列）放到卡片底部整行。桌面端仍用原表格，列宽、拖动与
 * 横向滚动都不受影响——两套渲染共用同一份 columns / data，不存在第二套数据源。
 *
 * 只处理可展示的列：选择列（`type: 'selection'`）、展开列（`type: 'expand'`）与没有标题的列跳过。
 */
export interface MobileCardField {
  /** 列标题（作为字段标签）。 */
  label: string
  /** 单元格内容（直接复用列定义的 render 结果）。 */
  value: VNodeChild
}

export interface MobileCardItem {
  /** 行键，用于 `wx:key` 等价的渲染复用。 */
  key: string | number
  /** 卡片标题：第一列的单元格内容。 */
  title: VNodeChild
  /** 标题列的名字，便于调试与测试。 */
  titleLabel: string
  fields: MobileCardField[]
  /** 操作列内容（没有操作列时为空）。 */
  actions: VNodeChild[]
}

type CellColumn = DataTableBaseColumn<DataTableRowData>

/** 列是否可在卡片里展示（选择 / 展开列与无标题列跳过）。 */
function isDisplayColumn(column: DataTableColumns<DataTableRowData>[number]): column is CellColumn {
  if ('type' in column) return false
  const title = (column as CellColumn).title
  return typeof title === 'string' ? title.trim() !== '' : title !== undefined
}

/** 操作列：标题里带「操作」，或整列只有 render（纯按钮列）。 */
function isActionColumn(column: CellColumn): boolean {
  return typeof column.title === 'string' && column.title.includes('操作')
}

/** 取单元格内容：有 render 用 render，否则按 key 取行字段。 */
function cellValue(column: CellColumn, row: DataTableRowData): VNodeChild {
  if (typeof column.render === 'function') return column.render(row, 0) as VNodeChild
  const key = column.key
  if (key === undefined || key === null) return ''
  const value = (row as Record<string, unknown>)[String(key)]
  if (value === null || value === undefined || value === '') return '—'
  return String(value)
}

export function buildMobileCards(
  columns: DataTableColumns<DataTableRowData>,
  rows: DataTableRowData[],
  rowKey?: (row: DataTableRowData) => string | number,
): MobileCardItem[] {
  const display = columns.filter(isDisplayColumn)
  const actions = display.filter(isActionColumn)
  const titleColumn = display.find((column) => !isActionColumn(column))
  const fields = display.filter((column) => column !== titleColumn && !isActionColumn(column))
  return rows.map((row, index) => ({
    key: rowKey ? rowKey(row) : index,
    titleLabel: titleColumn ? String(titleColumn.title) : '',
    title: titleColumn ? cellValue(titleColumn, row) : '',
    fields: fields.map((column) => ({
      label: String(column.title),
      value: cellValue(column, row),
    })),
    actions: actions.map((column) => cellValue(column, row)),
  }))
}
