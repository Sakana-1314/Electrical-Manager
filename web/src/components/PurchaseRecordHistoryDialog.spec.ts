import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { NButton, NDataTable, NInput, NMessageProvider, NModal, NPagination, NTag } from 'naive-ui'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import type { PurchaseRecord } from '@/api/generated'
import { procurementApi } from '@/api/procurement'
import PurchaseRecordHistoryDialog from './PurchaseRecordHistoryDialog.vue'

vi.mock('@/api/procurement', () => ({
  procurementApi: {
    records: vi.fn(),
  },
}))

const procurement = vi.mocked(procurementApi)

const record: PurchaseRecord = {
  line_id: 1,
  purchase_request_id: 2,
  purchase_material_id: 3,
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
  plan_remark: '计划备注',
  record_remark: '记录备注',
  usage: '检修',
  subitem_no: '201',
  images: [],
  purchase_date: '2026-01-04',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-05T00:00:00Z',
  version: 1,
}

const show = ref(false)
let wrapper: VueWrapper | null = null

const Host = defineComponent({
  setup() {
    return () =>
      h(NMessageProvider, null, {
        default: () =>
          h(PurchaseRecordHistoryDialog, {
            show: show.value,
            initialMaterialCode: 'L012-05048',
            'onUpdate:show': (value: boolean) => {
              show.value = value
            },
          }),
      })
  },
})

async function mountDialog(): Promise<void> {
  procurement.records.mockResolvedValue({ items: [record], page: 1, page_size: 10, total: 1 })
  wrapper = mount(Host, {
    attachTo: document.body,
    global: {
      // 单测环境未启用 unplugin-vue-components，需显式注册模板里的 n-* 组件。
      components: {
        NButton,
        NDataTable,
        NInput,
        NMessageProvider,
        NModal,
        NPagination,
        NTag,
      },
    },
  })
  show.value = true
  await nextTick()
  await flushPromises()
}

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  show.value = false
})

describe('PurchaseRecordHistoryDialog', () => {
  it('打开时按初始物料编码查询', async () => {
    await mountDialog()

    expect(procurement.records).toHaveBeenCalledWith(
      expect.objectContaining({
        search_field: 'material_code',
        search_value: 'L012-05048',
        page: 1,
        page_size: 10,
      }),
    )
    const codeInput = document.querySelector('.history-search input') as HTMLInputElement
    expect(codeInput.value).toBe('L012-05048')
  })

  it('点击遮罩可关闭历史记录弹窗', async () => {
    await mountDialog()

    const modal = wrapper?.findAllComponents(NModal)[0]
    expect(modal?.props('maskClosable')).toBe(true)
  })

  it('点击记录行抛出 select 事件，由父组件打开详情弹窗', async () => {
    await mountDialog()

    const row = document.querySelector('.n-data-table-tbody .n-data-table-tr') as HTMLElement
    expect(row).toBeTruthy()
    row.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 }))
    row.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises()

    expect(show.value).toBe(true)
    const dialog = wrapper?.findComponent(PurchaseRecordHistoryDialog)
    expect(dialog?.emitted('select')?.[0]?.[0]).toMatchObject({ line_id: 1 })
  })

  it('查询时抛出 search 事件供父页面写回 URL', async () => {
    await mountDialog()

    const inputs = wrapper?.findAllComponents(NInput)
    if (!inputs?.length) throw new Error('找不到查询输入框')
    await inputs[0].vm.$emit('update:value', 'L099-00001')
    await flushPromises()
    const searchButton = [
      ...document.querySelectorAll<HTMLButtonElement>('.history-search button'),
    ].find((button) => button.textContent?.trim().includes('查询'))
    if (!searchButton) throw new Error('找不到查询按钮')
    searchButton.click()
    await flushPromises()

    const searches = wrapper?.findComponent(PurchaseRecordHistoryDialog)?.emitted('search')
    const lastSearch = searches?.[searches.length - 1]?.[0]
    expect(lastSearch).toMatchObject({
      materialCode: 'L099-00001',
      name: '',
      modelSpec: '',
    })
  })

  it('清空后重置恢复初始物料编码并重新查询', async () => {
    await mountDialog()

    const inputs = wrapper?.findAllComponents(NInput)
    if (!inputs?.length) throw new Error('找不到查询输入框')
    await inputs[0].vm.$emit('update:value', '')
    await flushPromises()
    expect((document.querySelector('.history-search input') as HTMLInputElement).value).toBe('')

    const resetButton = [
      ...document.querySelectorAll<HTMLButtonElement>('.history-search button'),
    ].find((button) => button.textContent?.trim().includes('重置'))
    if (!resetButton) throw new Error('找不到重置按钮')
    resetButton.click()
    await flushPromises()

    expect((document.querySelector('.history-search input') as HTMLInputElement).value).toBe(
      'L012-05048',
    )
    expect(procurement.records).toHaveBeenLastCalledWith(
      expect.objectContaining({
        search_field: 'material_code',
        search_value: 'L012-05048',
      }),
    )
  })
})
