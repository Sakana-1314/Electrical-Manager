// @vitest-environment node
/**
 * 左侧菜单折叠分组的「手风琴」逻辑（`layouts/menuAccordion.ts`）。
 *
 * 约定：同一时刻只展开一个分组；进入某个页面时自动展开它所在的分组。
 * 这两条都只在交互层生效，改坏了不会报错、只会退回「多个分组同时展开」，所以单独守住。
 */
import { describe, expect, it } from 'vitest'
import { accordionExpandedKeys, groupKeyForRoute, type MenuLikeOption } from './menuAccordion'

describe('手风琴：同时只展开一个分组', () => {
  it('没有展开任何分组时，点开一个就只展开它', () => {
    expect(accordionExpandedKeys([], ['warehouse-group'])).toEqual(['warehouse-group'])
  })

  it('已展开一个时点开第二个，前一个自动收起', () => {
    expect(
      accordionExpandedKeys(['warehouse-group'], ['warehouse-group', 'procurement-group']),
    ).toEqual(['procurement-group'])
  })

  it('收起当前分组时不连带展开别的', () => {
    expect(accordionExpandedKeys(['warehouse-group'], [])).toEqual([])
  })

  it('菜单一次报回多个展开项时只保留最后点开的那个', () => {
    expect(accordionExpandedKeys([], ['settings-group', 'ledger-group', 'work-group'])).toEqual([
      'work-group',
    ])
  })
})

describe('进入页面时自动展开所在分组', () => {
  const options: MenuLikeOption[] = [
    { key: 'dashboard' },
    {
      key: 'warehouse-group',
      children: [{ key: 'stock' }, { key: 'stock-materials' }, { key: 'operations' }],
    },
    {
      key: 'procurement-group',
      children: [{ key: 'purchase-materials' }, { key: 'purchase-records' }],
    },
  ]

  it('找到页面所属分组', () => {
    expect(groupKeyForRoute(options, 'stock')).toBe('warehouse-group')
    expect(groupKeyForRoute(options, 'purchase-records')).toBe('procurement-group')
  })

  it('顶级菜单项不属于任何分组', () => {
    expect(groupKeyForRoute(options, 'dashboard')).toBeNull()
  })

  it('未知页面 / 空名称返回 null', () => {
    expect(groupKeyForRoute(options, 'nope')).toBeNull()
    expect(groupKeyForRoute(options, null)).toBeNull()
    expect(groupKeyForRoute(options, '')).toBeNull()
  })
})
