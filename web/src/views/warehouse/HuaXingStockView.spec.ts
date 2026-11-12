import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import * as naiveUi from 'naive-ui'
import { NDataTable, NDatePicker, NDialogProvider, NMessageProvider } from 'naive-ui'
import { createPinia } from 'pinia'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'
import type { HuaXingInventory, PurchaseRecord } from '@/api/generated'
import { huaXingInventoryApi } from '@/api/huaXingInventory'
import { procurementApi } from '@/api/procurement'
import ColumnVisibilityPicker from '@/components/ColumnVisibilityPicker.vue'
import PurchaseRecordDetailModal from '@/components/PurchaseRecordDetailModal.vue'
import PurchaseRecordHistoryDialog from '@/components/PurchaseRecordHistoryDialog.vue'
import HuaXingStockView from './HuaXingStockView.vue'

vi.mock('@/api/huaXingInventory', () => ({
  huaXingInventoryApi: {
    list: vi.fn(),
    filterOptions: vi.fn(),
    lastImport: vi.fn(),
    import: vi.fn(),
    importJob: vi.fn(),
  },
}))

vi.mock('@/api/procurement', () => ({
  procurementApi: {
    records: vi.fn(),
    record: vi.fn(),
    updateRecord: vi.fn(),
    restoreRecordToPlan: vi.fn(),
    createMaterial: vi.fn(),
  },
}))

const api = vi.mocked(huaXingInventoryApi)
const procurement = vi.mocked(procurementApi)

/** 单测未启用 unplugin-vue-components，模板里的 n-* 需要显式注册。 */
const naiveComponents = Object.fromEntries(
  Object.entries(naiveUi).filter(([name, value]) => /^N[A-Z]/.test(name) && value !== null),
) as Record<string, never>

/** 东八区偏移：日期选择器给的是北京时间当天零点的时间戳。 */
const SHANGHAI_OFFSET = 8 * 60 * 60 * 1000

const row: HuaXingInventory = {
  id: 1,
  first_inbound_date: '2023-05-01',
  warehouse: 'P05综合仓',
  material_code: 'L012-05048',
  name: '内丝三通',
  model_spec: 'DN15',
  quantity: '25',
  unit_name: '个',
  purchaser: '吴冰',
  purchase_department: '生产调度中心',
  subitem_no_name: '201-冶炼主厂房',
}

const rowWithoutCode: HuaXingInventory = {
  ...row,
  id: 2,
  material_code: null,
  name: '临时物资',
}

const historyRecord: PurchaseRecord = {
  line_id: 7,
  purchase_request_id: 5,
  purchase_material_id: 1,
  plan_no: 'JH20260101',
  plan_date: '2026-01-02',
  purchase_order_no: 'CG20260103',
  trace_no: 'ZS-01',
  unit_price: '12.5',
  status: '已入库',
  material_code: 'L012-05048',
  category: '备品备件',
  demand_department: '生产调度中心',
  material_name: '内丝三通',
  model_spec: 'DN15',
  unit_name: '个',
  purchase_qty: '2',
  actual_demand_person: '吴冰',
  purchase_responsible: '李建军',
  salesperson: '马晓东',
  plan_remark: '',
  record_remark: '',
  usage: '检修',
  subitem_no: '201',
  images: [],
  purchase_date: '2026-01-04',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-05T00:00:00Z',
  version: 1,
}

const Host = defineComponent({
  render: () =>
    h(NDialogProvider, null, {
      default: () => h(NMessageProvider, null, { default: () => h(HuaXingStockView) }),
    }),
})

let wrapper: VueWrapper | null = null
let router: Router

