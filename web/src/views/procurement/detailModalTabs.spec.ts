/**
 * 详情弹窗内字段分组 tabs 的回归守卫。
 *
 * 申购计划 / 申购记录的字段多，详情弹窗按业务域拆成 tab（申购计划 3 个、申购记录 4 个）。
 * 拆 tab 后必填项会散落在不同 tab 上：保存时如果只把校验错误留在隐藏 tab 里，用户看不到
 * 任何提示，会误以为「保存没反应」。因此保存前要先定位缺必填项的 tab、自动切过去再提示。
 *
 * 这里按用户路径跑一遍：打开详情弹窗 → 切到后面的 tab → 清空必填项后点保存 →
 * 断言弹窗自动切回「物资信息」并给出提示。纯行为断言，不依赖具体模板结构。
 */
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import * as naiveUi from 'naive-ui'
import { NButton, NDialogProvider, NMessageProvider } from 'naive-ui'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'
import { defineComponent, h } from 'vue'
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

function hostFor(view: unknown) {
  return defineComponent({
    render: () =>
      h(NDialogProvider, null, {
        default: () => h(NMessageProvider, null, { default: () => h(view as never) }),
      }),
  })
}

/** 挂载列表页并停在带 `?detail=` 的路由上（详情弹窗由 URL 驱动打开）。 */
async function mountList(view: unknown, path: string): Promise<Router> {
  useAuthStore().user = {
    id: 7,
    username: 'tester',
    permissions: ['purchase:read', 'purchase:write'],
  } as never
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

function activeTabLabel(): string {
  return document.body.querySelector('.n-tabs-tab--active')?.textContent?.trim() ?? ''
}

function tabLabels(): string[] {
  return Array.from(document.body.querySelectorAll('.n-tabs-tab')).map(
    (item) => item.textContent?.trim() ?? '',
  )
}

/** 当前激活 tab 面板里各字段的表单标签（按 DOM 顺序）。 */
function activePaneFieldLabels(): string[] {
  const panes = Array.from(
    document.body.querySelectorAll<HTMLElement>('.n-card.n-modal .n-tab-pane'),
  )
  const pane = panes.find((item) => item.style.display !== 'none')
  if (!pane) return []
  return Array.from(pane.querySelectorAll('.n-form-item-label__text')).map(
    (item) => item.textContent?.trim() ?? '',
  )
}

/** 弹窗里被渲染成独立文本节点的尖括号（模板里写坏 `<` / `>` 会漏到界面上）。 */
function strayAngleBrackets(): string[] {
  const root = document.body.querySelector('.n-card.n-modal')
  if (!root) return []
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const found: string[] = []
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node.textContent?.trim() ?? ''
    if (text === '<' || text === '>') found.push(text)
  }
  return found
}

async function clickTab(label: string) {
  const tab = Array.from(document.body.querySelectorAll<HTMLElement>('.n-tabs-tab')).find(
    (item) => item.textContent?.trim() === label,
  )
  if (!tab) throw new Error(`未找到 tab「${label}」，当前：${tabLabels().join(' / ')}`)
  tab.click()
  await flushPromises()
}

