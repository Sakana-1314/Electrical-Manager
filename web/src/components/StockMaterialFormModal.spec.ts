import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import {
  NButton,
  NDialogProvider,
  NForm,
  NFormItem,
  NInput,
  NMessageProvider,
  NModal,
  NSpace,
  NSwitch,
  NTag,
} from 'naive-ui'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { h, nextTick } from 'vue'
import type { FileObject, InventoryBalance, StockMaterial } from '@/api/generated'
import { fileApi as fileApiUpload } from '@/api/files'
import { inventoryApi } from '@/api/inventory'
import { useAuthStore } from '@/stores/auth'
import ImageUploader from './ImageUploader.vue'
import StockMaterialFormModal from './StockMaterialFormModal.vue'

vi.mock('@/api/inventory', () => ({
  inventoryApi: {
    material: vi.fn(),
    balance: vi.fn(),
    materialMiniProgramCode: vi.fn(),
    createMaterial: vi.fn(),
    updateMaterial: vi.fn(),
    savePolicy: vi.fn(),
    deleteMaterial: vi.fn(),
  },
}))

vi.mock('@/api/files', () => ({
  fileApi: {
    uploadImage: vi.fn(),
    removeImage: vi.fn(),
    checkImageDigest: vi.fn(),
  },
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useRoute: () => ({ query: {} }),
}))

const api = vi.mocked(inventoryApi)

const material: StockMaterial = {
  id: 9,
  uuid: '3f1c8b40-6f4e-4c1e-9a3c-1b2d3e4f5061',
  name: '塑壳断路器',
  name_id: '',
  alias: '塑壳',
  model_spec: 'NM1-125S/3300 100A',
  unit_name: '个',
  remark: '配电柜总开关备件',
  current_qty: '12',
  images: [],
  replenishment_policy: { minimum_qty: '5', enabled: true, version: 2 },
  has_operation_records: true,
  created_at: '2026-01-01T02:00:00Z',
  updated_at: '2026-02-01T02:00:00Z',
  version: 4,
}

const balance: InventoryBalance = {
  stock_material_id: 9,
  name: '塑壳断路器',
  alias: '塑壳',
  model_spec: 'NM1-125S/3300 100A',
  unit_name: '个',
  current_qty: '12',
  minimum_qty: '5',
  is_low_stock: false,
  suggested_purchase_qty: '0',
  updated_at: '2026-02-01T02:00:00Z',
}

let wrapper: VueWrapper | null = null

/**
 * 组件把内容 teleport 到 body（`.n-modal-container`），因此：
 * - 断言可见文本要读 `document.body`，或读组件实例的 findComponent（teleport 不影响实例树）；
 * - 表单输入用 `input.vm.$emit('update:value', …)`（NInput 的 model 事件名），
 *   `setValue` 在这里不触发 naive 的绑定。
 */
async function mountModal(props: {
  show: boolean
  materialId?: number | null
  write?: boolean
  onSaved?: () => void
  /** 不 stub 图片上传组件：用于验证「上传在途 → 保存按钮禁用」的真实联动。 */
  realUploader?: boolean
}): Promise<VueWrapper> {
  // auth store 在模块加载时就固化了 localStorage 快照，直接写 store 的 user 才生效
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
            h(StockMaterialFormModal, {
              show: props.show,
              materialId: props.materialId ?? null,
              onSaved: props.onSaved,
            }),
        }),
    },
    global: {
      components: { NButton, NForm, NFormItem, NInput, NModal, NSpace, NSwitch, NTag },
      stubs: {
        QuantityInput: true,
        ImageUploader: props.realUploader ? false : true,
        LoadingMask: true,
      },
    },
  })
  await flushPromises()
  return wrapper
}

function modal(w: VueWrapper) {
  return w.findComponent(StockMaterialFormModal)
}

function buttonTexts(w: VueWrapper): string[] {
  return modal(w)
    .findAllComponents(NButton)
    .map((item) => item.text().trim())
}