async function mountView(path = '/warehouse/hua-xing-stock'): Promise<void> {
  api.list.mockResolvedValue({ items: [row, rowWithoutCode], page: 1, page_size: 20, total: 2 })
  api.filterOptions.mockResolvedValue({
    purchase_departments: ['生产调度中心'],
    purchasers: ['吴冰'],
  })
  api.lastImport.mockResolvedValue({ last_import_at: '2026-09-01T02:00:00Z' })
  procurement.records.mockResolvedValue({
    items: [historyRecord],
    page: 1,
    page_size: 10,
    total: 1,
  })
  procurement.record.mockResolvedValue(historyRecord)
  localStorage.setItem(
    'auth_user',
    JSON.stringify({
      id: 7,
      username: 'tester',
      permissions: ['warehouse:read', 'warehouse:write'],
    }),
  )
  router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/warehouse/hua-xing-stock', name: 'hua-xing-stock', component: { template: '' } },
      { path: '/procurement/records', name: 'purchase-records', component: { template: '' } },
      { path: '/procurement/materials', name: 'purchase-materials', component: { template: '' } },
    ],
  })
  await router.push(path)
  await router.isReady()
  wrapper = mount(Host, {
    attachTo: document.body,
    global: {
      plugins: [createPinia(), router],
      // 单测环境未启用 unplugin-vue-components，需显式注册模板里的 n-* 组件。
      components: { ...naiveComponents },
    },
  })
  await flushPromises()
}

/** 最近一次列表查询参数。 */
function lastListParams(): Record<string, unknown> {
  const calls = api.list.mock.calls
  return (calls[calls.length - 1]?.[0] ?? {}) as Record<string, unknown>
}

/** 按可见文字点按钮。 */
async function clickButton(text: string): Promise<void> {
  const button = [...(wrapper?.element.querySelectorAll('button') ?? [])].find((item) =>
    item.textContent?.trim().includes(text),
  )
  if (!button) throw new Error(`找不到按钮：${text}`)
  button.click()
  await flushPromises()
}

type DateParts = [number, number, number]

/** 模拟日期区间选择：未选的那一端按 naive-ui 的口径传 null。 */
async function pickInboundRange(start: DateParts | null, end: DateParts | null): Promise<void> {
  const picker = wrapper?.findComponent(NDatePicker)
  if (!picker) throw new Error('找不到日期选择器')
  const toTimestamp = (value: DateParts | null) =>
    value ? Date.UTC(value[0], value[1] - 1, value[2]) - SHANGHAI_OFFSET : null
  await picker.vm.$emit('update:value', [toTimestamp(start), toTimestamp(end)])
  await flushPromises()
}

/** 表格当前展示的列 key。 */
function tableColumnKeys(): string[] {
  const table = wrapper?.findComponent(NDataTable)
  if (!table) throw new Error('找不到数据表格')
  const columns = table.props('columns') as { key?: string }[]
  return columns.map((column) => column.key ?? '')
}

/** 点击表格第 index 行（整行点击会先经过 mousedown 守卫）。 */
async function clickRow(index: number): Promise<void> {
  const rows = wrapper?.element.querySelectorAll('.n-data-table-tbody .n-data-table-tr')
  const target = rows?.[index] as HTMLElement | undefined
  if (!target) throw new Error(`找不到表格行：${index}`)
  target.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 }))
  target.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  await flushPromises()
}

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  localStorage.clear()
})

