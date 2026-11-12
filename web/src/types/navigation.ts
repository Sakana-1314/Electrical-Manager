/**
 * 权限键与前端菜单门禁。
 *
 * 权限目录的唯一来源是后端 `server/internal/domain/permissions.go`
 * （`GET /permissions` 返回同一份），键名保持一致：`模块:动作`。
 * 用户权限是 `app_user.permissions` 的位图，后端展开成权限键放在 user.permissions；
 * 管理端与小程序端共用同一套权限，功能是否展示只看权限，不再有「功能开关」配置。
 */
export type Permission =
  | 'system:admin'
  | 'warehouse:read'
  | 'warehouse:write'
  | 'purchase:read'
  | 'purchase:write'
  | 'huaxing:read'
  | 'codes:read'
  | 'ledger:read'
  | 'ledger:write'
  | 'hazard:read'
  | 'hazard:write'
  | 'work:read'
  | 'work:write'
  | 'read'

/**
 * 判断权限集合是否满足：
 * - 具体键（如 warehouse:write）要求集合里存在同键权限；
 * - 'read' 是查看类菜单的通配门禁，命中任一模块读权限即可。
 */
export function hasPermission(perms: string[], permission: Permission): boolean {
  if (permission === 'read') return perms.some((p) => p.endsWith(':read'))
  return perms.includes(permission)
}