function findButton(w: VueWrapper, label: string) {
  return modal(w)
    .findAllComponents(NButton)
    .find((item) => item.text().trim() === label)
}

/** 按当前值定位一个文本输入框并写入新值。 */
async function setInputValue(w: VueWrapper, current: string, next: string) {
  const input = modal(w)
    .findAllComponents(NInput)
    .find((item) => item.props('value') === current)
  if (!input) throw new Error(`input with value ${current} not found`)
  input.vm.$emit('update:value', next)
  await flushPromises()
}

beforeEach(() => {
  setActivePinia(createPinia())
  api.material.mockResolvedValue(material)
  api.balance.mockResolvedValue(balance)
  api.materialMiniProgramCode.mockResolvedValue(new Blob(['x']))
  api.createMaterial.mockResolvedValue({ ...material, id: 21 })
  api.updateMaterial.mockResolvedValue(material)
  api.savePolicy.mockResolvedValue(material)
  api.deleteMaterial.mockResolvedValue({} as never)
  // jsdom 没实现 Blob URL API，按组件用到的两处补桩
  URL.createObjectURL = vi.fn(() => 'blob:mock')
  URL.revokeObjectURL = vi.fn()
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  document.body.innerHTML = ''
  localStorage.clear()
})

describe('StockMaterialFormModal', () => {
  it('详情模式按 id 拉取档案、余额与出库小程序码', async () => {
    wrapper = await mountModal({ show: true, materialId: 9 })

    expect(api.material).toHaveBeenCalledWith(9)
    expect(api.balance).toHaveBeenCalledWith(9)
    expect(api.materialMiniProgramCode).toHaveBeenCalledWith(9)

    // 原详情页的独有信息都要在弹窗里
    const text = document.body.textContent ?? ''
    expect(text).toContain('二级库物资详情')
    expect(text).toContain('当前库存')
    expect(text).toContain('建议申购数量')
    expect(text).toContain('出库小程序码')
    expect(text).toContain('已有操作记录')
  })

  it('最后更新时间在标题右侧，且不带「最后更新：」前缀', async () => {
    wrapper = await mountModal({ show: true, materialId: 9 })

    // 弹窗 teleport 到 body，`.n-card-header__extra` 不在 wrapper 内，要从 document 查
    const headerExtra = document.querySelector('.n-card-header__extra')
    expect(headerExtra).not.toBeNull()
    expect(headerExtra!.querySelector('.card-header-time')?.textContent).toBe('2026/02/01 10:00:00')
    // 去掉前缀后只剩时间，正文里不该再出现「最后更新」
    expect(headerExtra!.textContent).not.toContain('最后更新')
    expect(document.body.textContent ?? '').not.toContain('最后更新')
  })

  it('新建模式不请求单条接口，直接给空表单', async () => {
    wrapper = await mountModal({ show: true, materialId: null })

    expect(api.material).not.toHaveBeenCalled()
    expect(api.balance).not.toHaveBeenCalled()
    const text = document.body.textContent ?? ''
    expect(text).toContain('新建二级库物资')
    expect(text).not.toContain('当前库存')
    expect(text).not.toContain('出库小程序码')
  })

  it('无写权限时字段禁用，且不显示保存 / 删除 / 出入库入口', async () => {
    wrapper = await mountModal({ show: true, materialId: 9, write: false })

    expect(modal(wrapper).findComponent(NForm).props('disabled')).toBe(true)
    const labels = buttonTexts(wrapper)
    expect(labels).not.toContain('保存修改')
    expect(labels).not.toContain('删除')
    expect(labels).not.toContain('入库')
    expect(labels).not.toContain('出库')
  })

  it('保存调 updateMaterial + savePolicy，并通知父级刷新', async () => {
    const onSaved = vi.fn()
    wrapper = await mountModal({ show: true, materialId: 9, onSaved })

    await setInputValue(wrapper, '塑壳断路器', '新名称')
    await findButton(wrapper, '保存修改')!.trigger('click')
    await flushPromises()

    expect(api.updateMaterial).toHaveBeenCalledTimes(1)
    expect(api.updateMaterial.mock.calls[0][0]).toBe(9)
    expect(api.updateMaterial.mock.calls[0][1].name).toBe('新名称')
    expect(api.savePolicy).toHaveBeenCalledTimes(1)
    // 组件通过 emit('saved') 通知父级刷新列表
    expect(onSaved).toHaveBeenCalledTimes(1)
  })

  it('右上角 × 走同一条关闭路径（干净直接关，有改动先确认）', async () => {
    wrapper = await mountModal({ show: true, materialId: 9 })

    // 组件库的关闭按钮由 @close 接管：clean 时必须真的关闭
    const closeButton = document.querySelector<HTMLElement>('.n-card-header__close')
    expect(closeButton).not.toBeNull()
    closeButton!.click()
    await nextTick()
    await flushPromises()
    expect(document.querySelector('.n-dialog')).toBeNull()

    // 有改动时同样先弹确认，不直接关
    await setInputValue(wrapper, '塑壳断路器', '改过了')
    closeButton!.click()
    await nextTick()
    await flushPromises()
    expect(document.querySelector('.n-dialog')).not.toBeNull()
  })

  it('遮罩点击在无修改时直接关闭，有修改时先二次确认', async () => {
    wrapper = await mountModal({ show: true, materialId: 9 })
    const nModal = modal(wrapper).findComponent(NModal)
    expect(nModal.props('maskClosable')).toBe(false)
    expect(nModal.props('closeOnEsc')).toBe(false)

    // 无修改：直接请求关闭
    nModal.vm.$emit('mask-click')
    await nextTick()
    await flushPromises()
    expect(document.querySelector('.n-dialog')).toBeNull()

    // 有修改：先弹确认，不立即关
    await setInputValue(wrapper, '塑壳断路器', '改过了')
    nModal.vm.$emit('mask-click')
    await nextTick()
    await flushPromises()
    expect(document.querySelector('.n-dialog')).not.toBeNull()
    expect(document.body.textContent).toContain('放弃未保存的修改？')
  })

  it('图片上传在途时保存按钮禁用，上传结束后恢复可点（组件级联动）', async () => {
    const resolvers: Array<(value: FileObject) => void> = []
    vi.mocked(fileApiUpload.uploadImage).mockImplementation(
      () => new Promise<FileObject>((resolve) => resolvers.push(resolve)),
    )
    URL.createObjectURL = vi.fn(() => 'blob:preview')
    URL.revokeObjectURL = vi.fn()
    wrapper = await mountModal({ show: true, materialId: 9, realUploader: true })

    const saveButton = findButton(wrapper, '保存修改')!
    expect(saveButton.props('disabled')).not.toBe(true)

    // 通过真实的 ImageUploader 注入一个文件并让它停留在上传中
    const uploader = modal(wrapper).findComponent(ImageUploader)
    const input = uploader.find('input[type="file"]')
    Object.defineProperty(input.element, 'files', {
      value: [new File(['x'], 'p.png', { type: 'image/png' })],
      configurable: true,
    })
    await input.trigger('change')
    await flushPromises()

    expect(fileApiUpload.uploadImage).toHaveBeenCalledTimes(1)
    expect(findButton(wrapper, '保存修改')!.props('disabled')).toBe(true)

    // 上传结束：该项离开队列，保存按钮恢复可点
    const uploaded: FileObject = {
      id: '019uploaded',
      original_name: 'p.png',
      mime_type: 'image/png',
      size_bytes: 1,
      width: 10,
      height: 10,
    }
    resolvers[0](uploaded)
    await flushPromises()
    expect(findButton(wrapper, '保存修改')!.props('disabled')).not.toBe(true)
  })
})
