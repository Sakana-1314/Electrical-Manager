import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { NDialogProvider, NMessageProvider } from 'naive-ui'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { fileApi } from '@/api/files'
import type { FileObject } from '@/api/generated'
import { dedupMinBytes } from '@/utils/image'
import { sha256Hex } from '@/utils/sha256'
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
    checkImageDigest: vi.fn(),
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

/** 大于 1MB 的图片：只有这类文件才走「先摘要查重」的路径。 */
function bigFile(): { bytes: Uint8Array; file: File } {
  const bytes = new Uint8Array(dedupMinBytes + 1)
  for (let index = 0; index < bytes.length; index += 1) bytes[index] = (index * 13) % 256
  return { bytes, file: new File([bytes], 'big.png', { type: 'image/png' }) }
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

  it('不渲染格式/大小/数量的小字描述，只靠选择框限定扩展名', () => {
    const wrapper = mountUploader()
    const target = uploaderOf(wrapper)

    // 小字提示行已移除：格式由 accept 限定，超量/超大在选中后拦截
    expect(target.find('.image-hint').exists()).toBe(false)
    expect(target.text()).not.toContain('Ctrl+V')
    expect(target.text()).not.toContain('10 MB')
    expect(target.find('input[type="file"]').attributes('accept')).toBe(
      'image/jpeg,image/png,image/webp',
    )
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

describe('ImageUploader 摘要查重（>1MB 免重复上传）', () => {
  it('命中且本地二次校验通过：不重复上传，直接用已有图片', async () => {
    const { bytes, file } = bigFile()
    const slice = { offset: 4096, length: 1024 }
    vi.mocked(fileApi.checkImageDigest).mockResolvedValue({
      matched: true,
      file: uploadedFile,
      offset: slice.offset,
      length: slice.length,
      slice_sha256: sha256Hex(bytes.subarray(slice.offset, slice.offset + slice.length)),
    })
    const wrapper = mountUploader()
    const target = uploaderOf(wrapper)

    await selectFiles(target, [file])
    // 摘要校验要跨「分块读取 + 让出主线程 + 一次接口往返」，等状态收敛再断言
    await vi.waitFor(() => expect(target.emitted('update:files')).toBeDefined())

    expect(fileApi.checkImageDigest).toHaveBeenCalledTimes(1)
    expect(vi.mocked(fileApi.checkImageDigest).mock.calls[0][0]).toEqual({
      sha256: sha256Hex(bytes),
      size_bytes: file.size,
    })
    expect(fileApi.uploadImage).not.toHaveBeenCalled()
    expect(target.emitted('update:files')).toEqual([[[uploadedFile]]])
    expect(message.info).toHaveBeenCalledWith(
      '检测到服务器上已存在相同图片，已直接复用、免于重复上传',
    )
    expect(target.findAll('.upload-item')).toHaveLength(0)
  })

  it('校验期间显示「比对已有图片…」', async () => {
    const { file } = bigFile()
    let resolveMatch: ((value: unknown) => void) | undefined
    vi.mocked(fileApi.checkImageDigest).mockImplementation(
      () => new Promise((resolve) => (resolveMatch = resolve)) as never,
    )
    vi.mocked(fileApi.uploadImage).mockResolvedValue(uploadedFile)
    const wrapper = mountUploader()
    const target = uploaderOf(wrapper)

    await selectFiles(target, [file])
    await vi.waitFor(() => expect(target.find('.upload-status').text()).toBe('比对已有图片…'))

    // 未命中时退回正常上传
    resolveMatch?.({ matched: false, file: null, offset: null, length: null, slice_sha256: null })
    await vi.waitFor(() => expect(fileApi.uploadImage).toHaveBeenCalledTimes(1))
  })

  it('命中但本地摘要对不上：退回正常上传', async () => {
    const { file } = bigFile()
    vi.mocked(fileApi.checkImageDigest).mockResolvedValue({
      matched: true,
      file: uploadedFile,
      offset: 0,
      length: 1024,
      slice_sha256: 'b'.repeat(64),
    })
    vi.mocked(fileApi.uploadImage).mockResolvedValue(uploadedFile)
    const wrapper = mountUploader()
    const target = uploaderOf(wrapper)

    await selectFiles(target, [file])
    await vi.waitFor(() => expect(fileApi.uploadImage).toHaveBeenCalledTimes(1))

    expect(fileApi.checkImageDigest).toHaveBeenCalledTimes(1)
    expect(target.emitted('update:files')).toEqual([[[uploadedFile]]])
  })

  it('查重接口异常：静默降级为正常上传', async () => {
    const { file } = bigFile()
    vi.mocked(fileApi.checkImageDigest).mockRejectedValue(new Error('查重失败'))
    vi.mocked(fileApi.uploadImage).mockResolvedValue(uploadedFile)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const wrapper = mountUploader()
    const target = uploaderOf(wrapper)

    await selectFiles(target, [file])
    await vi.waitFor(() => expect(fileApi.uploadImage).toHaveBeenCalledTimes(1))

    expect(target.emitted('update:files')).toEqual([[[uploadedFile]]])
    expect(warn).toHaveBeenCalled()
  })

  it('不超过 1MB 的图片不查重，直接上传', async () => {
    vi.mocked(fileApi.uploadImage).mockResolvedValue(uploadedFile)
    const wrapper = mountUploader()
    const target = uploaderOf(wrapper)
    const file = new File([new Uint8Array(dedupMinBytes)], 'small.png', { type: 'image/png' })

    await selectFiles(target, [file])
    await flushPromises()

    expect(fileApi.checkImageDigest).not.toHaveBeenCalled()
    expect(fileApi.uploadImage).toHaveBeenCalledTimes(1)
  })

  it('比对中移除该项：不再上传，也不抛出复用结果', async () => {
    const { bytes, file } = bigFile()
    let resolveMatch: ((value: unknown) => void) | undefined
    vi.mocked(fileApi.checkImageDigest).mockImplementation(
      () => new Promise((resolve) => (resolveMatch = resolve)) as never,
    )
    const wrapper = mountUploader()
    const target = uploaderOf(wrapper)

    await selectFiles(target, [file])
    await flushPromises()
    await target.find('.upload-btn--danger').trigger('click')
    await flushPromises()
    expect(target.findAll('.upload-item')).toHaveLength(0)

    resolveMatch?.({
      matched: true,
      file: uploadedFile,
      offset: 0,
      length: 1024,
      slice_sha256: sha256Hex(bytes.subarray(0, 1024)),
    })
    await flushPromises()

    expect(fileApi.uploadImage).not.toHaveBeenCalled()
    expect(target.emitted('update:files')).toBeUndefined()
  })
})
