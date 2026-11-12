import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { NButton, NCard, NCheckbox, NForm, NFormItem, NMessageProvider, NSwitch } from 'naive-ui'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import type { AdvancedSettings } from '@/api/generated'
import { systemSettingsApi } from '@/api/systemSettings'
import { permissionApi } from '@/api/dictionaries'
import AdvancedSettingsView from './AdvancedSettingsView.vue'

vi.mock('@/api/dictionaries', () => ({
  permissionApi: { list: vi.fn() },
}))

vi.mock('@/api/systemSettings', () => ({
  systemSettingsApi: {
    advancedSettings: vi.fn(),
    updateAdvancedSettings: vi.fn(),
  },
}))

const settings = (overrides: Partial<AdvancedSettings> = {}): AdvancedSettings => ({
  mini_program_registration_enabled: true,
  mini_program_new_user_enabled: true,
  secondary_warehouse_mode: 'full',
  default_permissions: ['warehouse:read', 'purchase:read', 'huaxing:read'],
  updated_at: '2026-09-13T10:30:00+08:00',
  version: 1,
  ...overrides,
})

const Host = defineComponent({
  render: () => h(NMessageProvider, null, { default: () => h(AdvancedSettingsView) }),
})

let wrapper: VueWrapper | null = null

async function mountView(data: AdvancedSettings = settings()): Promise<VueWrapper> {
  vi.mocked(permissionApi.list).mockResolvedValue([])
  vi.mocked(systemSettingsApi.advancedSettings).mockResolvedValue(data)
  vi.mocked(systemSettingsApi.updateAdvancedSettings).mockResolvedValue(data)
  wrapper = mount(Host, {
    attachTo: document.body,
    global: {
      // 单测环境未启用 unplugin-vue-components，需显式注册模板里的 n-* 组件。
      components: { NButton, NCard, NCheckbox, NForm, NFormItem, NMessageProvider, NSwitch },
    },
  })
  await flushPromises()
  return wrapper
}

function switchByLabel(view: VueWrapper, label: string): VueWrapper<InstanceType<typeof NSwitch>> {
  const item = view
    .findAllComponents(NFormItem)
    .find((formItem) => String(formItem.props('label')) === label)
  expect(item, `未找到「${label}」开关`).toBeTruthy()
  const toggle = item!.findComponent(NSwitch)
  expect(toggle.exists()).toBe(true)
  return toggle
}

async function toggle(view: VueWrapper, label: string, value: boolean) {
  switchByLabel(view, label).vm.$emit('update:value', value)
  await flushPromises()
}

/** 保存成功后组件会 setTimeout 600ms 刷新整页；拦掉这一个定时器。 */
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

describe('AdvancedSettingsView（开关与默认权限）', () => {
  it('页面只有三个开关，不再有模型 / 图片 / Webhook 配置', async () => {
    const view = await mountView()

    const labels = view
      .findAllComponents(NFormItem)
      .map((formItem) => String(formItem.props('label')))
    expect(labels).toEqual(['新用户绑定', '新用户默认状态', '使用精简模式'])
    expect(view.text()).not.toContain('API Key')
    expect(view.text()).not.toContain('Webhook')
    expect(view.text()).not.toContain('图片加速')
  })

  it('保存时提交三个开关与二级库运行模式', async () => {
    const reloadTimer = stubReloadTimer()
    const view = await mountView()
    await toggle(view, '新用户绑定', false)
    await toggle(view, '新用户默认状态', false)
    await toggle(view, '使用精简模式', true)
    await clickSave(view)

    expect(systemSettingsApi.updateAdvancedSettings).toHaveBeenCalledTimes(1)
    expect(vi.mocked(systemSettingsApi.updateAdvancedSettings).mock.calls[0][0]).toEqual({
      mini_program_registration_enabled: false,
      mini_program_new_user_enabled: false,
      secondary_warehouse_mode: 'lite',
      default_permissions: ['warehouse:read', 'purchase:read', 'huaxing:read'],
      version: 1,
    })
    reloadTimer.mockRestore()
  })

  it('精简模式读取时回显为开关打开', async () => {
    const view = await mountView(settings({ secondary_warehouse_mode: 'lite' }))
    expect(switchByLabel(view, '使用精简模式').props('value')).toBe(true)
  })
})
