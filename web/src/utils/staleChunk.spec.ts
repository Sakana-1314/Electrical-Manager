// @vitest-environment jsdom
/**
 * 发版后旧代码块 404 自愈的接线守卫（`utils/staleChunk.ts`）。
 *
 * 关键是「只认代码块类错误、并且只刷新一次」：
 * - 普通网络抖动 / 业务报错触发刷新，会让用户丢掉正在填的内容；
 * - 代码块真坏掉时无限刷新，页面就彻底用不了了。
 * 另外刷新后要能回到用户原本点的那一页（目标存在 sessionStorage 里）。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  isStaleChunkError,
  PENDING_ROUTE_KEY,
  RELOAD_GUARD_KEY,
  RELOAD_GUARD_MS,
  reloadForStaleChunk,
  rememberPendingRoute,
  resetStaleChunkGuard,
  resumePendingRoute,
  STALE_CHUNK_BLOCKED_EVENT,
  takePendingRoute,
} from './staleChunk'

beforeEach(() => {
  sessionStorage.clear()
  resetStaleChunkGuard()
  vi.restoreAllMocks()
})

describe('旧代码块错误的识别', () => {
  it('识别各浏览器动态 import 失败与 Vite 预加载失败', () => {
    for (const message of [
      'Failed to fetch dynamically imported module: https://x/yangrucheng-assets/index-abc.js',
      'error loading dynamically imported module',
      'Importing a module script failed.',
      'Unable to preload CSS for /a.css',
    ]) {
      expect(isStaleChunkError(new TypeError(message)), message).toBe(true)
    }
  })

  it('不把普通网络抖动 / 业务错误当成发版', () => {
    for (const error of [
      new Error('Network Error'),
      new Error('timeout of 10000ms exceeded'),
      new Error('Request failed with status code 500'),
      new Error('Cannot read properties of undefined'),
      undefined,
      null,
      '',
    ]) {
      expect(isStaleChunkError(error)).toBe(false)
    }
  })

  it('接受字符串与带 message 的对象（事件回调里常见）', () => {
    expect(isStaleChunkError('Failed to fetch dynamically imported module')).toBe(true)
    expect(isStaleChunkError({ message: 'error loading dynamically imported module' })).toBe(true)
  })
})

describe('刷新后回到原来的目标页', () => {
  it('记住、取出、并清除目标地址', () => {
    rememberPendingRoute('/warehouse/stock?page=2')
    expect(takePendingRoute()).toBe('/warehouse/stock?page=2')
    // 取出后必须清掉，否则每次启动都会重复跳转
    expect(takePendingRoute()).toBeNull()
  })

  it('只接受站内绝对路径，外部地址一律丢弃', () => {
    rememberPendingRoute('https://evil.example.com/x')
    expect(takePendingRoute()).toBeNull()
    sessionStorage.setItem(PENDING_ROUTE_KEY, '//evil.example.com/x')
    expect(takePendingRoute()).toBeNull()
  })

  it('刷新后用它继续导航', async () => {
    rememberPendingRoute('/procurement/records')
    const replace = vi.fn().mockResolvedValue(undefined)
    resumePendingRoute({ replace } as never)
    expect(replace).toHaveBeenCalledWith('/procurement/records')
  })

  it('没有目标时不做任何导航', () => {
    const replace = vi.fn()
    resumePendingRoute({ replace } as never)
    expect(replace).not.toHaveBeenCalled()
  })

  it('目标不存在导致导航失败时不抛出（不阻塞启动）', async () => {
    rememberPendingRoute('/removed-page')
    const replace = vi.fn().mockRejectedValue(new Error('No match'))
    expect(() => resumePendingRoute({ replace } as never)).not.toThrow()
  })
})

describe('自愈刷新只发生一次', () => {
  it('第一次刷新后同一页面内不再刷新', () => {
    const reload = vi.fn()
    vi.spyOn(window, 'location', 'get').mockReturnValue({ ...window.location, reload } as never)
    expect(reloadForStaleChunk('/a')).toBe(true)
    expect(reloadForStaleChunk('/b')).toBe(false)
    expect(reload).toHaveBeenCalledTimes(1)
    expect(takePendingRoute()).toBe('/a')
  })

  it('短时间内跨刷新也不再刷新，并广播提示事件', () => {
    sessionStorage.setItem(RELOAD_GUARD_KEY, String(Date.now() - 1000))
    const blocked = vi.fn()
    window.addEventListener(STALE_CHUNK_BLOCKED_EVENT, blocked)
    const reload = vi.fn()
    vi.spyOn(window, 'location', 'get').mockReturnValue({ ...window.location, reload } as never)
    expect(reloadForStaleChunk()).toBe(false)
    expect(reload).not.toHaveBeenCalled()
    expect(blocked).toHaveBeenCalledTimes(1)
    window.removeEventListener(STALE_CHUNK_BLOCKED_EVENT, blocked)
  })

  it('过了闸门时间可以再刷新一次（发版是持续发生的事）', () => {
    sessionStorage.setItem(RELOAD_GUARD_KEY, String(Date.now() - RELOAD_GUARD_MS - 1000))
    const reload = vi.fn()
    vi.spyOn(window, 'location', 'get').mockReturnValue({ ...window.location, reload } as never)
    expect(reloadForStaleChunk()).toBe(true)
    expect(reload).toHaveBeenCalledTimes(1)
  })
})
