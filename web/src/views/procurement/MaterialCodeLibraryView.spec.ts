import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import {
  NButton,
  NCard,
  NDataTable,
  NDialogProvider,
  NDropdown,
  NIcon,
  NInput,
  NMessageProvider,
  NPagination,
  NTag,
} from 'naive-ui'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import type { MaterialCodeLibrary } from '@/api/generated'
import { procurementApi } from '@/api/procurement'
import { useAuthStore } from '@/stores/auth'
import MaterialCodeLibraryView from './MaterialCodeLibraryView.vue'

vi.mock('@/api/procurement', () => ({
  procurementApi: {
    materialCodes: vi.fn(),
    materialCodeLastImport: vi.fn(),
    importMaterialCodes: vi.fn(),
    materialCodeImportJob: vi.fn(),
  },
}))

const api = vi.mocked(procurementApi)

const rows: MaterialCodeLibrary[] = [
  {
    id: 1,
    material_code: 'Y001',
    name: '交流接触器',
    model_spec: 'CJX2-2510',
    unit_name: '个',
    unit_price: '12.5',
  },
  {
    id: 2,
    material_code: 'Y002',
    name: '控制电缆',
    model_spec: 'KVV 4×1.5',
    unit_name: '米',
    unit_price: null,
  },
]

const Host = defineComponent({
  render: () =>
    h(NDialogProvider, null, {
      default: () => h(NMessageProvider, null, { default: () => h(MaterialCodeLibraryView) }),
    }),
})

let wrapper: VueWrapper | null = null

async function mountView(): Promise<void> {
  api.materialCodes.mockResolvedValue({ items: rows, page: 1, page_size: 20, total: rows.length })
  api.materialCodeLastImport.mockResolvedValue({ last_import_at: '2026-09-01T02:00:00Z' })
  api.importMaterialCodes.mockResolvedValue({
    id: 1,
    import_type: 'MATERIAL_PRICE',
    status: 'SUCCEEDED',
    original_filename: 'prices.xlsx',
    result: { imported_count: 3, skipped_missing_code: 1, skipped_missing_price: 2 },
    error_code: null,
    error_message: null,
    created_at: '2026-09-01T02:00:00+00:00',
    started_at: null,
    finished_at: null,
  })
  // auth store 在模块加载时就固化了 localStorage 快照，直接写 store 的 user 才生效。
  const pinia = createPinia()
  setActivePinia(pinia)
  useAuthStore().user = { id: 7, username: 'tester', role: 'PURCHASE_ADMIN' } as never
  wrapper = mount(Host, {
    attachTo: document.body,
    global: {
      plugins: [pinia],
      // 单测环境未启用 unplugin-vue-components，需显式注册模板里的 n-* 组件。
      components: {
        NButton,
        NCard,
        NDataTable,
        NDialogProvider,
        NDropdown,
        NIcon,
        NInput,
        NMessageProvider,
        NPagination,
        NTag,
      },
    },
  })
  await flushPromises()
}

interface TableColumnStub {
  key?: string
  title?: string
  render?: (row: MaterialCodeLibrary) => unknown
}

function columnByKey(key: string): TableColumnStub {
  const table = wrapper?.findComponent(NDataTable)
  if (!table) throw new Error('找不到数据表格')
  const columns = (table.props('columns') ?? []) as TableColumnStub[]
  const column = columns.find((item) => item.key === key)
  if (!column) throw new Error(`找不到列：${key}`)
  return column
}

/** 模拟文件选择：jsdom 不允许直接给 input.files 赋值，用 defineProperty 顶上去。 */
async function pickFile(filename: string): Promise<void> {
  const input = wrapper?.element.querySelector('input[type="file"]') as HTMLInputElement | null
  if (!input) throw new Error('找不到文件输入框')
  Object.defineProperty(input, 'files', {
    value: [new File(['content'], filename)],
    configurable: true,
  })
  input.dispatchEvent(new Event('change'))
  await flushPromises()
}

/** 点确认弹窗里的按钮（弹窗挂在 body 上）。 */
async function clickDialogButton(text: string): Promise<void> {
  const button = [...document.body.querySelectorAll('button')].find((item) =>
    item.textContent?.trim().includes(text),
  )
  if (!button) throw new Error(`找不到弹窗按钮：${text}`)
  button.click()
  await flushPromises()
}

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  document.body.innerHTML = ''
  localStorage.clear()
  vi.clearAllMocks()
})

describe('MaterialCodeLibraryView', () => {
  it('全成本单价列展示价格表匹配到的单价，没有价格的行显示破折号', async () => {
    await mountView()

    const column = columnByKey('unit_price')
    expect(column.title).toBe('全成本单价（元）')
    expect(String(column.render?.(rows[0]))).toBe('12.5 元')
    expect(String(column.render?.(rows[1]))).toBe('—')
  })

  it('物料表与价格表各自回显上次导入时间', async () => {
    await mountView()

    expect(api.materialCodeLastImport).toHaveBeenCalledWith('material')
    expect(api.materialCodeLastImport).toHaveBeenCalledWith('price')
    expect(wrapper?.text()).toContain('物料表导入：')
    expect(wrapper?.text()).toContain('价格表导入：')
  })

  it('下拉菜单提供物料表 / 价格表两个选项', async () => {
    await mountView()

    const dropdown = wrapper?.findComponent(NDropdown)
    expect(dropdown?.props('options')).toEqual([
      { key: 'material', label: '物料表' },
      { key: 'price', label: '价格表' },
    ])
  })

  it('选「价格表」后导入走价格表类型', async () => {
    await mountView()

    await wrapper?.findComponent(NDropdown).vm.$emit('select', 'price')
    await flushPromises()
    await pickFile('prices.xlsx')
    expect(document.body.textContent).toContain('全量更新物料价格')

    await clickDialogButton('确认全量更新')
    expect(api.importMaterialCodes).toHaveBeenCalledTimes(1)
    expect(api.importMaterialCodes.mock.calls[0]?.[1]).toBe('price')
  })

  it('价格表导入完成提示回报缺编码 / 缺价格而跳过的行数', async () => {
    await mountView()

    await wrapper?.findComponent(NDropdown).vm.$emit('select', 'price')
    await flushPromises()
    await pickFile('prices.xlsx')
    await clickDialogButton('确认全量更新')
    await flushPromises()

    expect(document.body.textContent).toContain('已全量更新 3 条物料价格')
    expect(document.body.textContent).toContain('1 行没有货品编码，已跳过')
    expect(document.body.textContent).toContain('2 行没有价格，已跳过')
  })

  it('不选菜单时默认按物料表导入', async () => {
    await mountView()

    await pickFile('materials.xlsx')
    expect(document.body.textContent).toContain('全量更新物料编码库')

    await clickDialogButton('确认全量更新')
    expect(api.importMaterialCodes.mock.calls[0]?.[1]).toBe('material')
  })
})
