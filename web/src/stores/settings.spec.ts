import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useSettingsStore } from './settings'
import { systemSettingsApi } from '@/api/systemSettings'
import type { MiniProgramFeatures } from '@/api/generated'
import { ALL_NAV_FEATURES_VISIBLE } from '@/utils/navigation'

vi.mock('@/api/systemSettings', () => ({
  systemSettingsApi: {
    miniProgramFeatures: vi.fn(),
  },
}))

const fullFeatures = {
  inventory_mode: 'read_write',
  huaxing_inventory_mode: 'query_only',
  purchase_plans_mode: 'query_only',
  purchase_records_mode: 'query_only',
  material_codes_mode: 'query_only',
  ledger_mode: 'query_only',
  hazards_mode: 'read_write',
  secondary_warehouse_mode: 'full',
  web_features: { ...ALL_NAV_FEATURES_VISIBLE },
} as const

describe('settings store（二级库模式）', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.mocked(systemSettingsApi.miniProgramFeatures).mockReset()
  })

  it('未加载时默认完整模式', () => {
    const store = useSettingsStore()
    expect(store.secondaryWarehouseMode).toBe('full')
    expect(store.isLiteMode).toBe(false)
  })

  it('load 后按返回模式更新 isLiteMode（精简模式）', async () => {
    vi.mocked(systemSettingsApi.miniProgramFeatures).mockResolvedValue({
      ...fullFeatures,
      secondary_warehouse_mode: 'lite',
    })
    const store = useSettingsStore()
    await store.load()
    expect(store.secondaryWarehouseMode).toBe('lite')
    expect(store.isLiteMode).toBe(true)
    expect(store.loaded).toBe(true)
  })

  it('load 后为完整模式时 isLiteMode 为 false', async () => {
    vi.mocked(systemSettingsApi.miniProgramFeatures).mockResolvedValue(fullFeatures)
    const store = useSettingsStore()
    await store.load()
    expect(store.secondaryWarehouseMode).toBe('full')
    expect(store.isLiteMode).toBe(false)
  })

  it('拉取失败回退完整模式', async () => {
    vi.mocked(systemSettingsApi.miniProgramFeatures).mockRejectedValue(new Error('network'))
    const store = useSettingsStore()
    await store.load()
    expect(store.secondaryWarehouseMode).toBe('full')
    expect(store.isLiteMode).toBe(false)
  })

  it('只拉取一次', async () => {
    vi.mocked(systemSettingsApi.miniProgramFeatures).mockResolvedValue(fullFeatures)
    const store = useSettingsStore()
    await store.load()
    await store.load()
    expect(systemSettingsApi.miniProgramFeatures).toHaveBeenCalledTimes(1)
  })
})

describe('settings store（后台主 tab 可见性）', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.mocked(systemSettingsApi.miniProgramFeatures).mockReset()
  })

  it('未加载时全部可见', () => {
    const store = useSettingsStore()
    expect(store.isFeatureVisible('work')).toBe(true)
    expect(store.isFeatureVisible('dashboard')).toBe(true)
  })

  it('load 后按返回的 web_features 隐藏对应主 tab', async () => {
    vi.mocked(systemSettingsApi.miniProgramFeatures).mockResolvedValue({
      ...fullFeatures,
      web_features: { ...ALL_NAV_FEATURES_VISIBLE, work: false, hazards: false },
    })
    const store = useSettingsStore()
    await store.load()
    expect(store.isFeatureVisible('work')).toBe(false)
    expect(store.isFeatureVisible('hazards')).toBe(false)
    expect(store.isFeatureVisible('ledger')).toBe(true)
  })

  it('全部隐藏（无效配置）回落全部可见', async () => {
    vi.mocked(systemSettingsApi.miniProgramFeatures).mockResolvedValue({
      ...fullFeatures,
      web_features: {
        dashboard: false,
        memos: false,
        warehouse: false,
        huaxing_inventory: false,
        procurement: false,
        hazards: false,
        ledger: false,
        work: false,
      },
    })
    const store = useSettingsStore()
    await store.load()
    expect(store.isFeatureVisible('dashboard')).toBe(true)
    expect(store.isFeatureVisible('work')).toBe(true)
  })

  it('响应缺 web_features（旧服务端）回落全部可见', async () => {
    // 模拟旧服务端：响应里根本没有 web_features 字段
    const legacy = { ...fullFeatures } as Record<string, unknown>
    delete legacy.web_features
    vi.mocked(systemSettingsApi.miniProgramFeatures).mockResolvedValue(
      legacy as unknown as MiniProgramFeatures,
    )
    const store = useSettingsStore()
    await store.load()
    expect(store.isFeatureVisible('work')).toBe(true)
  })

  it('拉取失败回落全部可见', async () => {
    vi.mocked(systemSettingsApi.miniProgramFeatures).mockRejectedValue(new Error('network'))
    const store = useSettingsStore()
    await store.load()
    expect(store.isFeatureVisible('work')).toBe(true)
    expect(store.isFeatureVisible('dashboard')).toBe(true)
  })
})
