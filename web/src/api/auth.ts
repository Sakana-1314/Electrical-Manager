import { apiClient } from './client'
import { activeBackendUrl } from './backend'
import type {
  LoginRequest,
  LoginResponse,
  PasswordChangeRequest,
  QrLoginPoll,
  QrLoginSession,
  TokenPairResponse,
  User,
  UserApiTokenRead,
  UserScriptAuthSessionConfirmRead,
  WebOpenTicketCreate,
  WebOpenTicketRead,
  WebOpenTicketRedeemRead,
  WebOpenTicketRedeemRequest,
} from './generated'

export const authApi = {
  login: (payload: LoginRequest) =>
    apiClient.post<LoginResponse>('/auth/login', payload).then((r) => r.data),
  refresh: (refreshToken: string) =>
    apiClient
      .post<TokenPairResponse>('/auth/refresh', { refresh_token: refreshToken })
      .then((r) => r.data),
  me: (options?: { skipAuthRedirect?: boolean }) =>
    apiClient.get<User>('/auth/me', options).then((r) => r.data),
  /** 自己的接口令牌：用于复制 MCP 地址；首次读取时后端自动生成，之后不轮换。 */
  myApiToken: () => apiClient.get<UserApiTokenRead>('/auth/me/api-token').then((r) => r.data),
  /** 只能改密码，不能改姓名 / 部门等个人资料。 */
  changeMyPassword: (payload: PasswordChangeRequest) =>
    apiClient.patch<void>('/auth/me/password', payload),
  /** 小程序「进入网页版」：用登录令牌换一次性票据（返回拼好的 web-view 地址）。 */
  createWebOpenTicket: (payload: WebOpenTicketCreate) =>
    apiClient.post<WebOpenTicketRead>('/auth/web-open/tickets', payload).then((r) => r.data),
  /** 网页 /web-open 页兑换票据（匿名，一次性）：换回登录令牌与落地路由。 */
  redeemWebOpenTicket: (
    payload: WebOpenTicketRedeemRequest,
    options?: { skipAuthRedirect?: boolean },
  ) =>
    apiClient
      .post<WebOpenTicketRedeemRead>('/auth/web-open/redeem', payload, options)
      .then((r) => r.data),
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
  /**
   * 油猴脚本弹窗授权：把当前登录用户登记到脚本创建的一次性会话里。
   *
   * 只上报会话 id、不上传令牌 —— 令牌由脚本轮询该会话时由服务端签发。
   * 因此这条链路不依赖 `window.opener`，发起窗口被刷新或关闭也能送达。
   */
  confirmUserScriptSession: (sessionId: string) =>
    apiClient
      .post<UserScriptAuthSessionConfirmRead>(
        `/auth/userscript-sessions/${encodeURIComponent(sessionId)}/confirm`,
        { session_id: sessionId },
      )
      .then((r) => r.data),
}
