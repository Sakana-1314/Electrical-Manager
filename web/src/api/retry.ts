import axios, { type AxiosError, type AxiosInstance, type InternalAxiosRequestConfig } from 'axios'

declare module 'axios' {
  export interface AxiosRequestConfig {
    /**
     * 重试策略（缺省按 HTTP 方法判定）：
     * - 不传：`GET` / `HEAD` / `OPTIONS` 这类无副作用的请求自动重试，其余方法不重试；
     * - `true`：业务上幂等的写请求（如带 `client_request_id` 的提交，服务端按键去重）也允许重试；
     * - `false`：关闭重试（刻意快速失败的探针、不可重放的提交）。
     */
    retry?: boolean
  }
}

/** 单次请求超时：弱网下一次握手动辄十几秒，15s 太容易误杀。 */
export const REQUEST_TIMEOUT_MS = 30_000

/** 最多尝试次数：首次 + 2 次重试，最坏约 92s（30s × 3 + 退避）。 */
export const MAX_ATTEMPTS = 3

/** 无副作用、可安全重放的方法。 */
const IDEMPOTENT_METHODS = new Set(['get', 'head', 'options'])

/** 服务端尚未受理的失败：连接超时 / 限流 / 网关与上游抖动，换个时机可能就成功。 */
const RETRYABLE_STATUS = new Set([408, 429, 500, 502, 503, 504])

/** 退避节奏：600ms → 1800ms，再叠加 30% 以内的抖动，避免同页并发请求同时复活又打满弱网。 */
const BASE_DELAY_MS = 600
const DELAY_FACTOR = 3
const MAX_DELAY_MS = 6_000
const JITTER_RATIO = 0.3

type RetryableConfig = InternalAxiosRequestConfig & { _retryAttempt?: number }

/** 可重放 = 方法无副作用或业务显式声明幂等（`retry: true`），且未被显式关闭。 */
export function isReplayable(config: RetryableConfig): boolean {
  if (config.retry === false) return false
  if (config.retry === true) return true
  return IDEMPOTENT_METHODS.has((config.method ?? 'get').toLowerCase())
}

/**
 * 是否值得再试一次：可重放 + 额度未用尽 + 失败属于「可能自愈」的一类。
 * `attemptsMade` 是已经发出去的尝试次数（首次请求失败时为 1 次的前置判断值为 0）。
 */
export function shouldRetry(error: AxiosError, attemptsMade: number): boolean {
  const config = error.config as RetryableConfig | undefined
  if (!config || attemptsMade + 1 >= MAX_ATTEMPTS || !isReplayable(config)) return false
  // 主动取消（组件卸载、切筛选）不是网络故障：重放只会让过期结果覆盖新结果。
  if (axios.isCancel(error) || config.signal?.aborted) return false
  // 无 response = 连接层失败（断网、DNS、超时、连接被重置）；有 response 时只看状态码。
  return !error.response || RETRYABLE_STATUS.has(error.response.status)
}

/** 第 n 次尝试失败后的等待时长（n 从 1 起）：指数退避 + 抖动。 */
export function retryDelayMs(attempt: number): number {
  const backoff = Math.min(BASE_DELAY_MS * DELAY_FACTOR ** (attempt - 1), MAX_DELAY_MS)
  return Math.round(backoff * (1 + Math.random() * JITTER_RATIO))
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * 给 axios 实例装上「瞬时失败自动重放」。
 *
 * 必须注册在错误归一化 / 401 刷新拦截器**之前**：只有这里才看得到原始 `AxiosError`
 * （状态码、取消标记），归一化之后只剩 `AppError`，判不出该不该重试。
 */
export function installRetryInterceptor(instance: AxiosInstance): void {
  instance.interceptors.response.use(undefined, async (error: AxiosError) => {
    const config = error.config as RetryableConfig | undefined
    const attempt = config?._retryAttempt ?? 0
    if (!config || !shouldRetry(error, attempt)) throw error
    config._retryAttempt = attempt + 1
    await sleep(retryDelayMs(attempt + 1))
    // 复用同一份 config：X-Request-ID 沿用（服务端日志可把重试串成一次请求），
    // Authorization 由请求拦截器重新读取（这段等待里 token 可能刚被刷新过）。
    return instance(config)
  })
}
