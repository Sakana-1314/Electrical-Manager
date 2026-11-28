import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  ALLOWED_ORIGINS,
  HANDOFF_MESSAGE_TYPE,
  deliverSession,
  handoffRequest,
  hasHandoffIntent,
  sessionHandoffRequest,
} from './userscriptHandoff'

/**
 * 油猴脚本的交接协议。
 *
 * 三件事必须守住：
 * 1. `hasHandoffIntent` 只校验参数形态 —— 路由守卫用它决定「已登录也不跳走」，
 *    漏判就会让授权弹窗落到首页、脚本等不到回传（这是实际踩过的 bug）；
 * 2. `sessionHandoffRequest` 是**主通道**：带合法会话 id 时就成立，**不要求 window.opener**，
 *    否则发起窗口被刷新/回收时授权永远送不出去（「发起窗口已关闭」那个故障）；
 * 3. `handoffRequest` / `deliverSession` 是旧版 postMessage 通道，仍按白名单 + opener + nonce 把关。
 */
const PLATFORM_ORIGIN = 'http://43.154.152.157:8080'
const NONCE = 'a'.repeat(32)
const SESSION_ID = '0198f3a7-2c00-7000-8000-000000000002'

function query(overrides: Record<string, unknown> = {}) {
  return { userscript: '1', origin: PLATFORM_ORIGIN, nonce: NONCE, ...overrides } as never
}

/** 会话通道的地址：脚本新版本只带 session，不带 nonce。 */
function sessionQuery(overrides: Record<string, unknown> = {}) {
  return { userscript: '1', origin: PLATFORM_ORIGIN, session: SESSION_ID, ...overrides } as never
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

  it('白名单 origin + 合法会话 id 时也成立（新版脚本不带 nonce）', () => {
    expect(hasHandoffIntent(sessionQuery())).toBe(true)
  })

  it('缺少 userscript 标记、origin、nonce 与会话 id 一律不成立', () => {
    expect(hasHandoffIntent(query({ userscript: undefined }))).toBe(false)
    expect(hasHandoffIntent(query({ userscript: '0' }))).toBe(false)
    expect(hasHandoffIntent(query({ origin: undefined }))).toBe(false)
    expect(hasHandoffIntent(query({ nonce: undefined }))).toBe(false)
    expect(hasHandoffIntent(query({ nonce: '' }))).toBe(false)
    expect(hasHandoffIntent(sessionQuery({ nonce: undefined, session: undefined }))).toBe(false)
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
    expect(hasHandoffIntent(sessionQuery())).toBe(true)
  })

  it('白名单与脚本 @match 的站点一致', () => {
    expect(ALLOWED_ORIGINS.has(PLATFORM_ORIGIN)).toBe(true)
  })
})

describe('sessionHandoffRequest（主通道：不依赖 opener）', () => {
  it('没有 window.opener 也能成立 —— 发起窗口被切断时仍可授权', () => {
    expect(window.opener).toBeNull()
    expect(sessionHandoffRequest(sessionQuery())).toEqual({
      origin: PLATFORM_ORIGIN,
      sessionId: SESSION_ID,
    })
  })

  it('接受 32 位紧凑 UUID，且原样保留（服务端两种写法都认）', () => {
    const compact = SESSION_ID.replace(/-/g, '')
    expect(sessionHandoffRequest(sessionQuery({ session: compact }))?.sessionId).toBe(compact)
  })

  it('会话 id 不是 UUID 时不成立', () => {
    for (const bad of ['', 'abc', 'x'.repeat(36), `${SESSION_ID}/extra`]) {
      expect(sessionHandoffRequest(sessionQuery({ session: bad }))).toBeNull()
    }
  })

  it('非白名单 origin 不成立', () => {
    expect(sessionHandoffRequest(sessionQuery({ origin: 'https://evil.example.com' }))).toBeNull()
  })

  it('没有 userscript 标记时不成立（普通登录不受影响）', () => {
    expect(sessionHandoffRequest(sessionQuery({ userscript: undefined }))).toBeNull()
  })

  it('旧版地址（只有 nonce、没有 session）不进入会话通道', () => {
    expect(sessionHandoffRequest(query())).toBeNull()
  })
})

describe('handoffRequest（旧版 postMessage 通道）', () => {
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

  it('用户对象是 Vue 响应式 Proxy 时也能送出（不被 DataCloneError 误判成 opener 已关闭）', () => {
    // 真实浏览器里 postMessage 走结构化克隆，Proxy 会抛 DataCloneError；
    // 旧实现把它吞进 catch，界面误报「发起窗口已关闭，授权未送达」。
    const postMessage = vi.fn((payload: unknown) => {
      structuredClone(payload)
    })
    Object.defineProperty(window, 'opener', {
      value: { postMessage },
      configurable: true,
      writable: true,
    })

    // 模拟 pinia 里读出来的响应式用户：permissions 是 Proxy 数组。
    const reactivePermissions = new Proxy(['purchase:read', 'warehouse:read'], {})
    const ok = deliverSession(
      { origin: PLATFORM_ORIGIN, nonce: NONCE },
      {
        accessToken: 'jwt-token',
        user: {
          username: 'tester',
          display_name: '测试员',
          permissions: reactivePermissions,
        } as never,
      },
      '/api/v1',
    )

    expect(ok).toBe(true)
    expect(postMessage).toHaveBeenCalledTimes(1)
    expect(postMessage.mock.calls[0][0]).toMatchObject({
      session: { user: { permissions: ['purchase:read', 'warehouse:read'] } },
    })
  })
})
