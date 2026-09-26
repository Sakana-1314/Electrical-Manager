import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import {
  NAlert,
  NButton,
  NCard,
  NDatePicker,
  NDescriptions,
  NDescriptionsItem,
  NDialogProvider,
  NDivider,
  NForm,
  NFormItem,
  NInput,
  NMessageProvider,
  NModal,
  NSelect,
  NSpace,
  NTable,
  NTag,
} from 'naive-ui'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { h, nextTick } from 'vue'
import type { StockMaterial, StockOperation } from '@/api/generated'
import { inventoryApi } from '@/api/inventory'
import { useAuthStore } from '@/stores/auth'
import OperationDetailModal from './OperationDetailModal.vue'

vi.mock('@/api/inventory', () => ({
  inventoryApi: {
    operation: vi.fn(),
    material: vi.fn(),
    // 行编辑器内部的物资下拉会在编辑态挂载时拉列表，补上以免打日志噪音
    materials: vi.fn(),
    updateOperation: vi.fn(),
    reverseOperation: vi.fn(),
  },
}))

const api = vi.mocked(inventoryApi)

const material: StockMaterial = {
  id: 1,
  uuid: 'u-1',
  name: '交流接触器',
  name_id: '',
  alias: '',
  model_spec: 'CJX2-2510 AC220V',
  unit_name: '个',
  remark: '',
  current_qty: '12',
  images: [],
  replenishment_policy: null,
  has_operation_records: true,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  version: 1,
}

const operation: StockOperation = {
  id: 2,
  operation_no: 'OUT20260618000002',
  operation_type: 'OUTBOUND',
  occurred_at: '2026-06-18T09:15:00+08:00',
  business_reason: '1#回转窑主电机控制柜检修更换',
  receiver_unit: '电气检修一班',
  receiver_name: '李建军',
  subitem_no: '201',
  source_type: 'MANUAL',
  reversal_of_id: null,
  is_reversed: false,
  client_request_id: '7ad20d2b-3af9-4cbd-a943-cb6ba2df11f1',
  mini_program_user_name: null,
  lines: [
    {
      id: 21,
      stock_material_id: 1,
      material_name: '交流接触器',
      model_spec: 'CJX2-2510 AC220V',
      unit_name: '个',
      quantity: '4',
      remaining_qty: '4',
      before_qty: '12',
      after_qty: '8',
    },
  ],
  created_at: '2026-06-18T01:15:00Z',
  version: 3,
}

let wrapper: VueWrapper | null = null

async function mountModal(props: {
  show: boolean
  operationId?: number | null
  write?: boolean
  onSaved?: () => void
  onReversed?: (id: number) => void
}): Promise<VueWrapper> {
  useAuthStore().user = {
    id: 7,
    username: 'tester',
    role: props.write === false ? 'READ_ONLY' : 'WAREHOUSE_ADMIN',
  } as never
  wrapper = mount(NDialogProvider, {
    attachTo: document.body,
    slots: {
      default: () =>
        h(NMessageProvider, null, {
          default: () =>
            h(OperationDetailModal, {
              show: props.show,
              operationId: props.operationId ?? null,
              onSaved: props.onSaved,
              onReversed: props.onReversed,
            }),
        }),
    },
    global: {
      components: {
        NAlert,
        NButton,
        NCard,
        NDatePicker,
        NDescriptions,
        NDescriptionsItem,
        NDivider,
        NForm,
        NFormItem,
        NInput,
        NModal,
        NSelect,
        NSpace,
        NTable,
        NTag,
      },
      stubs: {
        OperationLinesEditor: true,
        ReverseOperationDialog: true,
        LoadingMask: true,
        // 行编辑器真实挂载会连带拉起 MaterialSelector 的物资列表请求，与本组件断言无关
        MaterialSelector: true,
        QuantityInput: true,
      },
    },
  })
  await flushPromises()
  return wrapper
}

function modal(w: VueWrapper) {
  return w.findComponent(OperationDetailModal)
}

beforeEach(() => {
  setActivePinia(createPinia())
  api.operation.mockResolvedValue(operation)
  api.material.mockResolvedValue(material)
  api.updateOperation.mockResolvedValue(operation)
  api.reverseOperation.mockResolvedValue({ ...operation, id: 99, operation_no: 'REV1' } as never)
  api.materials.mockResolvedValue({ items: [], page: 1, page_size: 20, total: 0 })
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  document.body.innerHTML = ''
  localStorage.clear()
})

