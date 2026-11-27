import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { authApi } from '@/api/auth'
import type { LoginRequest, User } from '@/api/generated'
import type { Permission } from '@/types/navigation'
import { hasPermission } from '@/types/navigation'

const savedUser = localStorage.getItem('auth_user')

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(savedUser ? JSON.parse(savedUser) : null)
  const token = ref<string | null>(localStorage.getItem('access_token'))
  const isAuthenticated = computed(() => Boolean(token.value && user.value))

  /** 权限门禁：用户权限位展开的权限键（后端按位算出放在 user.permissions）。 */
  function can(permission: Permission): boolean {
    return hasPermission(user.value?.permissions ?? [], permission)
  }

  async function login(payload: LoginRequest) {
    adoptSession(await authApi.login(payload))
  }

  /** 登录响应写入本地会话：密码登录与小程序扫码登录共用。 */
  function adoptSession(response: { access_token: string; refresh_token: string; user: User }) {
    token.value = response.access_token
    user.value = response.user
    localStorage.setItem('access_token', response.access_token)
    localStorage.setItem('refresh_token', response.refresh_token)
    localStorage.setItem('auth_user', JSON.stringify(response.user))
  }

  /**
   * 小程序直传 JWT 登录：小程序与网页共用同一套签名密钥，直接把小程序令牌当网页 access token。
   * 小程序没有 refresh token，必须清掉上一位网页用户可能留下的续期令牌，避免 401 时续到别人会话；
   * 用户信息（含权限位）仍以 /auth/me 为准，不能信任 URL 里的任何用户资料。
   */
  async function adoptAccessToken(accessToken: string) {
    token.value = accessToken
    user.value = null
    localStorage.setItem('access_token', accessToken)
    localStorage.removeItem('refresh_token')
    localStorage.removeItem('auth_user')
    try {
      user.value = await authApi.me({ skipAuthRedirect: true })
      localStorage.setItem('auth_user', JSON.stringify(user.value))
    } catch (error) {
      // 令牌无效 / 过期：不要留下半截会话，调用方负责提示回小程序重试。
      token.value = null
      user.value = null
      localStorage.removeItem('access_token')
      localStorage.removeItem('auth_user')
      throw error
    }
  }

  async function refresh() {
    if (!token.value) return
    // /web-open 会直接换掉 access_token：启动时发出的旧请求回来晚于换令牌时，不能覆盖新用户。
    const expected = token.value
    const fresh = await authApi.me()
    if (token.value !== expected) return
    user.value = fresh
    localStorage.setItem('auth_user', JSON.stringify(fresh))
  }

  function logout() {
    token.value = null
    user.value = null
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    localStorage.removeItem('auth_user')
  }

  return {
    user,
    token,
    isAuthenticated,
    can,
    login,
    adoptSession,
    adoptAccessToken,
    refresh,
    logout,
  }
})
