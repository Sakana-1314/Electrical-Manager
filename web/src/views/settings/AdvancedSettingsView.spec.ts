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
  secondary_warehouse_mode: 'full',
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

/** 按 `n-form-item` 的 label 找下拉框（页面里只有「二级库运行模式」一个功能模式配置）。 */
function selectByLabel(view: VueWrapper, label: string): VueWrapper<InstanceType<typeof NSelect>> {
  const item = view
    .findAllComponents(NFormItem)
    .find((formItem) => String(formItem.props('label')) === label)
  expect(item, `未找到「${label}」下拉框`).toBeTruthy()
  const select = item!.findComponent(NSelect)
  expect(select.exists()).toBe(true)
  return select
}

/** 改二级库运行模式：直接触发 v-model 对应的 update:value（jsdom 不进下拉面板）。 */
async function chooseMode(view: VueWrapper, value: 'full' | 'lite') {
  selectByLabel(view, '运行模式').vm.$emit('update:value', value)
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

describe('AdvancedSettingsView 运行模式', () => {
  it('功能展示不再有配置项：只保留二级库运行模式', async () => {
    const view = await mountView()

    const select = selectByLabel(view, '运行模式')
    expect(select.props('options')).toEqual([
      { label: '完整模式', value: 'full' },
      { label: '精简模式', value: 'lite' },
    ])
    expect(select.text().trim()).toBe('完整模式')

    const labels = view
      .findAllComponents(NFormItem)
      .map((formItem) => String(formItem.props('label')))
    expect(labels).not.toContain('后台可见功能')
    expect(labels).not.toContain('二级库库存')
    expect(labels).not.toContain('隐患管理')
  })

  it('保存时只提交二级库运行模式，不再有功能开关字段', async () => {
    const reloadTimer = stubReloadTimer()
    const view = await mountView()
    await chooseMode(view, 'lite')
    await clickSave(view)

    expect(aiSearchApi.updateSettings).toHaveBeenCalledTimes(1)
    const payload = vi.mocked(aiSearchApi.updateSettings).mock.calls[0][0]
    expect(payload).toMatchObject({ secondary_warehouse_mode: 'lite', version: 1 })
    expect(payload).not.toHaveProperty('web_features')
    expect(payload).not.toHaveProperty('inventory_mode')
    expect(payload).not.toHaveProperty('ledger_mode')
    reloadTimer.mockRestore()
  })

  it('读取到的精简模式会回显在下拉框上', async () => {
    const view = await mountView(settings({ secondary_warehouse_mode: 'lite' }))
    expect(selectByLabel(view, '运行模式').text().trim()).toBe('精简模式')
  })
})
