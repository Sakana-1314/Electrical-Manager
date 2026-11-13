import { describe, expect, it } from 'vitest'
import { NAV_FEATURES, resolveLandingRouteName, visibleNavFeatureKeys } from './navigation'
import type { Permission } from '@/types/navigation'

const can = (perms: string[]) => (permission: Permission) => perms.includes(permission)

const ALL_READ = [
  'warehouse:read',
  'lite:read',
  'purchase:read',
  'huaxing:read',
  'ledger:read',
  'hazard:read',
  'work:read',
]

describe('主 tab 可见性（utils/navigation）', () => {
  it('有全部读权限时包含 9 个主 tab 且不含系统管理', () => {
    expect(visibleNavFeatureKeys(can(ALL_READ))).toEqual([
      'dashboard',
      'memos',
      'warehouse',
      'warehouse_lite',
      'huaxing_inventory',
      'procurement',
      'hazards',
      'ledger',
      'work',
    ])
  })

  it('没有某模块读权限时该主 tab 不出现，其余顺序不变', () => {
    const keys = visibleNavFeatureKeys(can(['warehouse:read']))
    expect(keys).toEqual(['dashboard', 'memos', 'warehouse'])
    expect(keys).not.toContain('work')
  })

  it('只有精简二级库权限时落到精简二级库 tab', () => {
    expect(visibleNavFeatureKeys(can(['lite:read']))).toEqual([
      'dashboard',
      'memos',
      'warehouse_lite',
    ])
  })

  it('工作台 / 备忘录不设门禁：无任何权限也可见', () => {
    expect(visibleNavFeatureKeys(can([]))).toEqual(['dashboard', 'memos'])
  })

  it('系统管理权限不额外放开销模块主 tab', () => {
    expect(visibleNavFeatureKeys(can(['system:admin']))).toEqual(['dashboard', 'memos'])
  })

  it('写权限位不影响主 tab（写权限在保存时已自动带读权限）', () => {
    expect(visibleNavFeatureKeys(can(['warehouse:write']))).toEqual(['dashboard', 'memos'])
  })

  it('NAV_FEATURES 数量保持 9 个主 tab', () => {
    expect(NAV_FEATURES).toHaveLength(9)
  })
})

describe('落地页推导（utils/navigation）', () => {
  it('默认落工作台', () => {
    expect(resolveLandingRouteName(can(ALL_READ))).toBe('dashboard')
  })

  it('工作台不设权限门禁，任何权限组合都落工作台', () => {
    expect(resolveLandingRouteName(can([]))).toBe('dashboard')
    expect(resolveLandingRouteName(can(['system:admin']))).toBe('dashboard')
    expect(resolveLandingRouteName(can(['lite:read']))).toBe('dashboard')
  })
})
