import { describe, expect, it } from 'vitest'
import {
  ALL_NAV_FEATURES_VISIBLE,
  NAV_FEATURES,
  isNavFeatureVisible,
  resolveLandingRouteName,
  visibleNavFeatureKeys,
} from './navigation'
import type { WebFeatureVisibility } from '@/api/generated'

/** 造一份「隐藏指定主 tab，其余可见」的可见性配置。 */
const flags = (hidden: Array<keyof WebFeatureVisibility> = []): WebFeatureVisibility => ({
  ...ALL_NAV_FEATURES_VISIBLE,
  ...Object.fromEntries(hidden.map((key) => [key, false])),
})

const allHidden = Object.fromEntries(
  NAV_FEATURES.map((feature) => [feature.key, false]),
) as WebFeatureVisibility

describe('主 tab 可见性（utils/navigation）', () => {
  it('缺省全可见：包含 8 个主 tab 且不含系统管理', () => {
    expect(visibleNavFeatureKeys(ALL_NAV_FEATURES_VISIBLE)).toEqual([
      'dashboard',
      'memos',
      'warehouse',
      'huaxing_inventory',
      'procurement',
      'hazards',
      'ledger',
      'work',
    ])
  })

  it('隐藏单个主 tab 后不再出现在可见列表里，其余顺序不变', () => {
    const keys = visibleNavFeatureKeys(flags(['work']))
    expect(keys).not.toContain('work')
    expect(keys[0]).toBe('dashboard')
    expect(isNavFeatureVisible(flags(['work']), 'work')).toBe(false)
    expect(isNavFeatureVisible(flags(['work']), 'ledger')).toBe(true)
  })

  it('缺字段（旧服务端 / 回滚）按可见处理', () => {
    const partial = { warehouse: false } as WebFeatureVisibility
    expect(visibleNavFeatureKeys(partial)).toContain('dashboard')
    expect(visibleNavFeatureKeys(partial)).not.toContain('warehouse')
  })

  it('全部隐藏视为无效配置，回落全部可见（侧栏不会被关空）', () => {
    const keys = visibleNavFeatureKeys(allHidden)
    expect(keys).toHaveLength(NAV_FEATURES.length)
    expect(keys[0]).toBe('dashboard')
  })

  it('拉取失败（undefined / null）回落到全部可见', () => {
    expect(visibleNavFeatureKeys(undefined)).toHaveLength(NAV_FEATURES.length)
    expect(visibleNavFeatureKeys(null)).toHaveLength(NAV_FEATURES.length)
  })
})

describe('落地页推导（utils/navigation）', () => {
  const full = { isLiteMode: false }

  it('默认落工作台', () => {
    expect(resolveLandingRouteName(ALL_NAV_FEATURES_VISIBLE, full)).toBe('dashboard')
  })

  it('工作台隐藏后落下一个可见主 tab', () => {
    expect(resolveLandingRouteName(flags(['dashboard']), full)).toBe('memos')
    expect(resolveLandingRouteName(flags(['dashboard', 'memos']), full)).toBe('stock')
  })

  it('二级库在精简模式下落地到精简视图', () => {
    expect(resolveLandingRouteName(flags(['dashboard', 'memos']), { isLiteMode: true })).toBe(
      'warehouse-lite',
    )
  })

  it('全部隐藏时回落工作台', () => {
    expect(resolveLandingRouteName(allHidden, full)).toBe('dashboard')
  })
})