describe('OperationDetailModal', () => {
  it('按 id 拉取流水与行内物资，渲染 Hero、单据信息与物资明细', async () => {
    wrapper = await mountModal({ show: true, operationId: 2 })

    expect(api.operation).toHaveBeenCalledWith(2)
    expect(api.material).toHaveBeenCalledWith(1)

    const text = document.body.textContent ?? ''
    expect(text).toContain('出入库流水详情')
    expect(text).toContain('OUT20260618000002')
    expect(text).toContain('出库')
    expect(text).toContain('管理端手工录入')
    expect(text).toContain('1#回转窑主电机控制柜检修更换')
    expect(text).toContain('电气检修一班')
    expect(text).toContain('李建军')
    // 物资明细的六列都在
    expect(text).toContain('剩余可冲')
    expect(text).toContain('操作前')
    expect(text).toContain('操作后')
    expect(text).toContain('请求幂等 ID')
    // 只读态展示 descriptions、不展示编辑表单
    expect(modal(wrapper).findAllComponents(NDescriptions).length).toBe(1)
    expect(modal(wrapper).findAllComponents(NForm).length).toBe(0)
  })

  it('remaining_qty 为 0 的行显示「已冲销」标签', async () => {
    api.operation.mockResolvedValue({
      ...operation,
      lines: [{ ...operation.lines[0], remaining_qty: '0' }],
    })
    wrapper = await mountModal({ show: true, operationId: 2 })

    expect(document.body.textContent).toContain('已冲销')
  })

  it('无写权限时不显示编辑与反向冲销入口', async () => {
    wrapper = await mountModal({ show: true, operationId: 2, write: false })

    const labels = modal(wrapper)
      .findAllComponents(NButton)
      .map((item) => item.text().trim())
    expect(labels).not.toContain('编辑流水')
    expect(labels).not.toContain('反向冲销')
    expect(labels).toContain('关闭')
  })

  it('有写权限且还有剩余可冲量时可进入编辑态并出现保存入口', async () => {
    wrapper = await mountModal({ show: true, operationId: 2 })

    const labels = modal(wrapper)
      .findAllComponents(NButton)
      .map((item) => item.text().trim())
    expect(labels).toContain('编辑流水')
    expect(labels).toContain('反向冲销')

    const editButton = modal(wrapper)
      .findAllComponents(NButton)
      .find((item) => item.text().trim() === '编辑流水')
    await editButton!.trigger('click')
    await flushPromises()

    // 编辑态换成表单与行编辑器，并出现「修改影响提示」
    expect(modal(wrapper).findAllComponents(NForm).length).toBe(1)
    expect(modal(wrapper).findAllComponents(NDescriptions).length).toBe(0)
    expect(modal(wrapper).findAllComponents(NAlert).length).toBe(1)
    expect(document.body.textContent).toContain('修改影响提示')
    const nextLabels = modal(wrapper)
      .findAllComponents(NButton)
      .map((item) => item.text().trim())
    expect(nextLabels).toContain('保存修改')
  })

  it('已冲销 / 无剩余可冲量时冲销入口禁用', async () => {
    // 与原详情页一致：按钮始终渲染，仅按 canReverse 置灰（is_reversed 或剩余可冲为 0）
    api.operation.mockResolvedValue({ ...operation, is_reversed: true })
    wrapper = await mountModal({ show: true, operationId: 2 })
    const reverse = modal(wrapper)
      .findAllComponents(NButton)
      .find((item) => item.text().trim() === '反向冲销')
    expect(reverse?.props('disabled')).toBe(true)

    // 剩余可冲为 0 同样禁用
    wrapper.unmount()
    wrapper = null
    document.body.innerHTML = ''
    api.operation.mockResolvedValue({
      ...operation,
      lines: [{ ...operation.lines[0], remaining_qty: '0' }],
    })
    wrapper = await mountModal({ show: true, operationId: 2 })
    const reverse2 = modal(wrapper)
      .findAllComponents(NButton)
      .find((item) => item.text().trim() === '反向冲销')
    expect(reverse2?.props('disabled')).toBe(true)
  })

  it('遮罩点击：只读态直接关闭，编辑态有改动时先二次确认', async () => {
    wrapper = await mountModal({ show: true, operationId: 2 })
    const nModal = modal(wrapper).findComponent(NModal)
    expect(nModal.props('maskClosable')).toBe(false)
    expect(nModal.props('closeOnEsc')).toBe(false)

    // 只读态无未保存修改 → 直接关
    nModal.vm.$emit('mask-click')
    await nextTick()
    await flushPromises()
    expect(document.querySelector('.n-dialog')).toBeNull()

    // 进入编辑态并改用途 → 先弹确认
    const editButton = modal(wrapper)
      .findAllComponents(NButton)
      .find((item) => item.text().trim() === '编辑流水')
    await editButton!.trigger('click')
    await flushPromises()
    const reasonInput = modal(wrapper)
      .findAllComponents(NInput)
      .find((item) => item.props('value') === '1#回转窑主电机控制柜检修更换')
    reasonInput!.vm.$emit('update:value', '改过的用途')
    await flushPromises()

    nModal.vm.$emit('mask-click')
    await nextTick()
    await flushPromises()
    expect(document.querySelector('.n-dialog')).not.toBeNull()
    expect(document.body.textContent).toContain('放弃未保存的修改？')
  })
})
