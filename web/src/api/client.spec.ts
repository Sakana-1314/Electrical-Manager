import type { AxiosAdapter, AxiosResponse, InternalAxiosRequestConfig } from 'axios'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { apiClient } from './client'

describe('apiClient 的当前项目请求头', () => {
  const originalAdapter = apiClient.defaults.adapter

  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    apiClient.defaults.adapter = originalAdapter
    localStorage.clear()
  })

  /** 替换适配器，记录每次请求实际带上的请求头。 */
  function captureHeaders(): Array<Record<string, unknown>> {
    const headers: Array<Record<string, unknown>> = []
    const adapter: AxiosAdapter = (config: InternalAxiosRequestConfig) => {
      headers.push(config.headers as Record<string, unknown>)
      return Promise.resolve({
        data: { ok: true },
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      } as AxiosResponse)
    }
    apiClient.defaults.adapter = adapter
    return headers
  }

  it('localStorage 有 current_project_id 时注入 X-Project-Id', async () => {
    localStorage.setItem('current_project_id', '5')
    const headers = captureHeaders()

    await apiClient.get('/inventory/balances')

    expect(headers[0]['X-Project-Id']).toBe('5')
  })

  it('未选择项目时不带 X-Project-Id（由后端按 PROJECT_REQUIRED 拒绝）', async () => {
    const headers = captureHeaders()

    await apiClient.get('/inventory/balances')

    expect(headers[0]['X-Project-Id']).toBeUndefined()
  })

  it('项目列表请求同样按本地记录携带（服务端不要求，行为保持一致）', async () => {
    localStorage.setItem('current_project_id', '12')
    const headers = captureHeaders()

    await apiClient.get('/projects')

    expect(headers[0]['X-Project-Id']).toBe('12')
  })
})
