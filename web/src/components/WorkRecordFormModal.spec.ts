import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { NDialogProvider, NMessageProvider, NModal, NSelect } from 'naive-ui'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import type { WorkRecord, WorkTask } from '@/api/generated'
import { workApi } from '@/api/work'
import WorkRecordFormModal from './WorkRecordFormModal.vue'

vi.mock('@/api/work', () => ({
  workApi: {
    tasks: vi.fn(),
    participants: vi.fn(),
    record: vi.fn(),
    createRecord: vi.fn(),
    updateRecord: vi.fn(),
    deleteRecord: vi.fn(),
  },
}))

const api = vi.mocked(workApi)

const task: WorkTask = { id: 3, name: '更换接触器', status: '进行中' } as WorkTask
const record = {
  id: 11,
  task_id: 3,
  start_date: '2026-09-01',
  start_half: 'AM',
  end_date: '2026-09-02',
  end_half: 'PM',
  participants: ['张三'],
  remark: '备注',
  version: 2,
} as unknown as WorkRecord

let wrapper: VueWrapper | null = null
/** `update:show` 的取值记录。用监听器 props 而不是 `wrapper.emitted()`：本仓库的 VTU 版本
 * 观测不到 `<script setup>` 组件的 emit（既有多个 spec 同样受此影响）。 */
let showValues: boolean[] = []
/** 由 ModalHost 在 setup 时赋值：用于「打开弹窗」这一步。 */
let openModal: (() => void) | null = null

/**
 * 包一层持有 `show`，复刻页面「先挂载、后打开」的时序。
 *
 * 必须用 `expose` 把开关抛出来：`setup` 返回渲染函数时，内部 ref 不会挂到 `vm` 上，
 * 直接 `host.vm.show = true` 只是给代理加了个无效属性，`watch` 根本不会触发。
 */
const ModalHost = defineComponent({
  props: {
    readonly: { type: Boolean, default: false },
    recordId: { type: Number, default: 11 },
  },
  setup(props) {
    const show = ref(false)
    openModal = () => {
      show.value = true
    }
    return () =>
      h(WorkRecordFormModal, {
        show: show.value,
        recordId: props.recordId,
        readonly: props.readonly,
        'onUpdate:show': (value: boolean) => {
          showValues.push(value)
          show.value = value
        },
      })
  },
})

/**
 * 遮罩 / ESC / × 三条路径都由弹窗内部转发到 `requestClose`，jsdom 里点不到真实遮罩
 * （mask 元素在 teleport + lazy 之下），因此这里直接触发 NModal 暴露的同名事件，
 * 等价于组件库在遮罩点击时调用 `handleClickoutside`。
 */
async function mountModal(props: { readonly?: boolean; recordId?: number | null } = {}) {
  showValues = []
  openModal = null
  // 真实用法是「挂载时弹窗关着，点开才置 show=true」，组件的 watch 才会跑 prepare()；
  // 直接以 show=true 挂载会跳过加载与基线记录，测到的不是真实状态。
  wrapper = mount(NDialogProvider, {
    attachTo: document.body,
    slots: {
      default: () =>
        h(NMessageProvider, null, {
          default: () =>
            h(ModalHost, { readonly: props.readonly ?? false, recordId: props.recordId ?? 11 }),
        }),
    },
    global: { components: { NModal, NSelect } },
  })
  // mount 期间 ModalHost 的 setup 会把 openModal 赋上真正可用的回调
  ;(openModal as (() => void) | null)?.()
  await flushPromises()
  return wrapper
}

function modal(w: VueWrapper) {
  return w.findComponent(WorkRecordFormModal)
}

/** 真正要求关闭：`update:show=false` 被抛出。 */
function closed(): boolean {
  return showValues.includes(false)
}

function dialogText(): string {
  return document.querySelector('.n-dialog')?.textContent ?? ''
}

beforeEach(() => {
  vi.clearAllMocks()
  api.tasks.mockResolvedValue({ items: [task], page: 1, page_size: 200, total: 1 })
  api.participants.mockResolvedValue(['张三', '李四'])
  api.record.mockResolvedValue(record)
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  document.body.innerHTML = ''
})

describe('WorkRecordFormModal 详情弹窗关闭', () => {
  it('禁用组件库自身的遮罩与 ESC 关闭，改由 requestClose 收口', async () => {
    const w = await mountModal()
    const nModal = modal(w).findComponent(NModal)

    // 这两个开关若为 true，naive 会直接改 show、绕过未保存修改的确认
    expect(nModal.props('maskClosable')).toBe(false)
    expect(nModal.props('closeOnEsc')).toBe(false)
  })

  it('无修改时点遮罩直接关闭，不弹确认', async () => {
    const w = await mountModal()
    const nModal = modal(w).findComponent(NModal)

    nModal.vm.$emit('mask-click')
    await nextTick()
    await flushPromises()

    expect(closed()).toBe(true)
    expect(document.querySelector('.n-dialog')).toBeNull()
  })

  it('有未保存修改时点遮罩只弹确认，未确认前不关闭', async () => {
    const w = await mountModal()
    // 改一个字段造成脏数据
    const select = modal(w).findComponent(NSelect)
    select.vm.$emit('update:value', 99)
    await nextTick()
    await flushPromises()

    modal(w).findComponent(NModal).vm.$emit('mask-click')
    await nextTick()
    await flushPromises()

    expect(document.querySelector('.n-dialog')).not.toBeNull()
    expect(dialogText()).toContain('放弃未保存的修改？')
    // 尚未真正关闭
    expect(closed()).toBe(false)
  })

  it('只读看详情时点遮罩直接关闭，不把回填数据当用户改动', async () => {
    const w = await mountModal({ readonly: true })

    modal(w).findComponent(NModal).vm.$emit('mask-click')
    await nextTick()
    await flushPromises()

    expect(closed()).toBe(true)
    expect(document.querySelector('.n-dialog')).toBeNull()
  })

  it('ESC 与右上角 × 走同一条路径', async () => {
    const w = await mountModal()
    const nModal = modal(w).findComponent(NModal)

    nModal.vm.$emit('esc')
    await nextTick()
    await flushPromises()
    expect(closed()).toBe(true)
  })

  it('右上角 × 在干净态必须真的关闭（@close 返回 false 不应把关闭也拦掉）', async () => {
    await mountModal()

    // 组件库在点 × 时调用 onClose；返回 false 只用于拦「继续编辑」，干净态仍要关
    const closeButton = document.querySelector<HTMLElement>('.n-card-header__close')
    expect(closeButton).not.toBeNull()
    closeButton!.click()
    await nextTick()
    await flushPromises()

    expect(closed()).toBe(true)
  })
})
