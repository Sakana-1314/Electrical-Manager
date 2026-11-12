import { apiClient } from './client'
import { activeBackendUrl } from './backend'
import type {
  LoginRequest,
  LoginResponse,
  QrLoginPoll,
  QrLoginSession,
  TokenPairResponse,
  User,
} from './generated'

export const authApi = {
  login: (payload: LoginRequest) =>
    apiClient.post<LoginResponse>('/auth/login', payload).then((r) => r.data),
  refresh: (refreshToken: string) =>
    apiClient
      .post<TokenPairResponse>('/auth/refresh', { refresh_token: refreshToken })
      .then((r) => r.data),
  me: () => apiClient.get<User>('/auth/me').then((r) => r.data),
  /** 创建扫码登录会话（匿名；会话只存在服务端内存）。 */
  createQrSession: () => apiClient.post<QrLoginSession>('/auth/qr-sessions').then((r) => r.data),
  /** 轮询扫码登录状态；confirmed 时返回一次性登录凭据。 */
  qrSession: (sessionId: string) =>
    apiClient
      .get<QrLoginPoll>(`/auth/qr-sessions/${encodeURIComponent(sessionId)}`, {
        // 轮询是短请求，失败由调用方下一轮重试，不叠加全局弱网重试。
        retry: false,
      })
      .then((r) => r.data),
  /** 扫码登录小程序码图片地址（直接给 <img>，无需鉴权）。 */
  qrCodeUrl: (sessionId: string) =>
    `${activeBackendUrl()}/auth/qr-sessions/${encodeURIComponent(sessionId)}/code`,
}
