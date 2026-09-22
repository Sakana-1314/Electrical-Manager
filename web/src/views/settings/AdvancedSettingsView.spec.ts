import { flushPromises, mount, type DOMWrapper, type VueWrapper } from '@vue/test-utils'
import {
  NButton,
  NCard,
  NCheckbox,
  NCheckboxGroup,
  NForm,
  NFormItem,
  NInput,
  NMessageProvider,
  NSelect,
  NSpace,
  NSwitch,
} from 'naive-ui'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import type { AiSearchSettings, WebhookChannelSettings } from '@/api/generated'
import { aiSearchApi } from '@/api/aiSearch'
import { systemSettingsApi } from '@/api/systemSettings'
import { ALL_NAV_FEATURES_VISIBLE, NAV_FEATURES } from '@/utils/navigation'
import AdvancedSettingsView from './AdvancedSettingsView.vue'

vi.mock('@/api/aiSearch', () => ({
  aiSearchApi: {
    settings: vi.fn(),
    updateSettings: vi.fn(),
    testSettings: vi.fn(),
  },
}))

vi.mock('@/api/systemSettings', () => ({
  systemSettingsApi: {
    webhooks: vi.fn(),
    updateWebhook: vi.fn(),
    testWebhook: vi.fn(),
  },
}))

const settings = (overrides: Partial<AiSearchSettings> = {}): AiSearchSettings => ({
  endpoint: 'https://api.example.test/v1',
  api_key: 'sk-test',
  model: 'gpt-4.1-mini',
  enabled: true,
  mini_program_code_env: 'release',
  mini_program_code_app_id: 'wx-test-primary',
  mini_program_app_ids: ['wx-test-primary'],
  mini_program_registration_enabled: true,
  mini_program_new_user_enabled: true,
  image_acceleration_server_url: '',
  inventory_mode: 'read_write',
  huaxing_inventory_mode: 'query_only',
  purchase_plans_mode: 'query_only',
  purchase_records_mode: 'query_only',
  material_codes_mode: 'query_only',
  hazards_mode: 'read_write',
  ledger_mode: 'query_only',
  secondary_warehouse_mode: 'full',
  web_features: { ...ALL_NAV_FEATURES_VISIBLE },
  updated_at: '2026-09-13T10:30:00+08:00',
  version: 1,
  ...overrides,
})

const Host = defineComponent({
  render: () => h(NMessageProvider, null, { default: () => h(AdvancedSettingsView) }),
})

let wrapper: VueWrapper | null = null

async function mountView(data: AiSearchSettings = settings()): Promise<VueWrapper> {
  vi.mocked(aiSearchApi.settings).mockResolvedValue(data)
  vi.mocked(aiSearchApi.updateSettings).mockResolvedValue(data)
  vi.mocked(systemSettingsApi.webhooks).mockResolvedValue([])
  vi.mocked(systemSettingsApi.updateWebhook).mockImplementation((platform) =>
    Promise.resolve({
      platform,
      enabled: false,
      subscribed_events: [],
      webhook_url: '',
      secret: '',
      webhook_configured: false,
      secret_configured: false,
      updated_at: null,
      version: 2,
    } satisfies WebhookChannelSettings),
  )
  wrapper = mount(Host, {
    attachTo: document.body,
    global: {
      // 单测环境未启用 unplugin-vue-components，需显式注册模板里的 n-* 组件。
      components: {
        NButton,
        NCard,
        NCheckbox,
        NCheckboxGroup,
        NForm,
        NFormItem,
        NInput,
        NMessageProvider,
        NSelect,
        NSpace,
        NSwitch,
      },
    },
  })
  await flushPromises()
  return wrapper
}

/** 「后台 → 可见功能」里的开关（不含模型服务、小程序与 Webhook 的开关，按 NAV_FEATURES 顺序）。 */
function visibilitySwitches(view: VueWrapper): DOMWrapper<Element>[] {
  return view.findAll('.visibility-grid .n-switch')
}

const isOn = (element: DOMWrapper<Element>) => element.classes().includes('n-switch--active')

/** 保存成功后组件会 setTimeout 600ms 刷新整页；拦掉这一个定时器，其余定时器保持原样。 */
function stubReloadTimer() {
  const original = window.setTimeout.bind(window)
  return vi.spyOn(window, 'setTimeout').mockImplementation(((
    handler: TimerHandler,
    timeout?: number,
    ...args: unknown[]
  ) => {
    if (typeof timeout === 'number' && timeout >= 600) return 0
    return original(handler as never, timeout, ...(args as []))
  }) as typeof window.setTimeout)
}

async function clickSave(view: VueWrapper) {
  const button = view.findAllComponents(NButton).find((item) => item.text() === '保存配置')
  expect(button).toBeDefined()
  await button?.trigger('click')
  await flushPromises()
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  document.body.innerHTML = ''
})

describe('AdvancedSettingsView 后台可见功能', () => {
  it('按主 tab 渲染开关，且不含系统管理', async () => {
    const view = await mountView()

    const switches = visibilitySwitches(view)
    expect(switches).toHaveLength(NAV_FEATURES.length)
    const grid = view.find('.visibility-grid').text()
    for (const feature of NAV_FEATURES) expect(grid).toContain(feature.label)
    // 系统管理固定显示，不参与开关（只在侧栏渲染，不出现在开关组里）
    expect(grid).not.toContain('系统管理')
    for (const item of switches) expect(isOn(item)).toBe(true)
  })

  it('保存时把 web_features 与其它配置一并提交', async () => {
    const reloadTimer = stubReloadTimer()
    const view = await mountView()
    const work = NAV_FEATURES.findIndex((feature) => feature.key === 'work')
    await visibilitySwitches(view)[work].trigger('click')
    await clickSave(view)

    expect(aiSearchApi.updateSettings).toHaveBeenCalledTimes(1)
    expect(vi.mocked(aiSearchApi.updateSettings).mock.calls[0][0]).toMatchObject({
      web_features: { ...ALL_NAV_FEATURES_VISIBLE, work: false },
      version: 1,
    })
    reloadTimer.mockRestore()
  })

  it('全部关闭时给出提示且不发保存请求', async () => {
    const view = await mountView()
    for (const item of visibilitySwitches(view)) await item.trigger('click')
    await clickSave(view)

    expect(aiSearchApi.updateSettings).not.toHaveBeenCalled()
    expect(document.body.textContent).toContain('至少保留一个可见的主 tab')
  })

  it('读取到的已隐藏配置会回显在开关上', async () => {
    const view = await mountView(
      settings({ web_features: { ...ALL_NAV_FEATURES_VISIBLE, memos: false, ledger: false } }),
    )

    const switches = visibilitySwitches(view)
    expect(switches.filter((item) => !isOn(item))).toHaveLength(2)
    const memos = NAV_FEATURES.findIndex((feature) => feature.key === 'memos')
    const ledger = NAV_FEATURES.findIndex((feature) => feature.key === 'ledger')
    expect(isOn(switches[memos])).toBe(false)
    expect(isOn(switches[ledger])).toBe(false)
    expect(isOn(switches[0])).toBe(true)
  })
})
