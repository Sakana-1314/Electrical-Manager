import { AxiosError, type AxiosAdapter, type AxiosResponse } from 'axios'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/config/env', () => ({
  apiBaseUrls: ['https://a.example.com/api/v1', 'https://b.example.com/api/v1'],
  joinUrl: (baseUrl: string, path: string) =>
    `${baseUrl.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`,
}))

import { BACKEND_STORAGE_KEY, activeBackendUrl, selectBackend } from './backend'
import { apiClient } from './client'

const lineA = 'https://a.example.com/api/v1'
const lineB = 'https://b.example.com/api/v1'

describe('apiClient 的双后端切换', () => {
  const originalAdapter = apiClient.defaults.adapter

  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    selectBackend(0)
    sessionStorage.clear()
  })

  afterEach(() => {
    apiClient.defaults.adapter = originalAdapter
    sessionStorage.clear()
  })

  function okResponse<T>(data: T, config: Parameters<AxiosAdapter>[0]): AxiosResponse<T> {
    return { data, status: 200, statusText: 'OK', headers: {}, config }
  }

  it('网络类错误后切到另一条线路，后续请求使用新地址', async () => {
    const seen: string[] = []
    apiClient.defaults.adapter = ((config) => {
      seen.push(String(config.baseURL))
      if (seen.length === 1) {
        return Promise.reject(new AxiosError('Network Error', 'ERR_NETWORK', config))
      }
      return Promise.resolve(okResponse({ ok: true }, config))
    }) satisfies AxiosAdapter

    await expect(apiClient.get('/version', { retry: false })).rejects.toMatchObject({
      code: 'NETWORK_ERROR',
    })
    expect(activeBackendUrl()).toBe(lineB)
    expect(sessionStorage.getItem(BACKEND_STORAGE_KEY)).toBe(lineB)

    await apiClient.get('/version')
    expect(seen).toEqual([lineA, lineB])
  })

  it('业务 5xx 不切换线路', async () => {
    apiClient.defaults.adapter = ((config) =>
      Promise.reject(
        new AxiosError('Server Error', 'ERR_BAD_RESPONSE', config, undefined, {
          data: { code: 'SERVER_ERROR', message: '服务异常', request_id: 'r1' },
          status: 500,
          statusText: 'Internal Server Error',
          headers: {},
          config,
        }),
      )) satisfies AxiosAdapter

    await expect(apiClient.get('/version', { retry: false })).rejects.toMatchObject({
      code: 'SERVER_ERROR',
    })
    expect(activeBackendUrl()).toBe(lineA)
  })
})
