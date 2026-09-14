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
