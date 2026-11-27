import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuthStore } from './auth'
import { authApi } from '@/api/auth'
import type { User } from '@/api/generated'

vi.mock('@/api/auth', () => ({
  authApi: {
    login: vi.fn(),
    me: vi.fn(),
  },
}))

const miniUser = {
  id: 9,
  username: 'mini',
  display_name: '小程序用户',
  department_name: '电气车间',
  wechat_openid: null,
  permissions: ['warehouse:read'],
  created_at: '2026-11-27T00:00:00+00:00',
  updated_at: '2026-11-27T00:00:00+00:00',
  last_used_at: null,
  version: 1,
  bound: true,
} as unknown as User

describe('auth store 小程序直传令牌', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('写入令牌、清掉旧 refresh token，并从 /auth/me 补齐用户', async () => {
    localStorage.setItem('refresh_token', 'stale-refresh')
    localStorage.setItem('auth_user', JSON.stringify({ id: 1 }))
    vi.mocked(authApi.me).mockResolvedValue(miniUser)

    const store = useAuthStore()
    await store.adoptAccessToken('mini-jwt')

    expect(store.token).toBe('mini-jwt')
    expect(store.user?.id).toBe(9)
    expect(store.isAuthenticated).toBe(true)
    expect(localStorage.getItem('access_token')).toBe('mini-jwt')
    expect(localStorage.getItem('refresh_token')).toBeNull()
    expect(JSON.parse(localStorage.getItem('auth_user') || '{}').id).toBe(9)
  })

  it('令牌校验失败时清掉半截会话', async () => {
    vi.mocked(authApi.me).mockRejectedValue(new Error('登录凭证无效'))

    const store = useAuthStore()
    await expect(store.adoptAccessToken('bad-jwt')).rejects.toThrow('登录凭证无效')

    expect(store.token).toBeNull()
    expect(store.user).toBeNull()
    expect(localStorage.getItem('access_token')).toBeNull()
    expect(localStorage.getItem('auth_user')).toBeNull()
  })
})
