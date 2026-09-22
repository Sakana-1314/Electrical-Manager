import type { WebFeatureVisibility } from '@/api/generated'

/**
 * 后台侧栏一级菜单（主 tab）清单：**数组顺序就是侧栏顺序**。
 *
 * - `key` 与契约里的 `WebFeatureVisibility` 字段一一对应（`docs/openapi.yaml`），新增主 tab 时两处同步登记；
 * - `route` 是「落地页」用的代表路由：`/`、登录后与无权限跳转都落到「当前可见的第一个主 tab」；
 * - **系统管理不在本列表**：它不参与可见性开关、始终显示（保证高级设置永远能从侧栏进入），
 *   只沿用原有的 `settings:write` 权限判断；
 * - 可见性只影响侧栏渲染，不做路由/接口拦截：被隐藏的页面仍可用链接直达。
 */
export const NAV_FEATURES = [
  { key: 'dashboard', label: '工作台', route: 'dashboard' },
  { key: 'memos', label: '备忘录', route: 'memos' },
  // 二级库在精简模式下是单一一级项（warehouse-lite），代表路由随模式切换（见 resolveLandingRouteName）
  { key: 'warehouse', label: '二级库', route: 'stock' },
  { key: 'huaxing_inventory', label: '华星总库存', route: 'hua-xing-stock' },
  { key: 'procurement', label: '申购管理', route: 'purchase-materials' },
  { key: 'hazards', label: '隐患管理', route: 'hazard-records' },
  { key: 'ledger', label: '台账管理', route: 'ledger-items' },
  { key: 'work', label: '工作管理', route: 'work-overview' },
] as const

export type NavFeatureKey = (typeof NAV_FEATURES)[number]['key']

/** 全部可见：拉取失败、响应缺字段（旧服务端 / 回滚）与本地兜底都用它，避免把功能藏起来。 */
export const ALL_NAV_FEATURES_VISIBLE: WebFeatureVisibility = {
  dashboard: true,
  memos: true,
  warehouse: true,
  huaxing_inventory: true,
  procurement: true,
  hazards: true,
  ledger: true,
  work: true,
}

/**
 * 当前可见的主 tab（保持侧栏顺序）。
 *
 * 规则：字段不是布尔 `false` 就按可见处理（缺字段视为可见）；若全部被隐藏，
 * 视为无效配置回落到全部可见——侧栏永远不会被关空（服务端读/写同样做这条归一）。
 */
export function visibleNavFeatureKeys(
  flags: WebFeatureVisibility | null | undefined,
): NavFeatureKey[] {
  const visible = NAV_FEATURES.filter((feature) => flags?.[feature.key] !== false).map(
    (feature) => feature.key,
  )
  if (visible.length > 0) return visible
  return NAV_FEATURES.map((feature) => feature.key)
}

/** 单个主 tab 是否可见（供侧栏拼装与开关组回显共用）。 */
export function isNavFeatureVisible(
  flags: WebFeatureVisibility | null | undefined,
  key: NavFeatureKey,
): boolean {
  return visibleNavFeatureKeys(flags).includes(key)
}

/**
 * 落地页路由名：当前可见的第一个主 tab。
 * 二级库在精简模式下落到 `warehouse-lite`；全部隐藏时回落工作台（与 `visibleNavFeatureKeys` 同口径）。
 */
export function resolveLandingRouteName(
  flags: WebFeatureVisibility | null | undefined,
  options: { isLiteMode: boolean },
): string {
  const [first] = visibleNavFeatureKeys(flags)
  if (first === 'warehouse' && options.isLiteMode) return 'warehouse-lite'
  return NAV_FEATURES.find((feature) => feature.key === first)?.route ?? 'dashboard'
}
