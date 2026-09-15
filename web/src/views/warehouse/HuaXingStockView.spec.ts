import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import {
  NButton,
  NCard,
  NDataTable,
  NDatePicker,
  NDialogProvider,
  NInput,
  NMessageProvider,
  NPagination,
  NSelect,
  NTag,
} from 'naive-ui'
import { createPinia } from 'pinia'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import type { HuaXingInventory } from '@/api/generated'
import { huaXingInventoryApi } from '@/api/huaXingInventory'
import ColumnVisibilityPicker from '@/components/ColumnVisibilityPicker.vue'
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

const api = vi.mocked(huaXingInventoryApi)

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

const Host = defineComponent({
  render: () =>
    h(NDialogProvider, null, {
      default: () => h(NMessageProvider, null, { default: () => h(HuaXingStockView) }),
    }),
})

let wrapper: VueWrapper | null = null

async function mountView(): Promise<void> {
  api.list.mockResolvedValue({ items: [row], page: 1, page_size: 20, total: 1 })
  api.filterOptions.mockResolvedValue({
    purchase_departments: ['生产调度中心'],
    purchasers: ['吴冰'],
  })
  api.lastImport.mockResolvedValue({ last_import_at: '2026-09-01T02:00:00Z' })
  localStorage.setItem(
    'auth_user',
    JSON.stringify({ id: 7, username: 'tester', role: 'WAREHOUSE_ADMIN' }),
  )
  wrapper = mount(Host, {
    attachTo: document.body,
    global: {
      plugins: [createPinia()],
      // 单测环境未启用 unplugin-vue-components，需显式注册模板里的 n-* 组件。
      components: {
        NButton,
        NCard,
        NDataTable,
        NDatePicker,
        NDialogProvider,
        NInput,
        NMessageProvider,
        NPagination,
        NSelect,
        NTag,
      },
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
})
