/**
 * 「申购计划 ⇄ 申购记录」单条互转的回归守卫。
 *
 * 详情页已删除，原来只存在于详情页上的两个按钮现在只能从列表页的详情弹窗进入：
 * - 申购计划详情弹窗：「转入申购记录」（已有物料编码、尚未转入、且有写权限时才出现）
 * - 申购记录详情弹窗：「转为申购计划」
 * 弹窗化以后这两条链路很容易静默丢失（按钮还在、接口没调、跳转丢了都会「看着没报错」），
 * 所以这里按用户路径整条跑一遍：打开详情弹窗 → 点按钮 → 填弹窗/过确认 → 调接口 →
 * 落到对方详情弹窗（列表页 + `?detail=<id>`）。
 */
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import * as naiveUi from 'naive-ui'
import { NButton, NDialogProvider, NForm, NMessageProvider, NModal } from 'naive-ui'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'
import { defineComponent, h, nextTick } from 'vue'
import type { PurchaseMaterial, PurchaseRecord } from '@/api/generated'
import { procurementApi } from '@/api/procurement'
import { aiSearchApi } from '@/api/aiSearch'
import { useAuthStore } from '@/stores/auth'
import PurchaseMaterialsView from './PurchaseMaterialsView.vue'
import PurchaseRequestsView from './PurchaseRequestsView.vue'

vi.mock('@/api/procurement', () => ({
  procurementApi: {
    materials: vi.fn(),
    material: vi.fn(),
    materialFilterOptions: vi.fn(),
    materialCodeExists: vi.fn(),
    createMaterial: vi.fn(),
    updateMaterial: vi.fn(),
    deleteMaterial: vi.fn(),
    batchUpdateMaterials: vi.fn(),
    movePlanToRecord: vi.fn(),
    batchMovePlansToRecord: vi.fn(),
    records: vi.fn(),
    record: vi.fn(),
    recordFilterOptions: vi.fn(),
    updateRecord: vi.fn(),
    batchUpdateRecords: vi.fn(),
    restoreRecordToPlan: vi.fn(),
  },
}))

vi.mock('@/api/aiSearch', () => ({
  aiSearchApi: { status: vi.fn(), expand: vi.fn() },
}))

const api = vi.mocked(procurementApi)
const aiApi = vi.mocked(aiSearchApi)

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
    id: 1,
    plan_no: 'PLAN-20260925-001',
    plan_date: '2026-09-25',
    material_code: 'E011-00237',
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

const record = (overrides: Partial<PurchaseRecord> = {}): PurchaseRecord =>
  ({
    line_id: 7,
    purchase_request_id: 5,
    purchase_material_id: 1,
    plan_no: 'PLAN-20260925-001',
    plan_date: '2026-09-25',
    purchase_order_no: 'SG20260925001',
    trace_no: '',
    contract_no: '',
    vessel_no: '',
    consolidation_date: null,
    consolidation_port: '',
    sailing_date: null,
    contract_sign_date: null,
    purchase_date: '2026-09-26',
    status: '已申购',
    material_code: 'E011-00237',
    category: '备品备件',
    demand_department: '检修维护部电气自动化车间',
    material_name: '交流接触器',
    model_spec: 'CJX2-2510 AC220V',
    unit_name: '个',
    purchase_qty: '12',
    actual_demand_person: '李建军',
    purchase_responsible: '吴德海',
    salesperson: '张三',
    subitem_no: '',
    usage: '启停控制回路',
    plan_remark: '',
    record_remark: '',
    stock_material_id: null,
    images: [],
    created_at: '2026-09-26T01:00:00Z',
    updated_at: '2026-09-26T02:00:00Z',
    version: 2,
    ...overrides,
  }) as PurchaseRecord

let wrapper: VueWrapper | null = null

const PLAN_FILTER_OPTIONS = {
  actual_demand_persons: [],
  purchase_responsibles: [],
  subitem_nos: [],
  categories: [],
  demand_departments: [],
  usages: [],
  statuses: [],
  salespersons: [],
}

const RECORD_FILTER_OPTIONS = {
  categories: [],
  demand_departments: [],
  actual_demand_persons: [],
  purchase_responsibles: [],
  salespersons: [],
  statuses: [],
  subitem_nos: [],
  usages: [],
}

/** 让计划列表加载出一条计划，并把它的详情弹窗准备好（深链 `?detail=1` 打开）。 */
function mockPlanList(rows: PurchaseMaterial[], detail = rows[0]) {
  api.materials.mockResolvedValue({
    items: rows,
    page: 1,
    page_size: 20,
    total: rows.length,
  } as never)
  api.materialFilterOptions.mockResolvedValue(PLAN_FILTER_OPTIONS as never)
  api.materialCodeExists.mockResolvedValue({ exists: true } as never)
  if (detail) api.material.mockResolvedValue(detail)
}

