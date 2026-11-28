import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  ALLOWED_ORIGINS,
  HANDOFF_MESSAGE_TYPE,
  deliverSession,
  handoffRequest,
  hasHandoffIntent,
} from './userscriptHandoff'

/**
 * 油猴脚本的交接协议（`/login?userscript=1&origin=…&nonce=…`）。
 *
 * 两件事必须守住：
 * 1. `hasHandoffIntent` 只校验参数形态 —— 路由守卫用它决定「已登录也不跳走」，
 *    漏判就会让授权弹窗落到首页、脚本等不到回传（这是实际踩过的 bug）；
 * 2. `handoffRequest` / `deliverSession` 仍按白名单 + `window.opener` + nonce 把关，
 *    守卫放行不构成安全放宽。
 */
const PLATFORM_ORIGIN = 'http://43.154.152.157:8080'
const NONCE = 'a'.repeat(32)

function query(overrides: Record<string, unknown> = {}) {
  return { userscript: '1', origin: PLATFORM_ORIGIN, nonce: NONCE, ...overrides } as never
}

afterEach(() => {
  vi.restoreAllMocks()
  // jsdom 的 window.opener 默认是 null，这里只清理用例里显式设置的替身。
  Object.defineProperty(window, 'opener', { value: null, configurable: true, writable: true })
})

describe('hasHandoffIntent（路由守卫用的参数判定）', () => {
  it('白名单 origin + 合法 nonce 时成立', () => {
    expect(hasHandoffIntent(query())).toBe(true)
  })

  it('缺少 userscript 标记、origin 或 nonce 一律不成立', () => {
    expect(hasHandoffIntent(query({ userscript: undefined }))).toBe(false)
    expect(hasHandoffIntent(query({ userscript: '0' }))).toBe(false)
    expect(hasHandoffIntent(query({ origin: undefined }))).toBe(false)
    expect(hasHandoffIntent(query({ nonce: undefined }))).toBe(false)
    expect(hasHandoffIntent(query({ nonce: '' }))).toBe(false)
  })

  it('origin 必须是纯 origin，不能带路径 / 查询 / 伪协议', () => {
    expect(hasHandoffIntent(query({ origin: `${PLATFORM_ORIGIN}/evil` }))).toBe(false)
    expect(hasHandoffIntent(query({ origin: `${PLATFORM_ORIGIN}?x=1` }))).toBe(false)
    expect(hasHandoffIntent(query({ origin: 'javascript:alert(1)' }))).toBe(false)
  })

  it('不在白名单的 origin 不成立', () => {
    expect(hasHandoffIntent(query({ origin: 'https://evil.example.com' }))).toBe(false)
  })

  it('超长 nonce 不成立', () => {
    expect(hasHandoffIntent(query({ nonce: 'b'.repeat(129) }))).toBe(false)
  })

  it('不依赖 window.opener（守卫阶段窗口关系还没确定）', () => {
    expect(window.opener).toBeNull()
    expect(hasHandoffIntent(query())).toBe(true)
  })

  it('白名单与脚本 @match 的站点一致', () => {
    expect(ALLOWED_ORIGINS.has(PLATFORM_ORIGIN)).toBe(true)
  })
})

describe('handoffRequest（登录页真正的授权判定）', () => {
  it('没有 opener 时按普通登录处理', () => {
    Object.defineProperty(window, 'opener', { value: null, configurable: true, writable: true })
    expect(handoffRequest(query())).toBeNull()
  })

  it('被 window.open 打开时返回交接请求', () => {
    Object.defineProperty(window, 'opener', { value: {}, configurable: true, writable: true })
    expect(handoffRequest(query())).toEqual({ origin: PLATFORM_ORIGIN, nonce: NONCE })
  })

  it('非白名单 origin 即使有 opener 也拒绝', () => {
    Object.defineProperty(window, 'opener', { value: {}, configurable: true, writable: true })
    expect(handoffRequest(query({ origin: 'https://evil.example.com' }))).toBeNull()
  })
})

describe('deliverSession', () => {
  it('按 targetOrigin 回传令牌与用户权限', () => {
    const postMessage = vi.fn()
    Object.defineProperty(window, 'opener', {
      value: { postMessage },
      configurable: true,
      writable: true,
    })

    const ok = deliverSession(
      { origin: PLATFORM_ORIGIN, nonce: NONCE },
      {
        accessToken: 'jwt-token',
        user: {
          username: 'tester',
          display_name: '测试员',
          permissions: ['purchase:read'],
        } as never,
      },
      'https://electrical.yangrucheng.top/api/v1',
    )

    expect(ok).toBe(true)
    expect(postMessage).toHaveBeenCalledTimes(1)
    const [payload, targetOrigin] = postMessage.mock.calls[0]
    expect(targetOrigin).toBe(PLATFORM_ORIGIN)
    expect(payload).toMatchObject({
      type: HANDOFF_MESSAGE_TYPE,
      nonce: NONCE,
      session: {
        token: 'jwt-token',
        apiBase: 'https://electrical.yangrucheng.top/api/v1',
        user: { username: 'tester', permissions: ['purchase:read'] },
      },
    })
  })

  it('发起窗口已关闭（没有 opener）时返回 false', () => {
    Object.defineProperty(window, 'opener', { value: null, configurable: true, writable: true })
    expect(
      deliverSession(
        { origin: PLATFORM_ORIGIN, nonce: NONCE },
        { accessToken: 'jwt', user: { username: 'u' } as never },
        '/api/v1',
      ),
    ).toBe(false)
  })
})
