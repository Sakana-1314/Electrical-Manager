import {
  AxiosError,
  CanceledError,
  type AxiosAdapter,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AppError, apiClient } from './client'
import { MAX_ATTEMPTS, REQUEST_TIMEOUT_MS, isReplayable, retryDelayMs, shouldRetry } from './retry'

function configOf(overrides: Partial<InternalAxiosRequestConfig>): InternalAxiosRequestConfig {
  return { method: 'get', headers: {}, ...overrides } as InternalAxiosRequestConfig
}

function networkError(overrides: Partial<InternalAxiosRequestConfig> = {}): AxiosError {
  return new AxiosError('Network Error', AxiosError.ERR_NETWORK, configOf(overrides))
}

function statusError(
  status: number,
  overrides: Partial<InternalAxiosRequestConfig> = {},
): AxiosError {
  return statusFailure(status, configOf(overrides))
}

/** 与 axios 自带适配器一致：错误携带**本次请求实际的 config**，重试计数才接得上。 */
function networkFailure(config: InternalAxiosRequestConfig, code = AxiosError.ERR_NETWORK) {
  return new AxiosError('Network Error', code, config)
}

function statusFailure(status: number, config: InternalAxiosRequestConfig): AxiosError {
  return new AxiosError(`HTTP ${status}`, AxiosError.ERR_BAD_RESPONSE, config, null, {
    status,
    statusText: '',
    headers: {},
    config,
    data: {},
  })
}

describe('isReplayable', () => {
  it('缺省只重放无副作用的读请求', () => {
    expect(isReplayable(configOf({ method: 'get' }))).toBe(true)
    expect(isReplayable(configOf({ method: 'HEAD' }))).toBe(true)
    expect(isReplayable(configOf({ method: 'post' }))).toBe(false)
    expect(isReplayable(configOf({ method: 'PATCH' }))).toBe(false)
  })

  it('retry: true 让业务幂等的写请求可重放，retry: false 关闭重放', () => {
    expect(isReplayable(configOf({ method: 'post', retry: true }))).toBe(true)
    expect(isReplayable(configOf({ method: 'get', retry: false }))).toBe(false)
    expect(isReplayable(configOf({ method: 'post', retry: false }))).toBe(false)
  })
})

describe('shouldRetry', () => {
  it('连接层失败（断网 / 超时）在额度内重试', () => {
    expect(shouldRetry(networkError(), 0)).toBe(true)
    expect(shouldRetry(networkError(), MAX_ATTEMPTS - 2)).toBe(true)
    expect(shouldRetry(networkError(), MAX_ATTEMPTS - 1)).toBe(false)
  })

  it('只重试服务端尚未受理的状态码', () => {
    for (const status of [408, 429, 500, 502, 503, 504]) {
      expect(shouldRetry(statusError(status), 0)).toBe(true)
    }
    for (const status of [400, 401, 403, 404, 409, 422]) {
      expect(shouldRetry(statusError(status), 0)).toBe(false)
    }
  })

  it('写请求默认不重试，显式声明幂等后才重试', () => {
    expect(shouldRetry(statusError(503, { method: 'post' }), 0)).toBe(false)
    expect(shouldRetry(statusError(503, { method: 'post', retry: true }), 0)).toBe(true)
    expect(shouldRetry(statusError(503, { method: 'get', retry: false }), 0)).toBe(false)
  })

  it('主动取消不是网络故障，不重试', () => {
    const canceled = new CanceledError('canceled', configOf({ method: 'get' }))
    expect(shouldRetry(canceled, 0)).toBe(false)
    const aborted = new AbortController()
    aborted.abort()
    expect(shouldRetry(networkError({ signal: aborted.signal }), 0)).toBe(false)
  })
})

describe('retryDelayMs', () => {
  it('指数退避并叠加抖动', () => {
    const first = retryDelayMs(1)
    const second = retryDelayMs(2)
    expect(first).toBeGreaterThanOrEqual(600)
    expect(first).toBeLessThanOrEqual(Math.round(600 * 1.3))
    expect(second).toBeGreaterThanOrEqual(1800)
    expect(second).toBeLessThanOrEqual(Math.round(1800 * 1.3))
  })

  it('退避有上限，不会长时间静默等待', () => {
    for (let attempt = 1; attempt <= 10; attempt += 1) {
      expect(retryDelayMs(attempt)).toBeLessThanOrEqual(Math.round(6_000 * 1.3))
    }
  })
})

