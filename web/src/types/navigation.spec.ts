import { describe, expect, it } from 'vitest'
import { hasPermission } from './navigation'

describe('权限并集门禁', () => {
  it('具体权限键要求并集内存在同键权限', () => {
    expect(hasPermission(['warehouse:read', 'warehouse:write'], 'warehouse:write')).toBe(true)
    expect(hasPermission(['warehouse:read'], 'warehouse:write')).toBe(false)
  })

  it('read 命中任一模块读权限即可（查看类菜单对所有有读权限的用户可见）', () => {
    expect(hasPermission(['purchase:read'], 'read')).toBe(true)
    expect(hasPermission(['settings:write'], 'read')).toBe(false)
    expect(hasPermission([], 'read')).toBe(false)
  })

  it('多角色并集：任一角色带来的权限都算数', () => {
    expect(hasPermission(['hazard:read', 'hazard:write'], 'hazard:write')).toBe(true)
    expect(hasPermission(['settings:write'], 'settings:write')).toBe(true)
  })
})
