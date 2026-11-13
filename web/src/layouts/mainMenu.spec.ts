import { describe, expect, it } from 'vitest'
import type { MenuOption } from 'naive-ui'
import { buildMainMenu, type MainMenuContext } from './mainMenu'
import type { Permission } from '@/types/navigation'

const ALL_PERMISSIONS: Permission[] = [
  'system:admin',
  'warehouse:read',
  'warehouse:write',
  'lite:read',
  'lite:write',
  'purchase:read',
  'purchase:write',
  'huaxing:read',
  'ledger:read',
  'ledger:write',
  'hazard:read',
  'hazard:write',
  'work:read',
  'work:write',
]

const context = (overrides: Partial<MainMenuContext> = {}): MainMenuContext => ({
  can: (permission) => ALL_PERMISSIONS.includes(permission),
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
      'warehouse-lite',
      'hua-xing-stock',
      'procurement-group',
      'hazard-group',
      'ledger-group',
      'work-group',
      'settings-group',
    ])
  })

  it('没有读权限的主 tab 连同分组整体不渲染，其余顺序不变', () => {
    const options = buildMainMenu(
      context({
        can: (permission) =>
          permission !== 'work:read' && permission !== 'huaxing:read' && permission !== 'lite:read',
      }),
    )
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

  it('没有任何权限时只保留工作台 / 备忘录（不设门禁）', () => {
    const options = buildMainMenu(context({ can: () => false }))
    expect(topKeys(options)).toEqual(['dashboard', 'memos'])
  })

  it('无 system:admin 权限时不渲染系统管理', () => {
    const options = buildMainMenu(context({ can: (permission) => permission !== 'system:admin' }))
    expect(topKeys(options)).not.toContain('settings-group')
  })

  it('精简二级库是独立一级项：持有 lite:read 才渲染，标准二级库始终是分组', () => {
    expect(topKeys(buildMainMenu(context()))).toContain('warehouse-lite')
    expect(
      topKeys(buildMainMenu(context({ can: (permission) => permission !== 'lite:read' }))),
    ).not.toContain('warehouse-lite')
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