describe('apiClient 的弱网重试', () => {
  const originalAdapter = apiClient.defaults.adapter

  beforeEach(() => {
    localStorage.setItem('access_token', 'token-1')
  })

  afterEach(() => {
    apiClient.defaults.adapter = originalAdapter
    localStorage.clear()
    vi.useRealTimers()
  })

  /** 记录每次尝试，前 `failures` 次按给定方式失败，之后成功。 */
  function stubAdapter(
    failures: number,
    makeError: (config: InternalAxiosRequestConfig, attempt: number) => AxiosError,
  ) {
    const attempts: Array<{ id: unknown; data: unknown }> = []
    const adapter: AxiosAdapter = (config) => {
      attempts.push({
        id: config.headers['X-Request-ID'],
        data: config.data as unknown,
      })
      if (attempts.length <= failures) throw makeError(config, attempts.length)
      return Promise.resolve({
        data: { ok: true },
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      } as AxiosResponse)
    }
    apiClient.defaults.adapter = adapter
    return attempts
  }

  it('默认超时 30s', () => {
    expect(apiClient.defaults.timeout).toBe(REQUEST_TIMEOUT_MS)
    expect(REQUEST_TIMEOUT_MS).toBe(30_000)
  })

  it('读请求瞬时失败自动重试，并沿用同一个 X-Request-ID', async () => {
    vi.useFakeTimers()
    const attempts = stubAdapter(2, (config, attempt) =>
      networkFailure(config, attempt === 1 ? AxiosError.ECONNABORTED : AxiosError.ERR_NETWORK),
    )

    const pending = apiClient.get('/inventory/balances')
    await vi.advanceTimersByTimeAsync(10_000)

    await expect(pending).resolves.toMatchObject({ status: 200 })
    expect(attempts).toHaveLength(MAX_ATTEMPTS)
    expect(attempts.every((attempt) => attempt.id === attempts[0].id)).toBe(true)
    expect(attempts[0].id).toEqual(expect.any(String))
  })

  it('重试用尽后仍按原有约定归一化为 AppError', async () => {
    vi.useFakeTimers()
    const attempts = stubAdapter(Number.POSITIVE_INFINITY, (config) => networkFailure(config))

    const failure = apiClient.get('/inventory/balances').catch((error: unknown) => error)
    await vi.advanceTimersByTimeAsync(20_000)

    const error = (await failure) as AppError
    expect(attempts).toHaveLength(MAX_ATTEMPTS)
    expect(error).toBeInstanceOf(AppError)
    expect(error.code).toBe('NETWORK_ERROR')
    expect(error.requestId).toBe(attempts[0].id)
  })

  it('未声明幂等的写请求不重试，避免重复落库', async () => {
    vi.useFakeTimers()
    const attempts = stubAdapter(Number.POSITIVE_INFINITY, (config) => statusFailure(503, config))

    const failure = apiClient
      .post('/inventory/inbounds', { client_request_id: 'k1' })
      .catch((error: unknown) => error)
    await vi.advanceTimersByTimeAsync(20_000)

    expect(attempts).toHaveLength(1)
    expect((await failure) as AppError).toMatchObject({ code: 'SERVER_ERROR' })
  })

  it('带幂等键的提交可重试，且请求体不会被二次编码', async () => {
    vi.useFakeTimers()
    const body = { client_request_id: 'k1', quantity: '2' }
    const attempts = stubAdapter(1, (config) => networkFailure(config))

    const pending = apiClient.post('/inventory/outbounds', body, { retry: true })
    await vi.advanceTimersByTimeAsync(3_000)

    await expect(pending).resolves.toMatchObject({ status: 200 })
    expect(attempts).toHaveLength(2)
    expect(attempts[1].data).toBe(JSON.stringify(body))
  })

  it('retry: false 的请求即使可读也不重放', async () => {
    vi.useFakeTimers()
    const attempts = stubAdapter(Number.POSITIVE_INFINITY, (config) => networkFailure(config))

    const failure = apiClient
      .get('/system-settings/mini-program-features', { retry: false })
      .catch((error: unknown) => error)
    await vi.advanceTimersByTimeAsync(20_000)

    expect(attempts).toHaveLength(1)
    expect((await failure) as AppError).toMatchObject({ code: 'NETWORK_ERROR' })
  })
})
