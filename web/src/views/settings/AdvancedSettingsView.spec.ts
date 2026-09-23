import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
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

/**
 * 「后台」分组里某个主 tab 的可见性下拉框：按 `n-form-item` 的 label 定位，
 * 与页面渲染结构一致（label 就是主 tab 名称）。
 */
function visibilitySelect(
  view: VueWrapper,
  label: string,
): VueWrapper<InstanceType<typeof NSelect>> {
  const item = view
    .findAllComponents(NFormItem)
    .find((formItem) => String(formItem.props('label')) === label)
  expect(item, `未找到「${label}」的可见性下拉框`).toBeTruthy()
  const select = item!.findComponent(NSelect)
  expect(select.exists()).toBe(true)
  return select
}

/** 某个主 tab 下拉框里当前显示的文字（「显示」/「隐藏」）。 */
function visibleLabel(view: VueWrapper, label: string): string {
  return visibilitySelect(view, label).text().trim()
}

/** 某个主 tab 当前是否选中「显示」。 */
function isVisible(view: VueWrapper, label: string): boolean {
  return visibleLabel(view, label) === '显示'
}

/**
 * 改某个主 tab 的可见性。
 *
 * jsdom 里展开 naive-ui 下拉面板要跑 vueuc 虚拟列表（依赖 `window.matchMedia`），所以这里不进面板
 * 点选项，而是直接触发 `v-model:value` 对应的 `update:value` 事件。选项本身（显示 / 隐藏）
 * 在同组第一条用例里按 `options` 断言。
 */
async function chooseVisibility(view: VueWrapper, label: string, visible: boolean) {
  // 等价于在面板里选中该选项：`v-model:value` 绑定走的就是 `update:value` 事件
  visibilitySelect(view, label).vm.$emit('update:value', visible)
  await flushPromises()
}

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
  it('每个主 tab 一个「显示 / 隐藏」下拉框，且不含系统管理', async () => {
    const view = await mountView()

    for (const feature of NAV_FEATURES) {
      const select = visibilitySelect(view, feature.label)
      expect(select.props('options')).toEqual([
        { label: '显示', value: true },
        { label: '隐藏', value: false },
      ])
      expect(select.text().trim()).toBe('显示')
    }
    // 系统管理固定显示，不参与可见性配置（不是开关，也不出现在下拉框列表里）
    const labels = view
      .findAllComponents(NFormItem)
      .map((formItem) => String(formItem.props('label')))
    expect(labels).not.toContain('系统管理')
    expect(labels).not.toContain('可见功能')
  })

  it('保存时把 web_features 与其它配置一并提交', async () => {
    const reloadTimer = stubReloadTimer()
    const view = await mountView()
    await chooseVisibility(view, '工作管理', false)
    await clickSave(view)

    expect(aiSearchApi.updateSettings).toHaveBeenCalledTimes(1)
    expect(vi.mocked(aiSearchApi.updateSettings).mock.calls[0][0]).toMatchObject({
      web_features: { ...ALL_NAV_FEATURES_VISIBLE, work: false },
      version: 1,
    })
    reloadTimer.mockRestore()
  })

  it('全部选隐藏时给出提示且不发保存请求', async () => {
    const view = await mountView()
    for (const feature of NAV_FEATURES) {
      await chooseVisibility(view, feature.label, false)
    }
    await clickSave(view)

    expect(aiSearchApi.updateSettings).not.toHaveBeenCalled()
    expect(document.body.textContent).toContain('至少保留一个可见的主 tab')
  })

  it('读取到的已隐藏配置会回显在下拉框上', async () => {
    const view = await mountView(
      settings({ web_features: { ...ALL_NAV_FEATURES_VISIBLE, memos: false, ledger: false } }),
    )

    expect(isVisible(view, '备忘录')).toBe(false)
    expect(isVisible(view, '台账管理')).toBe(false)
    expect(isVisible(view, '工作台')).toBe(true)
    expect(isVisible(view, '工作管理')).toBe(true)
  })
})
