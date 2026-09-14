import { describe, expect, it } from 'vitest'
import { NTag } from 'naive-ui'
import { renderMaterialCode, renderTwoLineText } from './tableText'

/** 取 VNode 默认插槽的文本（h(Comp, props, { default: () => '文本' }) 的取值方式）。 */
function slotText(vnode: { children: unknown }): string {
  return (vnode.children as { default: () => string }).default()
}

describe('renderTwoLineText 两行文本单元格', () => {
  it('空值回落默认占位符', () => {
    expect(renderTwoLineText(null).children).toBe('\\')
    expect(renderTwoLineText('').children).toBe('\\')
    expect(renderTwoLineText(undefined, '-').children).toBe('-')
  })

  it('有值时按两行文本渲染并带 title', () => {
    const vnode = renderTwoLineText('E011-00237')
    expect(vnode.type).toBe('div')
    expect(vnode.props?.class).toBe('table-text-two-line')
    expect(vnode.children).toBe('E011-00237')
    expect(vnode.props?.title).toBe('E011-00237')
  })
})

describe('renderMaterialCode 物料编码单元格', () => {
  it('有编码时与普通两行文本一致', () => {
    const vnode = renderMaterialCode('E011-00237')
    expect(vnode.type).toBe('div')
    expect(vnode.props?.class).toBe('table-text-two-line')
    expect(vnode.children).toBe('E011-00237')
  })

  it.each([null, undefined, ''])('无编码（%s）时渲染黄色「暂无编码」标签', (value) => {
    const vnode = renderMaterialCode(value)
    expect(vnode.type).toBe(NTag)
    expect(vnode.props).toMatchObject({ type: 'warning', size: 'small' })
    expect(slotText(vnode)).toBe('暂无编码')
  })
})
