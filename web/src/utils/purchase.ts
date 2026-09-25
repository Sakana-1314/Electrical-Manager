const LAST_PURCHASE_RESPONSIBLE_KEY = 'procurement.purchase-materials.last-purchase-responsible'

export function defaultPurchaseOrderNo(date = new Date()): string {
  const parts = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).formatToParts(date)
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value || ''
  return `申购 ${value('year')}/${value('month')}/${value('day')}`
}

export function getLastPurchaseResponsible(): string {
  return localStorage.getItem(LAST_PURCHASE_RESPONSIBLE_KEY)?.trim() || ''
}

export function rememberPurchaseResponsible(value: string): void {
  const responsible = value.trim()
  if (responsible) localStorage.setItem(LAST_PURCHASE_RESPONSIBLE_KEY, responsible)
}

/**
 * 列表把「计划数量 + 计量单位」合并成一列展示，导出仍按两列走。
 *
 * 传入列表勾选的列键与完整列顺序，返回导出该用的列键：勾了合并列（`planned_qty`）就补上
 * 被并入的 `unit_name`，并按原列顺序输出（保证 Excel 里仍是「计划数量、计量单位」相邻两列，
 * 不因显示合并而少一列）。没勾合并列时原样返回，保持调用方顺序。
 */
export function mergeExportColumns<T extends string>(
  selectedKeys: Iterable<NoInfer<T>>,
  orderedKeys: readonly T[],
  mergedInto: { trigger: T; supplementary: T } = {
    trigger: 'planned_qty' as T,
    supplementary: 'unit_name' as T,
  },
): T[] {
  const selected = new Set<string>(selectedKeys)
  if (selected.has(mergedInto.trigger)) selected.add(mergedInto.supplementary)
  return orderedKeys.filter((key) => selected.has(key))
}
