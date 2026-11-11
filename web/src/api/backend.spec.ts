import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/config/env', () => ({
  apiBaseUrls: ['https://a.example.com/api/v1', 'https://b.example.com/api/v1'],
  joinUrl: (baseUrl: string, path: string) =>
    `${baseUrl.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`,
}))

import {
  BACKEND_STORAGE_KEY,
  activeBackendIndex,
  activeBackendUrl,
  ensureBackendSelected,
  isBackendUnavailable,
  selectBackend,
  selectFastestBackend,
  switchAwayFrom,
  withBackendFallback,
} from './backend'

const candidates = ['https://a.example.com/api/v1', 'https://b.example.com/api/v1']

describe('双后端线路选择', () => {
  beforeEach(() => {
    sessionStorage.clear()
    // 把模块内的当前线路复位到第一条，再清掉复位写入的会话记录。
    selectBackend(0)
    sessionStorage.clear()
  })

  it('并发探测所有地址并选延迟最低的一条', async () => {
    const probe = vi.fn(async (url: string) => (url === candidates[1] ? 30 : 80))

    await expect(selectFastestBackend(candidates, probe)).resolves.toBe(1)
    expect(probe).toHaveBeenCalledTimes(2)
    expect(probe).toHaveBeenCalledWith(candidates[0])
    expect(probe).toHaveBeenCalledWith(candidates[1])
  })

  it('探测失败的地址不参与比较；全部失败返回 null', async () => {
    const partial = vi.fn(async (url: string) => {
      if (url === candidates[0]) throw new Error('down')
      return 50
    })
    await expect(selectFastestBackend(candidates, partial)).resolves.toBe(1)

    await expect(
      selectFastestBackend(candidates, async () => {
        throw new Error('down')
      }),
    ).resolves.toBeNull()
  })

  it('延迟相同时选配置顺序靠前的一条', async () => {
    await expect(selectFastestBackend(candidates, async () => 40)).resolves.toBe(0)
  })

  it('首次进入探测后写入会话，刷新时直接复用不再探测', async () => {
    const probe = vi.fn(async (url: string) => (url === candidates[1] ? 20 : 60))

    await ensureBackendSelected(probe)

    expect(activeBackendUrl()).toBe(candidates[1])
    expect(activeBackendIndex()).toBe(1)
    expect(sessionStorage.getItem(BACKEND_STORAGE_KEY)).toBe(candidates[1])

    const secondProbe = vi.fn()
    await ensureBackendSelected(secondProbe)
    expect(secondProbe).not.toHaveBeenCalled()
    expect(activeBackendUrl()).toBe(candidates[1])
  })

  it('全部探测失败时保持第一条且不写会话', async () => {
    await ensureBackendSelected(async () => {
      throw new Error('down')
    })

    expect(activeBackendUrl()).toBe(candidates[0])
    expect(sessionStorage.getItem(BACKEND_STORAGE_KEY)).toBeNull()
  })

  it('会话里的地址已不在构建配置中时作废并重新探测', async () => {
    sessionStorage.setItem(BACKEND_STORAGE_KEY, 'https://removed.example.com/api/v1')
    const probe = vi.fn(async () => 10)

    await ensureBackendSelected(probe)

    expect(probe).toHaveBeenCalledTimes(2)
    expect(activeBackendUrl()).toBe(candidates[0])
    expect(sessionStorage.getItem(BACKEND_STORAGE_KEY)).toBe(candidates[0])
  })

  it('切离失败线路并记入会话，循环切换', () => {
    expect(switchAwayFrom(candidates[0])).toBe(true)
    expect(activeBackendUrl()).toBe(candidates[1])
    expect(sessionStorage.getItem(BACKEND_STORAGE_KEY)).toBe(candidates[1])

    expect(switchAwayFrom(candidates[1])).toBe(true)
    expect(activeBackendUrl()).toBe(candidates[0])
  })

  it('并发请求晚到的失败回调不会把线路切回失败地址', () => {
    expect(switchAwayFrom(candidates[0])).toBe(true)
    expect(activeBackendUrl()).toBe(candidates[1])

    // 第二个请求同样在 A 上失败：当前线路已不是 A，忽略这次失败。
    expect(switchAwayFrom(candidates[0])).toBe(false)
    expect(activeBackendUrl()).toBe(candidates[1])
  })

  it('非法下标不切换', () => {
    expect(selectBackend(-1)).toBe(false)
    expect(selectBackend(2)).toBe(false)
    expect(selectBackend(1.5)).toBe(false)
    expect(activeBackendIndex()).toBe(0)
  })

  it('连接失败、超时与网关不可用算网络类错误', () => {
    const error = (overrides: Record<string, unknown>) => ({ isAxiosError: true, ...overrides })

    expect(isBackendUnavailable(error({}))).toBe(true)
    for (const status of [502, 503, 504]) {
      expect(isBackendUnavailable(error({ response: { status } }))).toBe(true)
    }
    expect(isBackendUnavailable(error({ response: { status: 500 } }))).toBe(false)
    expect(isBackendUnavailable(error({ response: { status: 401 } }))).toBe(false)
    expect(isBackendUnavailable(new Error('boom'))).toBe(false)
  })

  it('主动取消不触发切换', () => {
    expect(isBackendUnavailable({ isAxiosError: true, code: 'ERR_CANCELED' })).toBe(false)
    expect(isBackendUnavailable({ isAxiosError: true, __CANCEL__: true })).toBe(false)
  })

  it('裸请求网络失败时切线路并按新地址重放一次', async () => {
    const request = vi
      .fn<(baseUrl: string) => Promise<string>>()
      .mockRejectedValueOnce({ isAxiosError: true })
      .mockResolvedValueOnce('ok')

    await expect(withBackendFallback(request)).resolves.toBe('ok')
    expect(request).toHaveBeenCalledTimes(2)
    expect(request).toHaveBeenLastCalledWith(candidates[1])
    expect(activeBackendUrl()).toBe(candidates[1])
  })

  it('业务错误不切换也不重放', async () => {
    const error = { isAxiosError: true, response: { status: 400 } }
    const request = vi.fn<(baseUrl: string) => Promise<string>>().mockRejectedValue(error)

    await expect(withBackendFallback(request)).rejects.toBe(error)
    expect(request).toHaveBeenCalledTimes(1)
    expect(activeBackendUrl()).toBe(candidates[0])
  })
})