/** 让记录列表加载出一条记录，并把它的详情弹窗准备好（深链 `?detail=7` 打开）。 */
function mockRecordList(rows: PurchaseRecord[], detail = rows[0]) {
  api.records.mockResolvedValue({
    items: rows,
    page: 1,
    page_size: 20,
    total: rows.length,
  } as never)
  api.recordFilterOptions.mockResolvedValue(RECORD_FILTER_OPTIONS as never)
  if (detail) api.record.mockResolvedValue(detail)
}

function hostFor(view: unknown) {
  return defineComponent({
    render: () =>
      h(NDialogProvider, null, {
        default: () => h(NMessageProvider, null, { default: () => h(view as never) }),
      }),
  })
}

/**
 * 挂载列表页并停在带 `?detail=` 的路由上——弹窗由 URL 驱动打开，
 * 因此这样既省掉「点行」的前置步骤，也顺带守住深链直达这条路。
 */
async function mountList(
  view: unknown,
  path: string,
  role: 'PURCHASE_ADMIN' | 'READ_ONLY',
): Promise<Router> {
  // auth store 在模块加载时固化了 localStorage 快照，直接写 store 的 user 才生效
  useAuthStore().user = { id: 7, username: 'tester', role } as never
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/procurement/materials', name: 'purchase-materials', component: { template: '' } },
      { path: '/procurement/records', name: 'purchase-records', component: { template: '' } },
    ],
  })
  await router.push(path)
  await router.isReady()
  wrapper = mount(hostFor(view), {
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
        FilterExpandButton: true,
        ColumnVisibilityPicker: true,
        ExportLoadingOverlay: true,
        ShareLinkDialog: true,
        PurchaseRecordHistoryDialog: true,
        SortableHeader: true,
      },
    },
  })
  await flushPromises()
  await flushPromises()
  return router
}

/** 读组件实例树（teleport 不影响实例树），按文案定位弹窗里的按钮。 */
function buttonLabels(): string[] {
  return wrapper!.findAllComponents(NButton).map((item) => item.text().trim())
}

async function clickButton(label: string) {
  const button = wrapper!.findAllComponents(NButton).find((item) => item.text().trim() === label)
  if (!button) throw new Error(`按钮「${label}」不存在，当前按钮：${buttonLabels().join(' / ')}`)
  await button.trigger('click')
  await flushPromises()
}

/**
 * 当前打开的详情弹窗。弹窗内容 teleport 到 body，因此：
 * - 文案断言读 `document.body`（实例树里 NModal 自己的 text() 是空的）；
 * - 组件断言（如 NForm 的 disabled）走实例树，且只取 `show=true` 的那个（隐藏弹窗
 *   不会渲染内容，`displayDirective` 默认为 `if`）。
 */
function detailModal(): VueWrapper {
  const modals = wrapper!.findAllComponents(NModal).filter((item) => item.props('show') === true)
  expect(modals.length).toBe(1)
  return modals[0]
}

function bodyText(): string {
  return document.body.textContent ?? ''
}

/** naive 的确认弹窗渲染在 body 上，按钮文案即正/负文案。 */
async function clickDialogButton(label: string) {
  const button = Array.from(document.body.querySelectorAll('.n-dialog button')).find((item) =>
    item.textContent?.includes(label),
  )
  if (!button) {
    throw new Error(
      `确认弹窗按钮「${label}」不存在，当前：${Array.from(
        document.body.querySelectorAll('.n-dialog button'),
      ).map((item) => item.textContent)}`,
    )
  }
  ;(button as HTMLButtonElement).click()
  await flushPromises()
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
  aiApi.status.mockResolvedValue({ available: false } as never)
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  document.body.innerHTML = ''
  localStorage.clear()
})

