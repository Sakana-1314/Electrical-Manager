import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { NDialogProvider, NMessageProvider } from 'naive-ui'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { fileApi } from '@/api/files'
import type { FileObject } from '@/api/generated'
import ImageUploader from './ImageUploader.vue'

const message = {
  error: vi.fn(),
  info: vi.fn(),
  warning: vi.fn(),
}

vi.mock('naive-ui', async (importOriginal) => ({
  ...(await importOriginal<typeof import('naive-ui')>()),
  useMessage: () => message,
}))

vi.mock('@/api/files', () => ({
  fileApi: {
    uploadImage: vi.fn(),
    removeImage: vi.fn(),
  },
}))

const uploadedFile: FileObject = {
  id: '019clipboard',
  original_name: 'clipboard.png',
  mime_type: 'image/png',
  size_bytes: 4,
  width: 10,
  height: 10,
}

function pasteEvent(file: File | null): ClipboardEvent {
  const event = new Event('paste', { bubbles: true, cancelable: true }) as ClipboardEvent
  Object.defineProperty(event, 'clipboardData', {
    value: {
      items: file
        ? [{ kind: 'file', type: file.type, getAsFile: () => file }]
        : [{ kind: 'string', type: 'text/plain', getAsFile: () => null }],
    },
  })
  return event
}

/** 上传组件用到 useDialog / useMessage，必须挂在对应 provider 下。 */
function mountUploader(files: FileObject[] = [], props: Record<string, unknown> = {}) {
  const host = defineComponent({
    render: () =>
      h(NDialogProvider, null, {
        default: () =>
          h(NMessageProvider, null, {
            default: () => h(ImageUploader, { files, ...props }),
          }),
      }),
  })
  return mount(host, {
    attachTo: document.body,
    global: { stubs: { NButton: true, NImage: true } },
  })
}

function uploaderOf(wrapper: VueWrapper): VueWrapper {
  return wrapper.findComponent(ImageUploader) as unknown as VueWrapper
}

/** 通过 file input 的 change 事件注入选中的文件（等同用户多选）。 */
async function selectFiles(target: VueWrapper, files: File[]) {
  const input = target.find('input[type="file"]')
  Object.defineProperty(input.element, 'files', { value: files, configurable: true })
  await input.trigger('change')
  await flushPromises()
}

/** 触发粘贴：在宿主元素上派发原生 paste 事件（不能用 trigger，会被测 utils 改写 isTrusted）。 */
async function paste(target: VueWrapper, event: ClipboardEvent) {
  target.find('.image-uploader').element.dispatchEvent(event)
  await flushPromises()
}

beforeEach(() => {
  vi.clearAllMocks()
  // jsdom 未实现 createObjectURL
  URL.createObjectURL = vi.fn(() => 'blob:preview')
  URL.revokeObjectURL = vi.fn()
})

describe('ImageUploader', () => {
  it('uploads an image pasted from the clipboard', async () => {
    vi.mocked(fileApi.uploadImage).mockResolvedValue(uploadedFile)
    const wrapper = mountUploader()
    const target = uploaderOf(wrapper)
    const clipboardFile = new File(['image'], 'clipboard.png', { type: 'image/png' })

    await paste(target, pasteEvent(clipboardFile))

    expect(fileApi.uploadImage).toHaveBeenCalledTimes(1)
    expect(vi.mocked(fileApi.uploadImage).mock.calls[0][0]).toBe(clipboardFile)
    expect(target.emitted('update:files')).toEqual([[[uploadedFile]]])
  })

  it('warns when the clipboard contains no image', async () => {
    const wrapper = mountUploader()
    const target = uploaderOf(wrapper)
    await paste(target, pasteEvent(null))

    expect(fileApi.uploadImage).not.toHaveBeenCalled()
    expect(message.warning).toHaveBeenCalledWith('剪贴板中没有可粘贴的图片')
  })

  it('最多同时上传 2 个，其余排队（不一次性全部发出）', async () => {
    const resolvers: Array<(value: FileObject) => void> = []
    vi.mocked(fileApi.uploadImage).mockImplementation(
      () => new Promise<FileObject>((resolve) => resolvers.push(resolve)),
    )
    const wrapper = mountUploader()
    const target = uploaderOf(wrapper)
    const files = Array.from(
      { length: 5 },
      (_, i) => new File(['x'], `p${i}.png`, { type: 'image/png' }),
    )

    await selectFiles(target, files)

    // 并发上限 2：只有两个请求在途，其余 3 个排队
    expect(fileApi.uploadImage).toHaveBeenCalledTimes(2)
    const texts = target.findAll('.upload-status').map((node) => node.text())
    expect(texts.filter((text) => text === '排队中')).toHaveLength(3)

    // 放行一个 -> 队列补上一个，在途始终不超过 2
    resolvers[0](uploadedFile)
    await flushPromises()
    expect(fileApi.uploadImage).toHaveBeenCalledTimes(3)
  })

  it('逐个显示上传进度（onUploadProgress 回调驱动）', async () => {
    let reportProgress: ((percent: number) => void) | undefined
    const resolvers: Array<(value: FileObject) => void> = []
    vi.mocked(fileApi.uploadImage).mockImplementation((_file, onProgress) => {
      reportProgress = onProgress
      return new Promise<FileObject>((resolve) => resolvers.push(resolve))
    })
    const wrapper = mountUploader()
    const target = uploaderOf(wrapper)
    const file = new File(['x'], 'p.png', { type: 'image/png' })

    await selectFiles(target, [file])

    reportProgress?.(42)
    await flushPromises()

    expect(target.find('.upload-status').text()).toBe('上传中 42%')
    expect(target.find('.upload-progress-fill').attributes('style')).toContain('width: 42%')
    resolvers[0](uploadedFile)
    await flushPromises()
  })

  it('失败的项可重试，成功后才并入 files', async () => {
    vi.mocked(fileApi.uploadImage)
      .mockRejectedValueOnce(new Error('图片上传失败'))
      .mockResolvedValueOnce(uploadedFile)
    const wrapper = mountUploader()
    const target = uploaderOf(wrapper)
    const file = new File(['x'], 'p.png', { type: 'image/png' })

    await selectFiles(target, [file])

    expect(target.find('.upload-status').text()).toBe('图片上传失败')
    expect(target.emitted('update:files')).toBeUndefined()

    await flushPromises()
    const retryButton = [...target.findAll('.upload-btn')].find((b) => b.text().includes('重试'))
    await retryButton!.trigger('click')
    await flushPromises()

    expect(target.emitted('update:files')).toEqual([[[uploadedFile]]])
  })

  it('移除图片需要二次确认，确认后才真正删除', async () => {
    vi.mocked(fileApi.removeImage).mockResolvedValue({} as never)
    const wrapper = mountUploader([uploadedFile])
    const target = uploaderOf(wrapper)

    // 点删除只弹确认弹窗，不直接删
    await target.find('.remove').trigger('click')
    await flushPromises()
    expect(document.querySelector('.n-dialog')).not.toBeNull()
    expect(fileApi.removeImage).not.toHaveBeenCalled()

    // 点「删除」才真正删除，并向上抛新列表
    const confirm = [...document.querySelectorAll<HTMLButtonElement>('.n-dialog button')].find(
      (button) => button.textContent?.includes('删除'),
    )
    confirm?.click()
    await flushPromises()

    expect(fileApi.removeImage).toHaveBeenCalledWith(uploadedFile.id)
    expect(target.emitted('update:files')).toEqual([[[]]])
  })
})
