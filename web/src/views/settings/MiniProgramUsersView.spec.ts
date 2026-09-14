import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import {
  NAlert,
  NButton,
  NCard,
  NDataTable,
  NDialogProvider,
  NEllipsis,
  NForm,
  NFormItem,
  NInput,
  NMessageProvider,
  NModal,
  NSelect,
  NSpace,
  NSwitch,
  NTag,
} from 'naive-ui'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import type { MiniProgramUser } from '@/api/generated'
import { dictionaryApi } from '@/api/dictionaries'
import MiniProgramUsersView from './MiniProgramUsersView.vue'

vi.mock('@/api/dictionaries', () => ({
  dictionaryApi: {
    miniProgramUsers: vi.fn(),
    updateMiniProgramUser: vi.fn(),
    deleteMiniProgramUser: vi.fn(),
    mergeMiniProgramUsers: vi.fn(),
  },
}))

const api = vi.mocked(dictionaryApi)

// jsdom 没有 ResizeObserver，naive-ui 的 NDataTable 会用到它来测量列宽。
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver

const user = (overrides: Partial<MiniProgramUser> = {}): MiniProgramUser => ({
  id: 1,
  display_name: '孙浩宇',
  department_name: '华星检修维护部电气车间',
  enabled: true,
  last_used_at: '2026-09-13T01:12:00Z',
  identities: [
    {
      id: 11,
      app_id: 'wx-test-primary',
      wechat_openid: 'oHXNI-9f3c1d2a8b7e4f5c',
      created_at: '2026-08-14T02:20:00Z',
    },
  ],
  created_at: '2026-08-14T02:20:00Z',
  updated_at: '2026-08-14T02:20:00Z',
  version: 1,
  ...overrides,
})

const Host = defineComponent({
  render: () =>
    h(NMessageProvider, null, {
      default: () => h(NDialogProvider, null, { default: () => h(MiniProgramUsersView) }),
    }),
})

let wrapper: VueWrapper | null = null

async function mountView(users: MiniProgramUser[]): Promise<VueWrapper> {
  api.miniProgramUsers.mockResolvedValue({
    items: users,
    page: 1,
    page_size: 200,
    total: users.length,
  })
  wrapper = mount(Host, {
    attachTo: document.body,
    global: {
      // 单测环境未启用 unplugin-vue-components，需显式注册模板里的 n-* 组件。
      components: {
        NAlert,
        NButton,
        NCard,
        NDataTable,
        NDialogProvider,
        NEllipsis,
        NForm,
        NFormItem,
        NInput,
        NMessageProvider,
        NModal,
        NSelect,
        NSpace,
        NSwitch,
        NTag,
      },
    },
  })
  await flushPromises()
  return wrapper
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  document.body.innerHTML = ''
})

describe('MiniProgramUsersView 最近使用时间', () => {
  it('按东八区展示最近使用时间，历史数据（无记录）显示占位符', async () => {
    const view = await mountView([
      user({ id: 1, display_name: '孙浩宇' }),
      user({
        id: 2,
        display_name: '李建军',
        created_at: '2026-08-15T02:20:00Z',
        last_used_at: null,
      }),
    ])

    const text = view.text()
    expect(text).toContain('最近使用时间')
    // 01:12Z → 东八区 09:12；注册时间列仍按原样展示。
    expect(text).toContain('2026/08/14 10:20:00')
    expect(text).toMatch(/2026\/09\/13\s*09:12/)
    // last_used_at 为 null（本字段上线前建档）时展示占位符，不报错也不显示空单元格。
    expect(text).toContain('—')
  })
})
