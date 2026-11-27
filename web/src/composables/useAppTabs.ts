import { ref, watch } from 'vue'
import type { RouteLocationNormalizedLoaded, Router } from 'vue-router'
import {
  activeKeyAfterClose,
  closeTab,
  evictedKeys,
  MAX_APP_TABS,
  upsertTab,
  type AppTab,
} from '@/utils/appTabs'

/**
 * 顶部标签页状态（标签列表 + 每个标签的实例代号）。
 *
 * - 标签按路由名去重：同一页面无论带什么查询参数（?detail=5、翻页、筛选）都只有一个标签，
 *   但标签会记录该页最后一次的完整地址，切回来时连筛选条件一起还原。
 * - 绑在路由上的页面都会进 keep-alive（`AppLayout` 按标签决定），所以切标签不会重新请求数据。
 * - 关闭标签时把该页的实例代号 +1，下次打开是全新实例（不会看到上次关掉时的旧数据）。
 * - 标签列表存 sessionStorage：刷新 / 发版自愈整页刷新后仍保留打开的标签。
 */

const STORAGE_KEY = 'app.tabs.v1'

/** 不走标签页的路由：登录、分享、404 等公共页，以及自带离开确认的表单页。 */
export function isTabRoute(route: RouteLocationNormalizedLoaded): boolean {
  return Boolean(route.meta.title) && !route.meta.public && !route.meta.noTab
}

function readStoredTabs(): AppTab[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (item): item is AppTab =>
        Boolean(item) &&
        typeof (item as AppTab).key === 'string' &&
        typeof (item as AppTab).title === 'string' &&
        typeof (item as AppTab).path === 'string',
    )
  } catch {
    return []
  }
}

const tabs = ref<AppTab[]>(readStoredTabs())
const activeKey = ref<string | null>(null)
/** 每个标签的实例代号：变一次就换一个 keep-alive 缓存键，等于强制重新挂载。 */
const tokens = ref<Record<string, number>>({})

watch(
  tabs,
  (value) => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(value))
    } catch {
      // 隐私模式 / 存储禁用：标签只在内存里，不影响使用
    }
  },
  { deep: true },
)

/** 当前标签的 keep-alive 缓存键（页面 + 实例代号）。 */
export function tabCacheKey(key: string): string {
  return `${key}#${tokens.value[key] ?? 0}`
}

/** 让某个页面下次挂载时重新初始化（关闭标签 / 被 FIFO 淘汰时使用）。 */
function invalidate(key: string) {
  tokens.value = { ...tokens.value, [key]: (tokens.value[key] ?? 0) + 1 }
}

/** 路由变化 → 打开 / 更新对应标签。 */
export function trackRoute(route: RouteLocationNormalizedLoaded) {
  if (!isTabRoute(route) || typeof route.name !== 'string') return
  const before = tabs.value
  tabs.value = upsertTab(before, {
    key: route.name,
    title: String(route.meta.title ?? route.name),
    path: route.fullPath,
  })
  activeKey.value = route.name
  // 超过上限被挤掉的标签：下次打开重新加载，避免看到早已离开的旧状态
  for (const key of evictedKeys(before, tabs.value)) invalidate(key)
}

/** 点击标签：跳到该标签最后停留的地址。 */
export function activateTab(router: Router, key: string) {
  const tab = tabs.value.find((item) => item.key === key)
  if (!tab) return
  if (tab.path === router.currentRoute.value.fullPath) {
    activeKey.value = key
    return
  }
  // 激活态由 trackRoute 在导航成功后统一写入：导航被守卫拦下（如未保存单据的离开确认）
  // 时不能提前把别的标签标成激活，否则标签栏与页面内容对不上。
  void router.push(tab.path)
}

/**
 * 关闭标签：
 * - 关的不是当前页 → 只移除，当前页不变；
 * - 关的是当前页 → 跳到右邻居，其次左邻居；
 * - 只剩一个标签时不允许关闭（页面总得有个落脚点）。
 * 关闭后把该页的实例代号 +1：下次打开是全新实例。代号在导航完成后再自增，
 * 否则当前页会先按新键重新挂载一次（白跑一遍初始化请求）。
 */
export function closeAppTab(router: Router, key: string) {
  if (tabs.value.length <= 1) return
  const nextKey = activeKeyAfterClose(tabs.value, key, activeKey.value)
  const nextTab = tabs.value.find((item) => item.key === nextKey)
  const stayed = nextKey === activeKey.value
  tabs.value = closeTab(tabs.value, key)
  if (stayed) {
    invalidate(key)
    return
  }
  activeKey.value = nextKey
  void (nextTab ? router.push(nextTab.path) : Promise.resolve()).finally(() => invalidate(key))
}

/** 退出登录 / 换项目：标签全部作废。 */
export function resetAppTabs() {
  for (const tab of tabs.value) invalidate(tab.key)
  tabs.value = []
  activeKey.value = null
}

export function useAppTabs() {
  return { tabs, activeKey, max: MAX_APP_TABS, tabCacheKey }
}

/** 重新导出上限：布局层的 keep-alive 与标签数必须同一个数。 */
export { MAX_APP_TABS }
