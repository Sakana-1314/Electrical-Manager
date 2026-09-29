import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import {
  NButton,
  NCard,
  NDataTable,
  NDialogProvider,
  NImage,
  NInput,
  NMessageProvider,
  NPagination,
  NSelect,
  NSpace,
  NTag,
} from 'naive-ui'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import type { Attachment } from '@/api/generated'
import { fileApi } from '@/api/files'
import AttachmentsView from './AttachmentsView.vue'

vi.mock('@/api/files', () => ({
  fileApi: {
    listAttachments: vi.fn(),
    removeImage: vi.fn(),
    restoreAttachment: vi.fn(),
    previewDeleteUnreferenced: vi.fn(),
    deleteUnreferenced: vi.fn(),
  },
}))

const api = vi.mocked(fileApi)

// jsdom 没有 ResizeObserver，naive-ui 的 NDataTable 会用到它来测量列宽。
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver

const attachment = (overrides: Partial<Attachment> = {}): Attachment => ({
  id: '019abc',
  original_name: '接触器.jpg',
  mime_type: 'image/png',
  size_bytes: 486912,
  width: 1600,
  height: 1200,
  created_at: '2026-09-13T01:12:00Z',
  reference_count: 0,
  deleted_at: null,
  file_exists: true,
  ...overrides,
})

const Host = defineComponent({
  render: () =>
    h(NMessageProvider, null, {
      default: () => h(NDialogProvider, null, { default: () => h(AttachmentsView) }),
    }),
})

let wrapper: VueWrapper | null = null

async function mountView(items: Attachment[]): Promise<VueWrapper> {
  api.listAttachments.mockResolvedValue({ items, page: 1, page_size: 200, total: items.length })
  wrapper = mount(Host, {
    attachTo: document.body,
    global: {
      // 单测环境未启用 unplugin-vue-components，需显式注册模板里的 n-* 组件。
      components: {
        NButton,
        NCard,
        NDataTable,
        NDialogProvider,
        NImage,
        NInput,
        NMessageProvider,
        NPagination,
        NSelect,
        NSpace,
        NTag,
      },
    },
  })
  await flushPromises()
  return wrapper
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  document.body.innerHTML = ''
})

describe('AttachmentsView 预览列', () => {
  it('在用附件展示缩略图', async () => {
    const view = await mountView([attachment({ id: 'used-file' })])

    const image = view.findComponent(NImage)
    expect(image.exists()).toBe(true)
    expect(image.props('src')).toContain('used-file')
  })

  it('待删除（保留期内）附件同样展示缩略图，并用降透明度区分', async () => {
    const view = await mountView([
      attachment({ id: 'deleted-file', deleted_at: '2026-09-20T00:00:00Z' }),
    ])

    // 关键：预览列不再退化成纯文字，而是照常给出预览图（状态列仍显示「待删除」标签）
    const image = view.findComponent(NImage)
    expect(image.exists()).toBe(true)
    expect(image.props('src')).toContain('deleted-file')
    // 待删除的缩略图降透明度区分（style 落在根元素上）
    expect(image.attributes('style') ?? '').toContain('opacity')
    expect(view.text()).toContain('撤销删除')
  })

  it('磁盘文件缺失时不请求图片，只提示文件缺失', async () => {
    const view = await mountView([attachment({ id: 'missing-file', file_exists: false })])

    expect(view.findComponent(NImage).exists()).toBe(false)
    expect(view.text()).toContain('文件缺失')
  })
})

/** 点页面里的按钮（弹窗按钮挂在 body 上，用下面的 helper）。 */
async function clickViewButton(view: VueWrapper, text: string): Promise<void> {
  const button = view.findAllComponents(NButton).find((item) => item.text().includes(text))
  if (!button) throw new Error(`找不到按钮：${text}`)
  await button.trigger('click')
  await flushPromises()
}

/** 点弹窗按钮（弹窗挂在 body 上）。 */
async function clickDialogButton(text: string): Promise<void> {
  // 只在弹窗里找：表格行内也有「删除」按钮，全局找会误点。
  const button = [...document.body.querySelectorAll<HTMLButtonElement>('.n-dialog button')].find(
    (item) => item.textContent?.trim() === text,
  )
  if (!button) throw new Error(`找不到弹窗按钮：${text}`)
  button.click()
  await flushPromises()
}

describe('删除未引用附件：先出清单再删除', () => {
  it('预检清单展示将被标记的图片与保护期说明，确认后才真正提交', async () => {
    const view = await mountView([attachment({ id: 'free-file' })])
    api.previewDeleteUnreferenced.mockResolvedValue({
      total: 2,
      protected_count: 1,
      protect_days: 7,
      purge_after: '2026-10-02T18:00:00Z',
      items: [
        attachment({ id: 'old-1', original_name: '旧图.png' }),
        attachment({ id: 'old-2', original_name: '更旧图.png' }),
      ],
    })
    api.deleteUnreferenced.mockResolvedValue({
      deleted_count: 2,
      skipped_recent_count: 1,
      purge_after: '2026-10-02T18:00:00Z',
    })

    await clickViewButton(view, '删除未引用')

    // 预检弹窗里能看到数量、明细与保护期说明，此时还没有执行删除
    expect(document.body.textContent).toContain('将被标记为待删除：2 张')
    expect(document.body.textContent).toContain('旧图.png')
    expect(document.body.textContent).toContain('新人保护期')
    expect(api.deleteUnreferenced).not.toHaveBeenCalled()

    await clickDialogButton('删除')

    expect(api.deleteUnreferenced).toHaveBeenCalledTimes(1)
    expect(document.body.textContent).toContain('已提交 2 张未引用图片的删除')
    expect(document.body.textContent).toContain('另有 1 张处于新人保护期')
  })

  it('没有可删除的附件时只提示，不调用删除接口', async () => {
    const view = await mountView([attachment({ id: 'fresh-file' })])
    api.previewDeleteUnreferenced.mockResolvedValue({
      total: 0,
      protected_count: 3,
      protect_days: 7,
      purge_after: '2026-10-02T18:00:00Z',
      items: [],
    })

    await clickViewButton(view, '删除未引用')

    expect(document.body.textContent).toContain('没有需要删除的未引用附件')
    expect(document.body.textContent).toContain('新人保护期')
    expect(api.deleteUnreferenced).not.toHaveBeenCalled()
  })

  it('预检失败时提示错误，不执行删除', async () => {
    const view = await mountView([attachment({ id: 'free-file' })])
    api.previewDeleteUnreferenced.mockRejectedValue(new Error('预检炸了'))

    await clickViewButton(view, '删除未引用')

    expect(document.body.textContent).toContain('预检炸了')
    expect(api.deleteUnreferenced).not.toHaveBeenCalled()
  })
})
