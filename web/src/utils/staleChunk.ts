import type { Router } from 'vue-router'

/**
 * 发版后旧代码块 404 的自愈。
 *
 * 前端每次发版，`yangrucheng-assets/` 下带哈希的代码块会整体换名，旧文件名在服务端直接 404。
 * 停留在旧页面的浏览器（尤其是长开的车间大屏、没有刷新习惯的工位）点菜单时，
 * 路由懒加载会去拉一个已经不存在的 JS，表现为「点了没反应」或半截页面。
 *
 * 处理方式：捕获这类加载失败 → 记住用户想去哪 → 整页刷新（拿到新的 index.html 与新哈希）
 * → 刷新后按记下的目标继续跳转。
 *
 * 刷新带闸门（模块内标记 + sessionStorage 时间窗）：代码块真的坏掉、或静态托管没跟上时，
 * 刷新并不能解决问题，必须避免无限刷新；被闸门拦下时广播 `STALE_CHUNK_BLOCKED_EVENT`，
 * 由界面提示用户手动刷新。
 */

/** 换掉页面后继续前往的目标（sessionStorage：只在本次标签页内有效，刷新后还在）。 */
export const PENDING_ROUTE_KEY = 'pending_route_after_reload'

/** 上次自愈刷新的时间戳；用于「短时间内不重复刷新」的闸门，跨刷新仍然有效。 */
export const RELOAD_GUARD_KEY = 'stale_chunk_reload_at'

/** 两次自愈刷新之间的最小间隔：足够浏览器重新拉一次 index.html，又不至于长时间拒绝自愈。 */
export const RELOAD_GUARD_MS = 15_000

/** 刷新没能解决问题（被闸门拦下）时广播的事件，界面据此提示用户手动刷新。 */
export const STALE_CHUNK_BLOCKED_EVENT = 'stale-chunk-blocked'

/** 本次页面生命周期内是否已经因代码块 404 刷新过，避免同一页面里反复重载。 */
let reloading = false

/** 正在进行的导航目标：预加载失败（`vite:preloadError`）时拿不到 to，用它补上。 */
let pendingTarget: string | null = null

/**
 * 判断是否为「旧代码块已不存在」类错误。
 *
 * - 动态 import 失败在 Chrome 是 `Failed to fetch dynamically imported module`，
 *   Firefox 是 `error loading dynamically imported module` / `Importing a module script failed`，
 *   Safari 是 `Importing a module script failed`；
 * - Vite 预加载 CSS 失败是 `Unable to preload CSS`。
 * 不能把普通网络抖动也当成发版：断网时莫名刷新会让用户丢掉正在填的内容，
 * 所以文本必须命中上面几条。
 */
export function isStaleChunkError(reason: unknown): boolean {
  if (!reason) return false
  const message =
    typeof reason === 'string'
      ? reason
      : reason instanceof Error
        ? reason.message
        : typeof (reason as { message?: unknown }).message === 'string'
          ? String((reason as { message: string }).message)
          : ''
  return /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Unable to preload CSS|dynamically imported module/i.test(
    message,
  )
}

/** 记下刷新后要继续前往的目标（路由地址 + 查询 + hash）。 */
export function rememberPendingRoute(href: string) {
  try {
    sessionStorage.setItem(PENDING_ROUTE_KEY, href)
  } catch {
    // 隐私模式 / 存储禁用：放弃记忆，只做刷新（用户再点一次即可）
  }
}

/**
 * 取出并清除刷新前记下的目标。
 * 只接受站内绝对路径：`//host/path` 是协议相对地址，会被浏览器当成外站，必须一并拒绝。
 */
export function takePendingRoute(): string | null {
  try {
    const href = sessionStorage.getItem(PENDING_ROUTE_KEY)
    sessionStorage.removeItem(PENDING_ROUTE_KEY)
    if (!href || !href.startsWith('/') || href.startsWith('//')) return null
    return href
  } catch {
    return null
  }
}

/** 距上次自愈刷新是否已经过了闸门时间；存储不可用时按「可以刷新」处理。 */
function reloadGateOpen(now = Date.now()) {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_GUARD_KEY) ?? 0)
    if (Number.isFinite(last) && last > 0 && now - last < RELOAD_GUARD_MS) return false
    sessionStorage.setItem(RELOAD_GUARD_KEY, String(now))
  } catch {
    return true
  }
  return true
}

/**
 * 整页刷新自愈：仅在代码块 404 时调用。
 * `href` 为空时刷新当前页（例如页面自身懒加载失败）。
 * 返回是否真的发起了刷新；被闸门拦下时返回 false 并广播提示事件。
 */
export function reloadForStaleChunk(href?: string | null): boolean {
  if (reloading) return false
  if (!reloadGateOpen()) {
    window.dispatchEvent(new CustomEvent(STALE_CHUNK_BLOCKED_EVENT))
    return false
  }
  reloading = true
  if (href) rememberPendingRoute(href)
  window.location.reload()
  return true
}

/** 供测试重置模块内状态。 */
export function resetStaleChunkGuard() {
  reloading = false
  pendingTarget = null
}

/**
 * 把自愈接到路由上：
 * - `router.onError`：路由懒加载 import() 失败（`vue-router` 会在导航阶段加载页面代码块）；
 * - `vite:preloadError`：Vite 预加载依赖代码块失败的全局事件，官方推荐的兜底入口。
 *
 * 只处理代码块类错误，组件渲染报错等其它错误原样交给既有处理（RouteProgress 标红）。
 */
export function installStaleChunkRecovery(router: Router) {
  router.beforeEach((to, from) => {
    if (to.fullPath !== from.fullPath) pendingTarget = to.fullPath
  })
  router.afterEach(() => {
    pendingTarget = null
  })

  router.onError((error, to) => {
    if (!isStaleChunkError(error)) return
    reloadForStaleChunk(to?.fullPath ?? pendingTarget ?? null)
  })

  window.addEventListener('vite:preloadError', () => {
    reloadForStaleChunk(pendingTarget)
  })
}

/**
 * 刷新后继续前往刷新前记下的目标（此时新代码块已就绪，是一次正常导航）。
 * 必须在应用挂载后调用：目标路由的守卫依赖登录态与项目上下文。
 */
export function resumePendingRoute(router: Router) {
  const pending = takePendingRoute()
  if (!pending) return
  void router.replace(pending).catch(() => {
    // 目标路由已不存在（如某页被下线）：留在当前页，不阻塞启动
  })
}
