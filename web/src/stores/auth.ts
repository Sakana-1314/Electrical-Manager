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

  /** 权限门禁：用户所挂角色的权限并集（后端算好放在 user.permissions）。 */
  function can(permission: Permission): boolean {
    return hasPermission(user.value?.permissions ?? [], permission)
  }

  async function login(payload: LoginRequest) {
    const response = await authApi.login(payload)
    token.value = response.access_token
    user.value = response.user
    localStorage.setItem('access_token', response.access_token)
    localStorage.setItem('refresh_token', response.refresh_token)
    localStorage.setItem('auth_user', JSON.stringify(response.user))
  }

  async function refresh() {
    if (!token.value) return
    user.value = await authApi.me()
    localStorage.setItem('auth_user', JSON.stringify(user.value))
  }

  function logout() {
    token.value = null
    user.value = null
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    localStorage.removeItem('auth_user')
  }

  return { user, token, isAuthenticated, can, login, refresh, logout }
})
