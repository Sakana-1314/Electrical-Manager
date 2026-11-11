import axios, { type AxiosError, type AxiosInstance } from 'axios'
import { ref } from 'vue'
import { apiBaseUrls, joinUrl } from '@/config/env'

/**
 * 双后端线路选择。
 *
 * - 首次进入：`main.ts` 在挂载前调用 `ensureBackendSelected()`，并发探测所有候选地址
 *   （`GET /version`），选延迟最低的一条；只配置一条地址时不产生额外请求。
 * - 会话保持：选择结果写入 `sessionStorage`，同一标签页内刷新不再重复探测。
 * - 运行期切换：请求遇到网络类错误时自动切离失败线路并记入会话；一次逻辑请求最多切一次，
 *   并发请求晚到的失败不会把线路切回刚失败的地址。
 * - 手动切换：左下角用户菜单的「线路」子菜单调用 `selectBackend()`。
 */

/** 会话内保存当前线路的 sessionStorage 键。 */
export const BACKEND_STORAGE_KEY = 'active_api_base_url'

/** 单条线路探测超时：超时按不可用处理，避免首屏被一条坏线路拖住。 */
export const PROBE_TIMEOUT_MS = 2_000

/** 公开、轻量、不查数据库的接口，适合测首包延迟。 */
const PROBE_PATH = 'version'

/** 网关 / 负载均衡层面的不可用，换一条线路大概率能恢复；5xx 里的业务错误不在此列。 */
const UNAVAILABLE_STATUS = new Set([502, 503, 504])

/** 探测函数：返回该线路的耗时（毫秒），失败时抛出。抽成参数便于单测注入。 */
export type BackendProbe = (baseUrl: string) => Promise<number>

/** 当前线路下标。用 ref 保存，用户菜单里的「线路」子菜单与 MCP 链接能跟随切换实时更新。 */
const activeIndex = ref(0)

/** 进行中的选路（并发调用共享同一次探测；结束后清空，便于测试与热更新重跑）。 */
let selection: Promise<void> | null = null

export function backendCandidates(): readonly string[] {
  return apiBaseUrls
}

export function activeBackendIndex(): number {
  return activeIndex.value
}

/** 当前后端 API 根地址；所有请求、图片 / 导出 / MCP 链接都以它为准。 */
export function activeBackendUrl(): string {
  return apiBaseUrls[activeIndex.value] ?? apiBaseUrls[0]
}

function readStoredIndex(): number | null {
  try {
    const stored = sessionStorage.getItem(BACKEND_STORAGE_KEY)?.trim()
    if (!stored) return null
    const index = apiBaseUrls.indexOf(stored)
    if (index >= 0) return index
    // 构建配置换了（地址被移除）：旧选择作废，本会话重新探测。
    sessionStorage.removeItem(BACKEND_STORAGE_KEY)
  } catch {
    // 隐私模式 / 存储被禁用：退化为仅内存选择，不影响请求。
  }
  return null
}

function persistActiveBackend(): void {
  try {
    sessionStorage.setItem(BACKEND_STORAGE_KEY, activeBackendUrl())
  } catch {
    // 同上，存不下也不影响本次会话内的请求。
  }
}

/** 手动选择线路（用户菜单）。返回是否真的发生了切换；写入会话，刷新后仍保持。 */
export function selectBackend(index: number): boolean {
  if (!Number.isInteger(index) || index < 0 || index >= apiBaseUrls.length) return false
  if (index === activeIndex.value) return false
  activeIndex.value = index
  persistActiveBackend()
  return true
}

/**
 * 切离失败的线路（按配置顺序取失败线路的下一条）。只有一条候选时返回 false。
 *
 * 并发请求同时失败时，第一条已经把线路切走；后面的请求看到当前线路已不是失败地址，
 * 不再触发切换，避免把线路又切回刚失败的地址。
 */
export function switchAwayFrom(failedUrl?: string): boolean {
  if (apiBaseUrls.length < 2) return false
  const failedIndex = failedUrl ? apiBaseUrls.indexOf(failedUrl) : -1
  if (failedIndex >= 0 && activeIndex.value !== failedIndex) return false
  const from = failedIndex >= 0 ? failedIndex : activeIndex.value
  return selectBackend((from + 1) % apiBaseUrls.length)
}

