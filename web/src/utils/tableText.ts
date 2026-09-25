import { h, type VNode } from 'vue'
import { NTag } from 'naive-ui'

export function renderTwoLineText(
  value: string | number | null | undefined,
  fallback = '\\',
): VNode {
  const text = value === null || value === undefined || value === '' ? fallback : String(value)
  return h(
    'div',
    { class: 'table-text-two-line', title: text === fallback ? undefined : text },
    text,
  )
}

/**
 * 物料编码列：有编码按两行文本展示，缺编码时统一用黄色「暂无编码」标签。
 *
 * 申购计划与周期性计划共用本函数，保证两处的空编码显示不会各自漂移。
 */
export function renderMaterialCode(value: string | null | undefined): VNode {
  if (value) return renderTwoLineText(value)
  return h(NTag, { type: 'warning', size: 'small' }, { default: () => '暂无编码' })
}

/**
 * 「数量」列：把数量与计量单位合成一格展示（如「12 个」）。
 *
 * 计划数量与计量单位在库里是两列、导出也仍是两列，但列表里单看数量没有参照，
 * 因此列表统一合成一列展示；单位缺失时只显示数量，数量缺失时显示 `fallback`。
 */
export function renderQuantityWithUnit(
  value: string | number | null | undefined,
  unit: string | null | undefined,
  fallback = '\\',
): VNode {
  const quantity = value === null || value === undefined || value === '' ? '' : String(value)
  if (!quantity) return renderTwoLineText(null, fallback)
  const text = `${quantity}${unit ?? ''}`
  return renderTwoLineText(text)
}