describe('HuaXingStockView', () => {
  it('按首次入库日期区间查询时把两端折算成上海日期传给接口', async () => {
    await mountView()

    await pickInboundRange([2023, 5, 1], [2023, 6, 30])
    await clickButton('查询')

    expect(lastListParams()).toMatchObject({ date_from: '2023-05-01', date_to: '2023-06-30' })
    expect(router.currentRoute.value.query).toMatchObject({
      date_from: '2023-05-01',
      date_to: '2023-06-30',
    })
  })

  it('从 URL 恢复筛选条件与分页', async () => {
    await mountView(
      '/warehouse/hua-xing-stock?material_code=L012-05048&name=内丝&purchase_department=生产调度中心%7C设备管理部&purchaser=吴冰&date_from=2023-05-01&date_to=2023-06-30&page=2&page_size=50',
    )

    expect(lastListParams()).toMatchObject({
      material_code: 'L012-05048',
      name: '内丝',
      purchase_department: '生产调度中心|设备管理部',
      purchaser: '吴冰',
      date_from: '2023-05-01',
      date_to: '2023-06-30',
      page: 2,
      page_size: 50,
    })
  })

  it('未选日期时不传区间参数；只填一端时只传对应那一端', async () => {
    await mountView()

    await clickButton('查询')
    expect(lastListParams().date_from).toBeUndefined()
    expect(lastListParams().date_to).toBeUndefined()

    await pickInboundRange([2024, 1, 1], null)
    await clickButton('查询')
    expect(lastListParams().date_from).toBe('2024-01-01')
    expect(lastListParams().date_to).toBeUndefined()

    await pickInboundRange(null, [2024, 12, 31])
    await clickButton('查询')
    expect(lastListParams().date_from).toBeUndefined()
    expect(lastListParams().date_to).toBe('2024-12-31')
  })

  it('重置后区间筛选与「已启用」计数一起清空', async () => {
    await mountView()

    await pickInboundRange([2023, 5, 1], [2023, 6, 30])
    expect(wrapper?.text()).toContain('已启用 1 项')

    await clickButton('重置')

    expect(wrapper?.text()).not.toContain('已启用')
    expect(lastListParams().date_from).toBeUndefined()
    expect(lastListParams().date_to).toBeUndefined()
  })

  it('字段选择只保留勾选的列，默认展示全部 10 列', async () => {
    await mountView()

    expect(tableColumnKeys()).toHaveLength(10)

    const picker = wrapper?.findComponent(ColumnVisibilityPicker)
    if (!picker) throw new Error('找不到字段选择控件')
    await picker.vm.$emit('update:value', ['name', 'quantity'])
    await flushPromises()

    expect(tableColumnKeys()).toEqual(['name', 'quantity'])
  })

  it('折叠开关切换筛选网格的 is-collapsed（可见数量由全局样式按断点决定）', async () => {
    await mountView()

    const grid = () => wrapper?.element.querySelector('.filter-grid')
    expect(grid()?.classList.contains('is-collapsed')).toBe(true)

    await clickButton('更多筛选')
    expect(grid()?.classList.contains('is-collapsed')).toBe(false)

    await clickButton('收起筛选')
    expect(grid()?.classList.contains('is-collapsed')).toBe(true)
  })

  it('点击有货品编码的行按物料编码打开历史申购记录弹窗', async () => {
    await mountView()

    await clickRow(0)

    const dialog = wrapper?.findComponent(PurchaseRecordHistoryDialog)
    expect(dialog?.props('show')).toBe(true)
    expect(dialog?.props('initialMaterialCode')).toBe('L012-05048')
    expect(router.currentRoute.value.query).toMatchObject({
      history: '1',
      history_code: 'L012-05048',
    })
    expect(procurement.records).toHaveBeenCalledWith(
      expect.objectContaining({
        search_field: 'material_code',
        search_value: 'L012-05048',
        page: 1,
        page_size: 10,
      }),
    )
  })

  it('点击没有货品编码的行不打开申购记录弹窗', async () => {
    await mountView()

    await clickRow(1)

    const dialog = wrapper?.findComponent(PurchaseRecordHistoryDialog)
    expect(dialog?.props('show')).toBe(false)
    expect(procurement.records).not.toHaveBeenCalled()
  })

  it('点击历史记录行在当前页打开申购记录详情弹窗并写入 URL', async () => {
    await mountView()
    await clickRow(0)

    const historyRow = document.querySelector(
      '.purchase-record-history-modal .n-data-table-tbody .n-data-table-tr',
    ) as HTMLElement | null
    expect(historyRow).toBeTruthy()
    historyRow?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 }))
    historyRow?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises()

    const detail = wrapper?.findComponent(PurchaseRecordDetailModal)
    expect(detail?.props('show')).toBe(true)
    expect((detail?.props('record') as PurchaseRecord).line_id).toBe(7)
    expect(router.currentRoute.value.query.record_detail).toBe('7')
    expect(router.currentRoute.value.query.history).toBe('1')
  })

  it('刷新时从 URL 恢复历史记录弹窗与申购记录详情弹窗', async () => {
    await mountView('/warehouse/hua-xing-stock?history=1&history_code=L012-05048&record_detail=7')
    await flushPromises()

    const dialog = wrapper?.findComponent(PurchaseRecordHistoryDialog)
    expect(dialog?.props('show')).toBe(true)
    expect(dialog?.props('initialMaterialCode')).toBe('L012-05048')

    const detail = wrapper?.findComponent(PurchaseRecordDetailModal)
    expect(detail?.props('show')).toBe(true)
    expect((detail?.props('record') as PurchaseRecord).line_id).toBe(7)
    expect(procurement.record).toHaveBeenCalledWith(7)
  })
})
