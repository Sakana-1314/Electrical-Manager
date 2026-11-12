import type { Permission } from '@/types/navigation'

/**
 * 后台侧栏一级菜单（主 tab）清单：**数组顺序就是侧栏顺序**。
 *
 * - 可见性由权限位决定：`permission` 是进入该模块需要的读权限（`null` = 不设门禁，始终显示）；
 *   管理端与小程序端共用同一套权限，不再有「后台可见功能」配置；
 * - 工作台 / 备忘录不挂模块权限，任何登录用户都能看到；
 * - `route` 是「落地页」用的代表路由：登录后落到「当前可见的第一个主 tab」；
 * - **系统管理不在本列表**：按 `system:admin` 权限出现在侧栏末尾（见 `layouts/mainMenu.ts`）；
 * - 权限只影响侧栏渲染与落地页推导，不做路由/接口拦截：无权限的页面仍可用链接直达，
 *   但页面内的接口会按同一权限位返回 403。
 */
export const NAV_FEATURES = [
  { key: 'dashboard', label: '工作台', route: 'dashboard', permission: null },
  { key: 'memos', label: '备忘录', route: 'memos', permission: null },
  // 二级库在精简模式下是单一一级项（warehouse-lite），代表路由随模式切换（见 resolveLandingRouteName）
  { key: 'warehouse', label: '二级库', route: 'stock', permission: 'warehouse:read' },
  {
    key: 'huaxing_inventory',
    label: '华星总库存',
    route: 'hua-xing-stock',
    permission: 'huaxing:read',
  },
  {
    key: 'procurement',
    label: '申购管理',
    route: 'purchase-materials',
    permission: 'purchase:read',
  },
  { key: 'hazards', label: '隐患管理', route: 'hazard-records', permission: 'hazard:read' },
  { key: 'ledger', label: '台账管理', route: 'ledger-items', permission: 'ledger:read' },
  { key: 'work', label: '工作管理', route: 'work-overview', permission: 'work:read' },
] as const

export type NavFeatureKey = (typeof NAV_FEATURES)[number]['key']

/** 当前权限下可见的主 tab（保持侧栏顺序）。 */
export function visibleNavFeatureKeys(can: (permission: Permission) => boolean): NavFeatureKey[] {
  return NAV_FEATURES.filter(
    (feature) => feature.permission === null || can(feature.permission),
  ).map((feature) => feature.key)
}

/**
 * 落地页路由名：当前权限下可见的第一个主 tab。
 * 二级库在精简模式下落到 `warehouse-lite`；异常情况回落工作台（工作台不设门禁，始终可见）。
 */
export function resolveLandingRouteName(
  can: (permission: Permission) => boolean,
  options: { isLiteMode: boolean },
): string {
  const [first] = visibleNavFeatureKeys(can)
  if (first === 'warehouse' && options.isLiteMode) return 'warehouse-lite'
  return NAV_FEATURES.find((feature) => feature.key === first)?.route ?? 'dashboard'
}
