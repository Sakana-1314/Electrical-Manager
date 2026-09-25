import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import {
  NButton,
  NCard,
  NDataTable,
  NDialogProvider,
  NMessageProvider,
  NSpace,
  NTag,
} from 'naive-ui'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import { defineComponent, h } from 'vue'
import type { PurchasePlanTemplate } from '@/api/generated'
import { purchasePlanTemplateApi } from '@/api/purchasePlanTemplates'
import PurchasePlanTemplatesView from './PurchasePlanTemplatesView.vue'

vi.mock('@/api/purchasePlanTemplates', () => ({
  purchasePlanTemplateApi: {
    templates: vi.fn(),
    templateFilterOptions: vi.fn(),
    createTemplate: vi.fn(),
    updateTemplate: vi.fn(),
    deleteTemplate: vi.fn(),
    generatePurchasePlan: vi.fn(),
  },
}))

const api = vi.mocked(purchasePlanTemplateApi)

// jsdom 缺少 NDataTable 依赖的观测 API。
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver

const template = (overrides: Partial<PurchasePlanTemplate> = {}): PurchasePlanTemplate =>
  ({
    id: 1,
    plan_no: 'PLAN-20260805-001',
    plan_date: '2026-08-05',
    material_code: 'E011-00237',
    category: '备品备件',
    urgency: '一般',
    demand_department: '检修维护部电气自动化车间',
    name: '交流接触器',
    model_spec: 'CJX2-2510 AC220V',
    unit_name: '个',
    planned_qty: '12',
    actual_demand_person: '李建军',
    purchase_responsible: '吴德海',
    subitem_no: '201',
    usage: '启停控制回路',
    remark: '',
    images: [],
    created_at: '2026-08-05T01:00:00Z',
    version: 1,
    ...overrides,
  }) as PurchasePlanTemplate

const Host = defineComponent({
  render: () =>
    h(NDialogProvider, null, {
      default: () => h(NMessageProvider, null, { default: () => h(PurchasePlanTemplatesView) }),
    }),
})

let wrapper: VueWrapper | null = null

async function mountView(rows: PurchasePlanTemplate[]): Promise<VueWrapper> {
  api.templates.mockResolvedValue({ items: rows, page: 1, page_size: 20, total: rows.length })
  api.templateFilterOptions.mockResolvedValue({
    categories: [],
    demand_departments: [],
    actual_demand_persons: [],
    purchase_responsibles: [],
    subitem_nos: [],
    usages: [],
  } as never)
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/', name: 'purchase-plan-templates', component: Host }],
  })
  await router.push('/')
  await router.isReady()
  wrapper = mount(Host, {
    attachTo: document.body,
    global: {
      // 单测环境未启用 unplugin-vue-components，需显式注册模板里的 n-* 组件。
      plugins: [router],
      components: { NButton, NCard, NDataTable, NDialogProvider, NMessageProvider, NSpace, NTag },
      stubs: { ImageUploader: true, MaterialCodeSelector: true, MaterialSelector: true },
    },
  })
  await flushPromises()
  await flushPromises()
  return wrapper
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  document.body.innerHTML = ''
})

describe('周期性计划列表的数量列', () => {
  it('计划数量与计量单位合并为一列「数量」，单元格显示「12 个」', async () => {
    const view = await mountView([template()])

    // 表头只有「数量」，不再有「计划数量」「计量单位」两列
    const headers = view.findAll('th').map((cell) => cell.text())
    expect(headers).toContain('数量')
    expect(headers).not.toContain('计划数量')
    expect(headers).not.toContain('计量单位')

    // 单元格把数量与单位拼在一起（从「数量」列的索引取该单元格文本，避免被其它列干扰）
    const quantityIndex = headers.indexOf('数量')
    const bodyCells = view.findAll('tbody tr')[0].findAll('td')
    expect(bodyCells[quantityIndex].text()).toBe('12个')
  })

  it('单位缺失时只显示数量，不显示 undefined', async () => {
    const view = await mountView([template({ planned_qty: '8', unit_name: '' })])

    expect(view.text()).toContain('8')
    expect(view.text()).not.toContain('undefined')
    expect(view.text()).not.toContain('8undefined')
  })
})
