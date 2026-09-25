import { describe, expect, it } from 'vitest'
import { NTag } from 'naive-ui'
import { renderMaterialCode, renderQuantityWithUnit, renderTwoLineText } from './tableText'

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

describe('renderQuantityWithUnit 数量合并单元格', () => {
  it('数量与单位合成一格（如「12 个」）', () => {
    const vnode = renderQuantityWithUnit('12', '个')
    expect(vnode.props?.class).toBe('table-text-two-line')
    expect(vnode.children).toBe('12个')
    expect(vnode.props?.title).toBe('12个')
  })

  it('单位缺失时只显示数量，不出现 undefined/null', () => {
    expect(renderQuantityWithUnit('12', null).children).toBe('12')
    expect(renderQuantityWithUnit('12', undefined).children).toBe('12')
    expect(renderQuantityWithUnit('12', '').children).toBe('12')
  })

  it('数量缺失时回落占位符（默认 \\，可指定 -）', () => {
    for (const empty of [null, undefined, '']) {
      expect(renderQuantityWithUnit(empty, '个').children).toBe('\\')
      expect(renderQuantityWithUnit(empty, '个', '-').children).toBe('-')
    }
    // 数量缺失时不该把单位单独渲染出来
    expect(renderQuantityWithUnit(null, '个').children).not.toContain('个')
  })

  it('数量为数字类型时也能拼接（接口返回 DECIMAL 字符串，防御性覆盖）', () => {
    expect(renderQuantityWithUnit(12, '个').children).toBe('12个')
  })
})