async function clickButton(label: string) {
  const button = wrapper!.findAllComponents(NButton).find((item) => item.text().trim() === label)
  if (!button) throw new Error(`按钮「${label}」不存在`)
  await button.trigger('click')
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

describe('申购计划详情弹窗的字段分组', () => {
  it('按 物资信息 / 申购信息 / 备注与附件 分 3 个 tab', async () => {
    api.materials.mockResolvedValue({ items: [plan()], page: 1, page_size: 20, total: 1 } as never)
    api.materialFilterOptions.mockResolvedValue(PLAN_FILTER_OPTIONS as never)
    api.material.mockResolvedValue(plan() as never)
    api.materialCodeExists.mockResolvedValue({ exists: true } as never)
    await mountList(PurchaseMaterialsView, '/procurement/materials?detail=1')

    expect(tabLabels()).toEqual(['物资信息', '申购信息', '备注与附件'])
    expect(activeTabLabel()).toBe('物资信息')
  })

  it('物资信息字段顺序：类别排在最后，用途与子项号相邻同排', async () => {
    api.materials.mockResolvedValue({ items: [plan()], page: 1, page_size: 20, total: 1 } as never)
    api.materialFilterOptions.mockResolvedValue(PLAN_FILTER_OPTIONS as never)
    api.material.mockResolvedValue(plan() as never)
    api.materialCodeExists.mockResolvedValue({ exists: true } as never)
    await mountList(PurchaseMaterialsView, '/procurement/materials?detail=1')

    const labels = activePaneFieldLabels()
    expect(labels).toEqual([
      '物料编码',
      '名称',
      '型号规格',
      '计划数量 / 计量单位',
      '用途',
      '子项号',
      '类别',
    ])
    // 两列网格里相邻即同排：用途、子项号必须挨着，且类别在最后一位
    expect(labels.indexOf('子项号')).toBe(labels.indexOf('用途') + 1)
    expect(labels[labels.length - 1]).toBe('类别')
  })

  it('弹窗里不渲染多余的尖括号文本', async () => {
    api.materials.mockResolvedValue({ items: [plan()], page: 1, page_size: 20, total: 1 } as never)
    api.materialFilterOptions.mockResolvedValue(PLAN_FILTER_OPTIONS as never)
    api.material.mockResolvedValue(plan() as never)
    api.materialCodeExists.mockResolvedValue({ exists: true } as never)
    await mountList(PurchaseMaterialsView, '/procurement/materials?detail=1')

    expect(strayAngleBrackets()).toEqual([])
  })

  it('详情弹窗标记落在卡片根元素上（恢复宽松行距的全局 CSS 依赖它）', async () => {
    api.materials.mockResolvedValue({ items: [plan()], page: 1, page_size: 20, total: 1 } as never)
    api.materialFilterOptions.mockResolvedValue(PLAN_FILTER_OPTIONS as never)
    api.material.mockResolvedValue(plan() as never)
    api.materialCodeExists.mockResolvedValue({ exists: true } as never)
    await mountList(PurchaseMaterialsView, '/procurement/materials?detail=1')

    // styles.css 用 `.n-card.n-modal:not([data-detail-modal])` 排除详情弹窗；
    // 组件库改版把 attrs 挪走时这里会先失败，不至于静默变挤。
    const card = document.body.querySelector('.n-card.n-modal')
    expect(card?.hasAttribute('data-detail-modal')).toBe(true)
  })

  it('缺必填项时自动切回「物资信息」并提示，不调保存接口', async () => {
    const incomplete = plan({ name: '' })
    api.materials.mockResolvedValue({
      items: [incomplete],
      page: 1,
      page_size: 20,
      total: 1,
    } as never)
    api.materialFilterOptions.mockResolvedValue(PLAN_FILTER_OPTIONS as never)
    api.material.mockResolvedValue(incomplete as never)
    api.materialCodeExists.mockResolvedValue({ exists: true } as never)
    await mountList(PurchaseMaterialsView, '/procurement/materials?detail=1')

    await clickTab('备注与附件')
    expect(activeTabLabel()).toBe('备注与附件')

    await clickButton('保存')

    expect(activeTabLabel()).toBe('物资信息')
    expect(document.body.textContent).toContain('请完整填写物资信息')
    expect(api.updateMaterial).not.toHaveBeenCalled()
  })
})

describe('申购记录详情弹窗的字段分组', () => {
  it('按 物资信息 / 申购信息 / 采购进度 / 备注与附件 分 4 个 tab', async () => {
    api.records.mockResolvedValue({
      items: [record()],
      page: 1,
      page_size: 20,
      total: 1,
    } as never)
    api.recordFilterOptions.mockResolvedValue(RECORD_FILTER_OPTIONS as never)
    api.record.mockResolvedValue(record() as never)
    await mountList(PurchaseRequestsView, '/procurement/records?detail=7')

    expect(tabLabels()).toEqual(['物资信息', '申购信息', '采购进度', '备注与附件'])
    expect(activeTabLabel()).toBe('物资信息')
  })

  it('缺必填项时自动切回「物资信息」并提示，不调保存接口', async () => {
    const incomplete = record({ material_name: '' })
    api.records.mockResolvedValue({
      items: [incomplete],
      page: 1,
      page_size: 20,
      total: 1,
    } as never)
    api.recordFilterOptions.mockResolvedValue(RECORD_FILTER_OPTIONS as never)
    api.record.mockResolvedValue(incomplete as never)
    await mountList(PurchaseRequestsView, '/procurement/records?detail=7')

    await clickTab('申购信息')
    expect(activeTabLabel()).toBe('申购信息')

    await clickButton('保存')

    expect(activeTabLabel()).toBe('物资信息')
    expect(document.body.textContent).toContain('请完整填写物资信息')
    expect(api.updateRecord).not.toHaveBeenCalled()
  })
})
