import { describe, expect, it } from 'vitest'
import {
  configureImageBaseUrl,
  dedupMinBytes,
  imagePreviewUrl,
  imageUrl,
  matchesDedupSlice,
  maxImageBytes,
  shouldCheckDuplicate,
  validateImageSelection,
  type DedupSlice,
} from './image'
import { sha256Hex } from './sha256'

describe('图片上传限制', () => {
  it('只接受 JPG、PNG 和 WebP', () => {
    expect(
      validateImageSelection(0, [new File(['x'], 'part.gif', { type: 'image/gif' })]),
    ).toContain('不是支持的图片类型')
  })
  it('限制单图 10 MB', () => {
    const file = new File([new Uint8Array(maxImageBytes + 1)], 'large.png', { type: 'image/png' })
    expect(validateImageSelection(0, [file])).toContain('超过 10 MB')
  })
  it('每个物资最多九张', () => {
    const file = new File(['x'], 'ok.webp', { type: 'image/webp' })
    expect(validateImageSelection(9, [file])).toContain('最多上传 9 张')
  })
  it('仅根据文件 ID 拼接图片地址', () => {
    configureImageBaseUrl('')
    expect(imageUrl('019abc')).toBe('/api/v1/files/images/019abc')
    expect(imagePreviewUrl('019abc', 192)).toBe('/api/v1/files/images/019abc?size=192')
  })
  it('使用运行时配置的图片加速服务器', () => {
    configureImageBaseUrl('https://images.example.com')
    expect(imageUrl('019abc')).toBe('https://images.example.com/api/v1/files/images/019abc')
    configureImageBaseUrl('')
  })
})

describe('免重复上传的摘要校验', () => {
  it('只有大于 1MB 的图片才查重（恰好 1MB 不查）', () => {
    const atLimit = new File([new Uint8Array(dedupMinBytes)], 'at-limit.png', {
      type: 'image/png',
    })
    const above = new File([new Uint8Array(dedupMinBytes + 1)], 'above.png', {
      type: 'image/png',
    })
    expect(shouldCheckDuplicate(atLimit)).toBe(false)
    expect(shouldCheckDuplicate(above)).toBe(true)
  })

  it('本地同位置字节摘要一致时通过校验', async () => {
    const bytes = new Uint8Array(4096)
    for (let index = 0; index < bytes.length; index += 1) bytes[index] = (index * 17) % 256
    const file = new File([bytes], 'big.png', { type: 'image/png' })
    const slice = bytes.subarray(1024, 2048)

    await expect(
      matchesDedupSlice(file, {
        offset: 1024,
        length: 1024,
        slice_sha256: sha256Hex(slice),
      }),
    ).resolves.toBe(true)
  })

  it('摘要对不上（换了片段 / 大小写不同以外的不符）时不通过', async () => {
    const file = new File([new Uint8Array(4096)], 'big.png', { type: 'image/png' })
    await expect(
      matchesDedupSlice(file, { offset: 0, length: 1024, slice_sha256: 'a'.repeat(64) }),
    ).resolves.toBe(false)
  })

  it('摘要大小写不敏感', async () => {
    const bytes = new Uint8Array(2048).fill(7)
    const file = new File([bytes], 'big.png', { type: 'image/png' })
    const digest = sha256Hex(bytes.subarray(0, 1024)).toUpperCase()

    await expect(
      matchesDedupSlice(file, { offset: 0, length: 1024, slice_sha256: digest }),
    ).resolves.toBe(true)
  })

  it('挑战材料不完整或越界一律不通过（退回正常上传）', async () => {
    const file = new File([new Uint8Array(1024)], 'big.png', { type: 'image/png' })
    const digest = sha256Hex(new Uint8Array(1024))

    const cases: DedupSlice[] = [
      {},
      { offset: null, length: null, slice_sha256: null },
      { offset: 0, length: 1024 },
      { offset: 0, length: 1024, slice_sha256: null },
      { offset: -1, length: 512, slice_sha256: digest },
      { offset: 0, length: 0, slice_sha256: digest },
      { offset: 512, length: 1024, slice_sha256: digest },
      { offset: 1.5, length: 512, slice_sha256: digest },
    ]
    for (const slice of cases) {
      await expect(matchesDedupSlice(file, slice), JSON.stringify(slice)).resolves.toBe(false)
    }
  })
})
