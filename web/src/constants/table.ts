import type { DataTableColumns } from 'naive-ui'

export const tableColumnWidths = {
  unit: 80,
  quantity: 110,
  /** 「数量 + 单位」合并列（如「12 个」）：比单独的数量列宽一点，又比两列之和窄。 */
  quantityWithUnit: 132,
  date: 112,
  datetime: 172,
  status: 104,
  person: 120,
  /** 需求部门：部门名称比人名长，给更宽的列，避免频繁省略。 */
  department: 160,
  code: 150,
  /** 申购列表的物料编码列：编码定长，120px 足够，把宽度让给部门。 */
  codeNarrow: 120,
  identifier: 176,
  name: 220,
  description: 260,
  material: 280,
  model: 240,
  text: 200,
  action: 180,
} as const

export function preventTableColumnCompression<T>(
  columns: DataTableColumns<T>,
): DataTableColumns<T> {
  return columns.map((column) => {
    const lockedColumn = { ...column }
    if (lockedColumn.type === 'selection' && lockedColumn.width === undefined) {
      lockedColumn.width = 48
    }
    if (lockedColumn.width !== undefined && lockedColumn.minWidth === undefined) {
      lockedColumn.minWidth = lockedColumn.width
    }
    return lockedColumn
  }) as DataTableColumns<T>
}

export function getTableScrollX<T>(columns: DataTableColumns<T>): number {
  return columns.reduce((total, column) => {
    if ('children' in column && column.children) {
      return total + getTableScrollX(column.children)
    }
    const width = Number(column.minWidth ?? column.width ?? tableColumnWidths.text)
    return total + (Number.isFinite(width) ? width : tableColumnWidths.text)
  }, 0)
}
