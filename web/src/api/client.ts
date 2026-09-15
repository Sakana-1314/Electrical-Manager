import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios'
import { apiBaseUrl } from '@/config/env'
import { installRetryInterceptor, REQUEST_TIMEOUT_MS } from './retry'
import type { ApiError, TokenPairResponse } from './generated'

type RetryableRequestConfig = InternalAxiosRequestConfig & { _authRetry?: boolean }

let refreshRequest: Promise<string> | null = null

/** 未登录时跳登录页：路径带 vite base 前缀（子路径部署时也能跳对）。 */
function redirectToLogin() {
  const loginPath = `${import.meta.env.BASE_URL}login`.replace(/\/{2,}/g, '/')
  if (location.pathname !== loginPath) location.assign(loginPath)
}

function clearSession() {
  localStorage.removeItem('access_token')
  localStorage.removeItem('refresh_token')
  localStorage.removeItem('auth_user')
}

async function renewAccessToken(): Promise<string> {
  const refreshToken = localStorage.getItem('refresh_token')
  if (!refreshToken) throw new Error('missing refresh token')
  const response = await axios.post<TokenPairResponse>(
    `${apiBaseUrl}/auth/refresh`,
    { refresh_token: refreshToken },
    { timeout: REQUEST_TIMEOUT_MS, headers: { 'X-Request-ID': crypto.randomUUID() } },
  )
  localStorage.setItem('access_token', response.data.access_token)
  localStorage.setItem('refresh_token', response.data.refresh_token)
  return response.data.access_token
}

export class AppError extends Error {
  code: string
  details?: Record<string, unknown>
  requestId?: string

  constructor(error: ApiError) {
    super(error.message)
    this.name = 'AppError'
    this.code = error.code
    this.details = error.details
    this.requestId = error.request_id
  }
}

export const apiClient = axios.create({
  baseURL: apiBaseUrl,
  timeout: REQUEST_TIMEOUT_MS,
  paramsSerializer: { indexes: null },
})

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  // 一个逻辑请求一个 id：重试沿用同一个，服务端日志里多次尝试能串成同一次请求。
  config.headers['X-Request-ID'] ??= crypto.randomUUID()
  return config
})

// 弱网下瞬时失败自动重试；必须排在 401 刷新与错误归一化之前，那里才拿得到原始 AxiosError。
installRetryInterceptor(apiClient)

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiError>) => {
    // 重放会重新走一遍拦截器链，已归一化的错误直接透传，避免层层包装把 code / request_id 洗掉。
    if (error instanceof AppError) return Promise.reject(error)
    const originalRequest = error.config as RetryableRequestConfig | undefined
    if (
      error.response?.status === 401 &&
      error.response.data?.code === 'INVALID_TOKEN' &&
      originalRequest &&
      !originalRequest._authRetry &&
      localStorage.getItem('refresh_token')
    ) {
      originalRequest._authRetry = true
      refreshRequest ??= renewAccessToken().finally(() => {
        refreshRequest = null
      })
      try {
        const accessToken = await refreshRequest
        originalRequest.headers.Authorization = `Bearer ${accessToken}`
        return apiClient(originalRequest)
      } catch {
        clearSession()
        redirectToLogin()
      }
    } else if (error.response?.status === 401) {
      clearSession()
      redirectToLogin()
    }
    const payload = error.response?.data
    // 两次重试共用同一个 X-Request-ID：弱网失败时带着它，服务端日志里能对上（超时的请求可能已经落库）。
    const requestId = originalRequest?.headers?.['X-Request-ID'] ?? ''
    const fallback: ApiError = error.response
      ? {
          code: 'SERVER_ERROR',
          message: `服务请求失败（HTTP ${error.response.status}），请稍后重试`,
          request_id: requestId,
        }
      : {
          code: 'NETWORK_ERROR',
          message: '无法连接服务器，请检查网络后重试',
          request_id: requestId,
        }
    return Promise.reject(payload?.code ? new AppError(payload) : new AppError(fallback))
  },
)
