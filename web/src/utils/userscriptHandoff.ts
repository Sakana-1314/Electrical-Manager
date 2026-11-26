import type { LocationQuery } from 'vue-router'
import type { User } from '@/api/generated'

/**
 * 油猴脚本的「弹窗登录 → 授权 → 回传登录态」交接协议。
 *
 * ## 为什么需要它
 *
 * 油猴脚本运行在外部物资平台上，拿不到本系统的登录态；过去要用户手工粘贴接口令牌，
 * 既麻烦又容易泄露。改成：脚本弹窗打开本系统登录页，用户正常登录后点一次「授权」，
 * 本页用 `postMessage` 把**登录令牌与用户信息**交回脚本所在的窗口。
 *
 * ## 与「进入网页版」的区别
 *
 * `/web-open` 是小程序 → 网页（一次性票据换成登录态）；这里是外部站点 → 网页（同源无法
 * 读写，只能靠用户的显式点击 + 白名单 origin 回传），两者都不需要用户复制任何令牌。
 *
 * ## 参数与安全
 *
 * - `origin` 是发起方 origin，只接受**纯 origin**（不能带路径/查询），并作为 `postMessage`
 *   的 targetOrigin —— 令牌不会发给白名单之外的任何页面；
 * - `nonce` 由脚本生成，回传时原样带回，脚本据此丢弃伪造或串台的响应；
 * - 还要求 `window.opener` 存在：直接打开地址的普通登录不受影响，也不会进入授权流程。
 */

/** 查询参数名：`?userscript=1` 表示这是脚本发起的交接窗口。 */
const FLAG = 'userscript'

/** 回传消息的类型，脚本按它过滤 `message` 事件。 */
export const HANDOFF_MESSAGE_TYPE = 'hxni-userscript-session'

/**
 * 允许接收登录态的页面白名单。
 *
 * 脚本只跑在华友的两个平台上（与脚本头 `@match` 一致），不在白名单里的 origin 一律拒绝：
 * 否则任何站点都能弹这个窗口、诱导一次「授权」就拿到系统登录态。脚本的匹配地址变了要同步改这里。
 */
export const ALLOWED_ORIGINS = new Set([
  'http://43.154.152.157:8080',
  'https://quick-hejia.qcloud.19890605.xyz',
])

/** 一次合法的交接请求：发起方 origin + 脚本生成的随机串。 */
export interface HandoffRequest {
  origin: string
  nonce: string
}

/** 只接受 `协议//域名[:端口]`；path、query、hash 一律视为非法。 */
function pureOrigin(raw: string): string {
  try {
    const url = new URL(raw)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return ''
    // targetOrigin 只认 origin：带路径的值浏览器会直接抛错，提前挡下来。
    return url.origin === raw ? url.origin : ''
  } catch {
    return ''
  }
}

/**
 * 从登录页的查询参数里读出交接请求。
 *
 * 返回 null 时按普通登录处理（表单、跳转都不变）：参数缺失、格式不对、
 * 不在白名单、或者这个窗口不是被 `window.open` 打开的。
 */
export function handoffRequest(query: LocationQuery): HandoffRequest | null {
  if (query[FLAG] !== '1') return null
  const origin = typeof query.origin === 'string' ? pureOrigin(query.origin) : ''
  const nonce = typeof query.nonce === 'string' ? query.nonce : ''
  if (origin === '' || nonce === '' || nonce.length > 128) return null
  if (!ALLOWED_ORIGINS.has(origin)) return null
  if (!window.opener) return null
  return { origin, nonce }
}

/**
 * 把登录态交给弹窗的发起方，返回是否成功送出。
 *
 * 只发脚本用得到的字段：令牌、用户（含权限键）与接口地址 —— 脚本要按同一个后端发请求，
 * 否则会 401；权限键让脚本能提示「没有申购权限」这类问题。
 */
export function deliverSession(
  request: HandoffRequest,
  session: { accessToken: string; user: User },
  apiBase: string,
): boolean {
  const opener = window.opener as Window | null
  if (!opener) return false
  try {
    opener.postMessage(
      {
        type: HANDOFF_MESSAGE_TYPE,
        nonce: request.nonce,
        session: {
          token: session.accessToken,
          apiBase,
          user: {
            username: session.user.username,
            display_name: session.user.display_name,
            permissions: session.user.permissions,
          },
        },
      },
      request.origin,
    )
  } catch {
    // 发起方已经关窗时个别浏览器会抛 InvalidStateError：按「没送出去」处理。
    return false
  }
  return true
}
