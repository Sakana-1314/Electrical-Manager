/**
 * 顶部标签页的纯逻辑（无 Vue 依赖，便于单测）。
 *
 * 一个标签对应一个页面（按路由名去重，不按 fullPath）：带查询参数深链（如 ?detail=5）
 * 打开详情时沿用原标签，不额外生成一个几乎同名的标签。标签上记录该页最后一次的地址，
 * 切回来时连筛选条件一起还原。
 */
export interface AppTab {
  /** 路由名，作为标签唯一键 */
  key: string
  /** 标签文字：取路由 meta.title */
  title: string
  /** 该页最后一次的地址（含查询与 hash） */
  path: string
}

/** 最多同时打开的标签数；超出后淘汰最早打开的那个（当前新标签在末尾，不会被淘汰）。 */
export const MAX_APP_TABS = 8

/** 打开 / 更新一个标签：已存在则原地更新标题与地址，顺序不动（标签不因点击而跳动）。 */
export function upsertTab(tabs: AppTab[], tab: AppTab, max = MAX_APP_TABS): AppTab[] {
  const index = tabs.findIndex((item) => item.key === tab.key)
  const next = tabs.slice()
  if (index >= 0) {
    next[index] = { ...next[index], ...tab }
    return next
  }
  next.push(tab)
  while (next.length > max) next.shift()
  return next
}

/** 关闭标签：只移除，不决定下一个激活谁（见 `activeKeyAfterClose`）。 */
export function closeTab(tabs: AppTab[], key: string): AppTab[] {
  return tabs.filter((item) => item.key !== key)
}

/**
 * 关闭后应该激活哪个标签：
 * - 关的不是当前标签 → 当前标签不变；
 * - 关的是当前标签 → 优先右邻居，其次左邻居，都没有（关掉最后一个）返回 null。
 */
export function activeKeyAfterClose(
  tabs: AppTab[],
  closingKey: string,
  activeKey: string | null,
): string | null {
  if (activeKey !== closingKey) return activeKey
  const index = tabs.findIndex((item) => item.key === closingKey)
  const remaining = closeTab(tabs, closingKey)
  if (!remaining.length) return null
  return (tabs[index + 1] ?? tabs[index - 1] ?? remaining[remaining.length - 1]).key
}

/** 被顺带淘汰的标签（FIFO 超限时返回被移除的键），用于让这些页面下次打开时重新加载。 */
export function evictedKeys(before: AppTab[], after: AppTab[]): string[] {
  const kept = new Set(after.map((item) => item.key))
  return before.filter((item) => !kept.has(item.key)).map((item) => item.key)
}
