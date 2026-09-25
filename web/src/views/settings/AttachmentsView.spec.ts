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
