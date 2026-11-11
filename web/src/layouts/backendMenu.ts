import type { MenuOption } from 'naive-ui'
import { CheckmarkOutline, ServerOutline } from '@vicons/ionicons5'
import type { IconRender } from './appearanceMenu'

/**
 * 侧栏左下角用户菜单里的「线路」二级菜单（多后端地址）。
 *
 * 独立出来便于单测：菜单结构与 key 解析都是纯逻辑，不需要挂载布局组件；
 * 图标渲染沿用 appearanceMenu 的约定（包装成 NIcon）。
 * 只有配置了多条线路才显示；当前线路前面显示对勾，切换后整页刷新。
 */
export const BACKEND_MENU_KEY = 'backend-menu'

/** 父项标题前缀；后面接当前线路的显示名。 */
export const BACKEND_MENU_LABEL_PREFIX = '线路：'

/** 子项 key 前缀：`backend:<下标>`（用下标而不是地址，避免 URL 里的特殊字符进 key）。 */
export const BACKEND_ITEM_KEY_PREFIX = 'backend:'

/** key 是否属于线路子项（父项 key 是 `backend-menu`，不会被当成选择）。 */
export function isBackendMenuKey(key: string): boolean {
  return key.startsWith(BACKEND_ITEM_KEY_PREFIX)
}

/** 从子项 key 解析线路下标；非法 / 占位 key 返回 null。 */
export function backendIndexFromMenuKey(key: string): number | null {
  if (!isBackendMenuKey(key)) return null
  const index = Number(key.slice(BACKEND_ITEM_KEY_PREFIX.length))
  return Number.isInteger(index) && index >= 0 ? index : null
}

/**
 * 线路显示名：同源地址显示「本站」，外部地址显示域名（含端口）；
 * 非默认的 `/api/v1` 路径一并带上，两条地址同域不同前缀时也能区分。
 */
export function backendOptionLabel(url: string, origin: string): string {
  try {
    const resolved = new URL(url, origin)
    const host = resolved.origin === origin ? '本站' : resolved.host
    const path = resolved.pathname.replace(/\/+$/, '') || '/'
    return path === '/api/v1' ? host : `${host}${path}`
  } catch {
    return url
  }
}

/**
 * 构造用户菜单里的「线路」二级菜单。只有一条候选时返回空数组（不显示该菜单）。
 * `origin` 显式传入，便于单测与同源判断保持一致。
 */
export function buildBackendMenuSubmenu(
  urls: readonly string[],
  activeIndex: number,
  renderIcon: IconRender,
  origin: string = window.location.origin,
): MenuOption[] {
  if (urls.length < 2) return []
  const current = urls[activeIndex] ?? urls[0]
  return [
    {
      label: `${BACKEND_MENU_LABEL_PREFIX}${backendOptionLabel(current, origin)}`,
      key: BACKEND_MENU_KEY,
      icon: renderIcon(ServerOutline),
      children: urls.map((url, index) => ({
        key: `${BACKEND_ITEM_KEY_PREFIX}${index}`,
        label: backendOptionLabel(url, origin),
        icon: renderIcon(index === activeIndex ? CheckmarkOutline : ServerOutline),
      })),
    },
  ]
}
