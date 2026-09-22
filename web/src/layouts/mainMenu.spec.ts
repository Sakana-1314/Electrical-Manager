import { describe, expect, it } from 'vitest'
import type { MenuOption } from 'naive-ui'
import { buildMainMenu, type MainMenuContext } from './mainMenu'
import type { NavFeatureKey } from '@/utils/navigation'

const context = (overrides: Partial<MainMenuContext> = {}): MainMenuContext => ({
  isLiteMode: false,
  can: () => true,
  isFeatureVisible: () => true,
  ...overrides,
})

/** 一级菜单项的 key（子项挂在 `children` 里）。 */
const topKeys = (options: MenuOption[]): string[] => options.map((option) => String(option.key))

/** 指定一级项的二级 key 列表。 */
const childKeys = (options: MenuOption[], key: string): string[] => {
  const group = options.find((option) => option.key === key)
  const children = (group?.children as MenuOption[] | undefined) ?? []
  return children.map((child) => String(child.key))
}

describe('buildMainMenu（侧栏主 tab 可见性）', () => {
  it('默认渲染全部主 tab（系统管理排在最后）', () => {
    expect(topKeys(buildMainMenu(context()))).toEqual([
      'dashboard',
      'memos',
      'warehouse-group',
      'hua-xing-stock',
      'procurement-group',
      'hazard-group',
      'ledger-group',
      'work-group',
      'settings-group',
    ])
  })

  it('隐藏的主 tab 连同分组整体不渲染，其余顺序不变', () => {
    const hidden = new Set<NavFeatureKey>(['work', 'huaxing_inventory'])
    const options = buildMainMenu(context({ isFeatureVisible: (key) => !hidden.has(key) }))
    expect(topKeys(options)).toEqual([
      'dashboard',
      'memos',
      'warehouse-group',
      'procurement-group',
      'hazard-group',
      'ledger-group',
      'settings-group',
    ])
    expect(topKeys(options)).not.toContain('work-group')
  })

  it('系统管理不参与可见性开关：其余全部隐藏时它仍在', () => {
    const options = buildMainMenu(context({ isFeatureVisible: () => false }))
    expect(topKeys(options)).toEqual(['settings-group'])
  })

  it('无 settings:write 权限时不渲染系统管理', () => {
    const options = buildMainMenu(context({ can: (permission) => permission !== 'settings:write' }))
    expect(topKeys(options)).not.toContain('settings-group')
  })

  it('精简模式下二级库降为一级项，完整模式为分组', () => {
    expect(topKeys(buildMainMenu(context({ isLiteMode: true })))).toContain('warehouse-lite')
    expect(childKeys(buildMainMenu(context()), 'warehouse-group')).toEqual([
      'stock',
      'stock-materials',
      'operations',
      'inbound',
      'outbound',
    ])
  })

  it('无 warehouse:write 权限时二级库里没有入库 / 出库', () => {
    const options = buildMainMenu(
      context({ can: (permission) => permission !== 'warehouse:write' }),
    )
    expect(childKeys(options, 'warehouse-group')).toEqual([
      'stock',
      'stock-materials',
      'operations',
    ])
  })

  it('高级设置始终挂在系统管理分组内', () => {
    expect(childKeys(buildMainMenu(context()), 'settings-group')).toContain('advanced-settings')
  })
})
