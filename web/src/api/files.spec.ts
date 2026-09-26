import type { AxiosAdapter, AxiosResponse } from 'axios'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { FileObject } from './generated'
import { apiClient } from './client'
import { IMAGE_UPLOAD_TIMEOUT_MS, fileApi } from './files'

const uploaded: FileObject = {
  id: '019uploaded',
  original_name: 'p.png',
  mime_type: 'image/png',
  size_bytes: 3,
  width: 10,
  height: 10,
}

describe('图片上传超时', () => {
  const originalAdapter = apiClient.defaults.adapter
  let timeouts: Array<number | undefined> = []

  beforeEach(() => {
    timeouts = []
    // 用适配器截住请求，只看本次请求实际生效的 timeout，不真的发出去。
    apiClient.defaults.adapter = ((config) => {
      timeouts.push(config.timeout)
      return Promise.resolve({
        data: uploaded,
        status: 201,
        statusText: 'Created',
        headers: {},
        config,
      } as AxiosResponse)
    }) as AxiosAdapter
  })

  afterEach(() => {
    apiClient.defaults.adapter = originalAdapter
  })

  it('上传图片用 30 分钟，而不是全局的 30s', async () => {
    await fileApi.uploadImage(new File(['abc'], 'p.png', { type: 'image/png' }))

    expect(IMAGE_UPLOAD_TIMEOUT_MS).toBe(30 * 60_000)
    expect(timeouts).toEqual([IMAGE_UPLOAD_TIMEOUT_MS])
    // 全局默认仍是 30s，只有上传这一条被放宽
    expect(apiClient.defaults.timeout).toBe(30_000)
  })

  it('查重等其它图片接口不受影响，仍用全局默认', async () => {
    await fileApi.checkImageDigest({ sha256: 'a'.repeat(64), size_bytes: 3 })

    // axios 会把全局默认解析进请求 config，所以这里是 30s 而非 IMAGE_UPLOAD_TIMEOUT_MS
    expect(timeouts).toEqual([30_000])
  })
})
