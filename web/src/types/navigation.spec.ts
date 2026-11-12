import { describe, expect, it } from 'vitest'
import { hasPermission } from './navigation'

describe('权限门禁（权限位展开的键集合）', () => {
  it('具体权限键要求集合内存在同键权限', () => {
    expect(hasPermission(['warehouse:read', 'warehouse:write'], 'warehouse:write')).toBe(true)
    expect(hasPermission(['warehouse:read'], 'warehouse:write')).toBe(false)
  })

  it('read 命中任一模块读权限即可（查看类菜单对所有有读权限的用户可见）', () => {
    expect(hasPermission(['purchase:read'], 'read')).toBe(true)
    expect(hasPermission(['system:admin'], 'read')).toBe(false)
    expect(hasPermission([], 'read')).toBe(false)
  })

  it('系统管理与各功能读写位相互独立', () => {
    expect(hasPermission(['system:admin'], 'system:admin')).toBe(true)
    expect(hasPermission(['system:admin'], 'warehouse:write')).toBe(false)
    expect(hasPermission(['warehouse:write'], 'system:admin')).toBe(false)
  })
})
