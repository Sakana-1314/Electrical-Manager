import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type { Router } from 'vue-router'

/**
 * 路由守卫对「油猴脚本授权弹窗」的放行。
 *
 * 回归点：浏览器已登录时访问普通 `/login` 会被送去落地页（用户不需要再登录）；
 * 但脚本用 `window.open('/login?userscript=1&origin=…&nonce=…')` 打开的授权窗口
 * 必须留在登录页，否则授权界面不渲染、脚本等不到回传而超时。两者只差 query 参数。
 *
 * 注意 `stores/auth.ts` 在模块加载时读取 localStorage 快照，所以必须先写好登录态、
 * 再动态导入路由（`vi.resetModules()`），否则 store 里永远是空用户。
 */
const PLATFORM_ORIGIN = 'http://43.154.152.157:8080'

vi.mock('@/api/auth', () => ({
  authApi: {
    login: vi.fn(),
    me: vi.fn(),
    createQrSession: vi.fn(),
    qrSession: vi.fn(),
    qrCodeUrl: vi.fn(() => ''),
  },
}))

// 守卫会给受保护页面拉项目列表：测试里统一失败（store 自己吞掉，不拦导航）。
vi.mock('@/api/projects', () => ({
  projectApi: { list: vi.fn(async () => Promise.reject(new Error('no backend'))) },
}))

function signIn() {
  localStorage.setItem('access_token', 'saved-jwt')
  localStorage.setItem(
    'auth_user',
    JSON.stringify({ id: 1, username: 'tester', permissions: ['purchase:read'] }),
  )
}

function handoffQuery(nonce = 'd'.repeat(32)) {
  return { userscript: '1', origin: PLATFORM_ORIGIN, nonce }
}

/** 按当前 localStorage 重新加载一份路由（auth store 的模块级快照才会读到登录态）。 */
async function loadRouter(): Promise<Router> {
  vi.resetModules()
  setActivePinia(createPinia())
  const { default: router } = await import('./index')
  return router
}

beforeEach(() => {
  localStorage.clear()
})

describe('登录路由守卫与油猴授权弹窗', () => {
  // 首次加载路由会把布局与视图的懒加载块都拉起来，并行跑全量时可能超过默认 5s。
  const TIMEOUT = 30_000

  it('已登录访问普通 /login 仍跳到落地页', async () => {
    signIn()
    const router = await loadRouter()
    await router.push({ name: 'login' })
    expect(router.currentRoute.value.name).not.toBe('login')
  }, TIMEOUT)

  it('已登录时带交接参数的 /login 原地保留（授权弹窗不被送走）', async () => {
    signIn()
    const router = await loadRouter()
    await router.push({ name: 'login', query: handoffQuery() })
    expect(router.currentRoute.value.name).toBe('login')
    expect(router.currentRoute.value.query.userscript).toBe('1')
  }, TIMEOUT)

  it('参数不完整（如缺 nonce）时仍按普通登录处理', async () => {
    signIn()
    const router = await loadRouter()
    await router.push({ name: 'login', query: { userscript: '1', origin: PLATFORM_ORIGIN } })
    expect(router.currentRoute.value.name).not.toBe('login')
  }, TIMEOUT)

  it('非白名单 origin 的「交接」不享受放行', async () => {
    signIn()
    const router = await loadRouter()
    await router.push({
      name: 'login',
      query: { userscript: '1', origin: 'https://evil.example.com', nonce: 'e'.repeat(32) },
    })
    expect(router.currentRoute.value.name).not.toBe('login')
  }, TIMEOUT)

  it('未登录时无论有没有交接参数都停在登录页', async () => {
    const router = await loadRouter()
    await router.push({ name: 'login', query: handoffQuery() })
    expect(router.currentRoute.value.name).toBe('login')
  }, TIMEOUT)
})