describe('申购计划详情弹窗 →「转入申购记录」（原详情页能力）', () => {
  async function openPlanDetail(role: 'PURCHASE_ADMIN' | 'READ_ONLY' = 'PURCHASE_ADMIN') {
    mockPlanList([plan()])
    return {
      router: await mountList(PurchaseMaterialsView, '/procurement/materials?detail=1', role),
    }
  }

  it('弹窗里有「转入申购记录」，确认后调 movePlanToRecord 并落到新记录的详情弹窗', async () => {
    api.movePlanToRecord.mockResolvedValue(record({ line_id: 42 }))
    const { router } = await openPlanDetail()

    expect(bodyText()).toContain('申购计划详情')
    // 最后更新时间已移到标题右侧、不再带「最后更新：」前缀
    expect(bodyText()).toContain('2026/09/25 10:00:00')
    expect(bodyText()).not.toContain('最后更新')

    await clickButton('转入申购记录')
    // 转入弹窗：原详情页的那张表单（申购单号 / 状态 / 申购日期 / 记录备注都在）
    expect(bodyText()).toContain('计划信息将带入申购记录')
    expect(bodyText()).toContain('申购单号')
    expect(bodyText()).toContain('记录备注')

    await clickButton('确认转入')

    expect(api.movePlanToRecord).toHaveBeenCalledTimes(1)
    const [planId, payload] = api.movePlanToRecord.mock.calls[0]
    expect(planId).toBe(1)
    expect(payload.status).toBe('已申购')
    expect(payload.purchase_date).toMatch(/^\d{4}-\d{2}-\d{2}$/)

    // 转入后落到新记录的详情（列表页 + ?detail=），与原详情页的跳转一致
    expect(router.currentRoute.value.name).toBe('purchase-records')
    expect(router.currentRoute.value.query.detail).toBe('42')

    // 本页是 keepAlive 页，跳走后 watcher 仍会跑：不能拿记录的 line_id 去查申购计划，
    // 也不能把记录列表刚写进的 ?detail= 改写掉
    expect(api.material).toHaveBeenCalledTimes(1)
    expect(api.material).toHaveBeenCalledWith(1)
  })

  it('未编码的计划不出现「转入申购记录」（未编码物资不能转入）', async () => {
    const uncoded = plan({ material_code: null })
    mockPlanList([uncoded])
    await mountList(PurchaseMaterialsView, '/procurement/materials?detail=1', 'PURCHASE_ADMIN')

    expect(buttonLabels()).toContain('在新页面打开')
    expect(buttonLabels()).not.toContain('转入申购记录')
  })

  it('已转入记录的计划不再出现「转入申购记录」', async () => {
    const moved = plan({ moved_to_record: true })
    mockPlanList([moved])
    await mountList(PurchaseMaterialsView, '/procurement/materials?detail=1', 'PURCHASE_ADMIN')

    expect(buttonLabels()).not.toContain('转入申购记录')
  })

  it('只读角色：字段禁用、页脚不显示保存 / 删除 / 转入申购记录', async () => {
    await openPlanDetail('READ_ONLY')

    expect(detailModal().findComponent(NForm).props('disabled')).toBe(true)
    const labels = buttonLabels()
    expect(labels).not.toContain('保存')
    expect(labels).not.toContain('删除')
    expect(labels).not.toContain('转入申购记录')
    expect(labels).toContain('取消')
    // 只读正是看详情的主要场景：更新时间不能因为无写权限就不显示
    expect(bodyText()).toContain('2026/09/25 10:00:00')
  })
})

describe('申购记录详情弹窗 →「转为申购计划」（原详情页能力）', () => {
  async function openRecordDetail(role: 'PURCHASE_ADMIN' | 'READ_ONLY' = 'PURCHASE_ADMIN') {
    mockRecordList([record()])
    return { router: await mountList(PurchaseRequestsView, '/procurement/records?detail=7', role) }
  }

  it('弹窗里有「转为申购计划」与右上角更新时间，确认后调接口并落到新计划的详情弹窗', async () => {
    api.restoreRecordToPlan.mockResolvedValue(plan({ id: 99 }))
    const { router } = await openRecordDetail()

    expect(bodyText()).toContain('申购记录详情')
    // 最后更新时间已移到标题右侧、不再带「最后更新：」前缀
    expect(bodyText()).toContain('2026/09/26 10:00:00')
    expect(bodyText()).not.toContain('最后更新')
    expect(buttonLabels()).toContain('转为申购计划')

    await clickButton('转为申购计划')
    await nextTick()
    await clickDialogButton('确定')

    expect(api.restoreRecordToPlan).toHaveBeenCalledTimes(1)
    // 版本号走 If-Match，必须带上当前记录的 version
    expect(api.restoreRecordToPlan.mock.calls[0][0]).toBe(7)
    expect(api.restoreRecordToPlan.mock.calls[0][1]).toBe(2)

    expect(router.currentRoute.value.name).toBe('purchase-materials')
    expect(router.currentRoute.value.query.detail).toBe('99')

    // 本页是 keepAlive 页，跳走后 watcher 仍会跑：不能拿计划的 id 去查申购记录，
    // 也不能把计划列表刚写进的 ?detail= 改写掉（两个 id 空间独立，极易命中另一条记录）
    expect(api.record).toHaveBeenCalledTimes(1)
    expect(api.record).toHaveBeenCalledWith(7)
  })

  it('取消确认弹窗不会调接口', async () => {
    await openRecordDetail()

    await clickButton('转为申购计划')
    await nextTick()
    await clickDialogButton('取消')

    expect(api.restoreRecordToPlan).not.toHaveBeenCalled()
  })

  it('只读角色：字段禁用、页脚不显示保存 / 转为申购计划 / 再次申购', async () => {
    await openRecordDetail('READ_ONLY')

    expect(detailModal().findComponent(NForm).props('disabled')).toBe(true)
    const labels = buttonLabels()
    expect(labels).not.toContain('保存')
    expect(labels).not.toContain('转为申购计划')
    expect(labels).not.toContain('再次申购')
    expect(labels).toContain('取消')
    // 只读正是看详情的主要场景：更新时间不能因为无写权限就不显示
    expect(bodyText()).toContain('2026/09/26 10:00:00')
  })
})
