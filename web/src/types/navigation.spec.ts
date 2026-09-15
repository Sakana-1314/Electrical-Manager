import { describe, expect, it } from 'vitest'
import { roleLabels, rolePermissions } from './navigation'

describe('六角色权限', () => {
  it('超级管理员拥有全部写权限', () => {
    expect(rolePermissions.SUPER_ADMIN).toEqual(
      expect.arrayContaining([
        'warehouse:write',
        'purchase:write',
        'settings:write',
        'hazard:write',
        'ledger:write',
      ]),
    )
  })
  it('仓库管理员仅能写仓库域', () => {
    expect(rolePermissions.WAREHOUSE_ADMIN).toContain('warehouse:write')
    expect(rolePermissions.WAREHOUSE_ADMIN).not.toContain('purchase:write')
    expect(rolePermissions.WAREHOUSE_ADMIN).not.toContain('hazard:write')
    expect(rolePermissions.WAREHOUSE_ADMIN).not.toContain('ledger:write')
  })
  it('申购管理员仅能写申购域', () => {
    expect(rolePermissions.PURCHASE_ADMIN).toContain('purchase:write')
    expect(rolePermissions.PURCHASE_ADMIN).not.toContain('warehouse:write')
    expect(rolePermissions.PURCHASE_ADMIN).not.toContain('hazard:write')
    expect(rolePermissions.PURCHASE_ADMIN).not.toContain('ledger:write')
  })
  it('隐患管理员仅能写隐患域', () => {
    expect(rolePermissions.HAZARD_ADMIN).toContain('hazard:write')
    expect(rolePermissions.HAZARD_ADMIN).not.toContain('warehouse:write')
    expect(rolePermissions.HAZARD_ADMIN).not.toContain('purchase:write')
    expect(rolePermissions.HAZARD_ADMIN).not.toContain('settings:write')
    expect(rolePermissions.HAZARD_ADMIN).not.toContain('ledger:write')
  })
  it('台账管理员仅能写台账域', () => {
    expect(rolePermissions.LEDGER_ADMIN).toContain('ledger:write')
    expect(rolePermissions.LEDGER_ADMIN).not.toContain('warehouse:write')
    expect(rolePermissions.LEDGER_ADMIN).not.toContain('purchase:write')
    expect(rolePermissions.LEDGER_ADMIN).not.toContain('hazard:write')
    expect(rolePermissions.LEDGER_ADMIN).not.toContain('settings:write')
  })
  it('只读角色没有写权限', () => {
    expect(rolePermissions.READ_ONLY).toEqual(['read'])
  })
  it('每个角色都有中文名（用户管理页的角色下拉直接用它）', () => {
    expect(Object.keys(roleLabels).sort()).toEqual(Object.keys(rolePermissions).sort())
    expect(roleLabels.HAZARD_ADMIN).toBe('隐患管理员')
    expect(roleLabels.LEDGER_ADMIN).toBe('台账管理员')
  })
})