/**
 * 并发探测并返回延迟最低的线路下标；全部失败返回 null（调用方保留配置里的第一条）。
 * 延迟相同选靠前的一条，保证结果稳定。
 */
export async function selectFastestBackend(
  candidates: readonly string[],
  probe: BackendProbe,
): Promise<number | null> {
  const results = await Promise.all(
    candidates.map(async (url, index) => {
      try {
        return { index, latency: await probe(url) }
      } catch {
        return null
      }
    }),
  )
  let best: { index: number; latency: number } | null = null
  for (const result of results) {
    if (result && (!best || result.latency < best.latency)) best = result
  }
  return best?.index ?? null
}

/** 真实探测：裸 axios，不经过业务拦截器（不重试、不带 token、不参与错误归一化）。 */
export async function probeBackend(
  baseUrl: string,
  timeoutMs: number = PROBE_TIMEOUT_MS,
): Promise<number> {
  const startedAt = performance.now()
  await axios.get(joinUrl(baseUrl, PROBE_PATH), {
    timeout: timeoutMs,
    // 带时间戳打穿 CDN / 浏览器缓存，否则缓存会把「低延迟」变成假象。
    params: { probe: Date.now() },
    // 只有 2xx 才算可用：网关 502、路径配错 404 都不选。
    validateStatus: (status) => status >= 200 && status < 300,
  })
  return performance.now() - startedAt
}

/**
 * 首次进入时选线路。会话里已有有效选择时直接复用，不再探测；
 * 探测全部失败时保持第一条候选，让后续请求按正常错误流程提示。
 */
export async function ensureBackendSelected(probe: BackendProbe = probeBackend): Promise<void> {
  selection ??= (async () => {
    const stored = readStoredIndex()
    if (stored !== null) {
      activeIndex.value = stored
      return
    }
    if (apiBaseUrls.length < 2) {
      activeIndex.value = 0
      return
    }
    const fastest = await selectFastestBackend(apiBaseUrls, probe)
    if (fastest !== null) {
      activeIndex.value = fastest
      persistActiveBackend()
    }
  })().finally(() => {
    selection = null
  })
  await selection
}

/** 是否属于「换一条线路可能恢复」的网络类错误：连接失败 / 超时 / 取消不算，网关不可用算。 */
export function isBackendUnavailable(error: unknown): boolean {
  if (!axios.isAxiosError(error)) return false
  if (axios.isCancel(error) || error.code === 'ERR_CANCELED') return false
  // 没有 response = 连接层失败（断网、DNS、超时、CORS、连接被重置）。
  if (!error.response) return true
  return UNAVAILABLE_STATUS.has(error.response.status)
}

declare module 'axios' {
  export interface AxiosRequestConfig {
    /** 自动切线路标记：一次逻辑请求最多切一条，两个地址都不可用时不要来回跳。 */
    _backendSwitched?: boolean
  }
}

/**
 * 网络类错误时自动切离失败线路并记入会话，后续请求（以及可重放请求的本轮重试）
 * 立即走新线路。必须注册在重试拦截器**之前**：重试重放时才拿得到切换后的地址。
 */
export function installBackendSwitchInterceptor(instance: AxiosInstance): void {
  instance.interceptors.response.use(undefined, (error: AxiosError) => {
    const config = error.config
    if (config && !config._backendSwitched && isBackendUnavailable(error)) {
      // 标记先落：即使并发请求已经把线路切走，本请求重试时也不再切第二次。
      config._backendSwitched = true
      switchAwayFrom(config.baseURL)
    }
    return Promise.reject(error)
  })
}

/**
 * 给裸 axios 请求（刷新令牌等不在 apiClient 上的请求）加一次网络类错误回退：
 * 切到下一条线路后重放一次。回调收到本次使用的地址，切线路后按新地址重试。
 */
export async function withBackendFallback<T>(request: (baseUrl: string) => Promise<T>): Promise<T> {
  const baseUrl = activeBackendUrl()
  try {
    return await request(baseUrl)
  } catch (error) {
    if (!isBackendUnavailable(error)) throw error
    // 并发请求可能已经把线路切走了（此时 switchAwayFrom 返回 false），失败请求仍应在新线路上重放一次。
    switchAwayFrom(baseUrl)
    if (activeBackendUrl() === baseUrl) throw error
    return request(activeBackendUrl())
  }
}
