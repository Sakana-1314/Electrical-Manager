/**
 * 未编码物资 → 申购计划详情：**本页弹窗**，不再跳转申购计划列表。
 *
 * 以前的实现点击行后先弹「确认打开申购计划详情吗？」再 `router.push` 到申购计划列表的
 * `?detail=` 弹窗；改为复用 `PurchasePlanDetailModal` 后，一旦有人把跳转改回来（或把
 * `rowProps` 接回确认框），行为会静默退回旧交互，所以这里按用户路径守住接线：
 * 点行 → 本页出现详情弹窗、路由不变、不再按 id 回查计划。
 */
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import * as naiveUi from 'naive-ui'
import { NDataTable, NDialogProvider, NMessageProvider } from 'naive-ui'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'
import { defineComponent, h } from 'vue'
import type { PurchaseMaterial } from '@/api/generated'
import { procurementApi } from '@/api/procurement'
import { useAuthStore } from '@/stores/auth'
import PurchasePlanDetailModal from '@/components/PurchasePlanDetailModal.vue'
import UncodedMaterialsView from './UncodedMaterialsView.vue'

vi.mock('@/api/procurement', () => ({
  procurementApi: {
    uncodedMaterials: vi.fn(),
    material: vi.fn(),
    materialCodeExists: vi.fn(),
    updateMaterial: vi.fn(),
    deleteMaterial: vi.fn(),
    createMaterial: vi.fn(),
    movePlanToRecord: vi.fn(),
  },
}))

const api = vi.mocked(procurementApi)

// jsdom 缺少 NDataTable 依赖的观测 API。
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver

/** 单测未启用 unplugin-vue-components，模板里的 n-* 需要显式注册。 */
const naiveComponents = Object.fromEntries(
  Object.entries(naiveUi).filter(([name, value]) => /^N[A-Z]/.test(name) && value !== null),
) as Record<string, never>

const plan = (overrides: Partial<PurchaseMaterial> = {}): PurchaseMaterial =>
  ({
    id: 11,
    plan_no: 'PLAN-20260925-011',
    plan_date: '2026-09-25',
    material_code: null,
    category: '备品备件',
    urgency: '一般',
    demand_department: '检修维护部电气自动化车间',
    name: '交流接触器',
    model_spec: 'CJX2-2510 AC220V',
    unit_name: '个',
    actual_demand_person: '李建军',
    purchase_responsible: '吴德海',
    planned_qty: '12',
    usage: '启停控制回路',
    subitem_no: '',
    remark: '',
    stock_material_id: null,
    status: '待申购',
    moved_to_record: false,
    images: [],
    created_at: '2026-09-25T01:00:00Z',
    updated_at: '2026-09-25T02:00:00Z',
    version: 3,
    ...overrides,
  }) as PurchaseMaterial

let wrapper: VueWrapper | null = null

function hostFor(view: unknown) {
  return defineComponent({
    render: () =>
      h(NDialogProvider, null, {
        default: () => h(NMessageProvider, null, { default: () => h(view as never) }),
      }),
  })
}

async function mountView(): Promise<Router> {
  useAuthStore().user = {
    id: 7,
    username: 'tester',
    permissions: ['purchase:read', 'purchase:write'],
  } as never
  api.uncodedMaterials.mockResolvedValue({
    items: [plan()],
    page: 1,
    page_size: 20,
    total: 1,
  } as never)
  api.materialCodeExists.mockResolvedValue({ exists: false } as never)
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      {
        path: '/procurement/uncoded-materials',
        name: 'uncoded-materials',
        component: { template: '' },
      },
      { path: '/procurement/materials', name: 'purchase-materials', component: { template: '' } },
      { path: '/procurement/records', name: 'purchase-records', component: { template: '' } },
    ],
  })
  await router.push('/procurement/uncoded-materials')
  await router.isReady()
  wrapper = mount(hostFor(UncodedMaterialsView), {
    attachTo: document.body,
    global: {
      plugins: [router],
      components: naiveComponents,
      stubs: {
        ImageUploader: true,
        MaterialCodeSelector: true,
        MaterialSelector: true,
        QuantityInput: true,
        ImageThumbnails: true,
        ExportButton: true,
        ColumnVisibilityPicker: true,
        PurchaseRecordHistoryDialog: true,
      },
    },
  })
  await flushPromises()
  await flushPromises()
  return router
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  document.body.innerHTML = ''
  localStorage.clear()
})

describe('未编码物资 → 申购计划详情', () => {
  it('点击行在本页弹出详情弹窗，不跳转到申购计划列表', async () => {
    const router = await mountView()
    const table = wrapper!.findComponent(NDataTable)
    const rowProps = table.props('rowProps') as (row: PurchaseMaterial) => {
      onClick: (event: MouseEvent) => void
    }
    rowProps(plan()).onClick(new MouseEvent('click'))
    await flushPromises()

    // 详情弹窗在本页打开：标题与行数据都在
    expect(document.body.textContent).toContain('申购计划详情')
    expect(document.body.textContent).toContain('交流接触器')
    expect(wrapper!.findComponent(PurchasePlanDetailModal).props('show')).toBe(true)
    // 没有跳去申购计划列表，也没有按 id 回查计划（数据直接用列表行）
    expect(router.currentRoute.value.name).toBe('uncoded-materials')
    expect(api.material).not.toHaveBeenCalled()
  })

  it('关闭弹窗后仍停留在未编码物资页', async () => {
    const router = await mountView()
    const table = wrapper!.findComponent(NDataTable)
    const rowProps = table.props('rowProps') as (row: PurchaseMaterial) => {
      onClick: (event: MouseEvent) => void
    }
    rowProps(plan()).onClick(new MouseEvent('click'))
    await flushPromises()

    // 详情弹窗的「取消」只关弹窗，不产生路由跳转
    const cancel = Array.from(document.body.querySelectorAll('button')).find(
      (item) => item.textContent?.trim() === '取消',
    )
    expect(cancel).toBeDefined()
    ;(cancel as HTMLButtonElement).click()
    await flushPromises()

    expect(wrapper!.findComponent(PurchasePlanDetailModal).props('show')).toBe(false)
    expect(router.currentRoute.value.name).toBe('uncoded-materials')
  })
})
