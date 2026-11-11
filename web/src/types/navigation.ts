/**
 * 权限键与前端菜单门禁。
 *
 * 权限目录的唯一来源是后端 `server/internal/domain/permissions.go`（GET /roles/permissions 也返回同一份），
 * 键名保持一致：`模块:动作`。用户实际权限 = 所挂角色权限的并集（后端算好放在 user.permissions）。
 */
export type Permission =
  | 'settings:write'
  | 'warehouse:write'
  | 'purchase:write'
  | 'hazard:write'
  | 'ledger:write'
  | 'work:write'
  | 'read'

/**
 * 判断权限并集是否满足：
 * - 具体键（如 warehouse:write）要求并集里存在同键权限；
 * - 'read' 是查看类菜单的通配门禁，命中任一模块读权限即可（只读角色的基础能力）。
 */
export function hasPermission(perms: string[], permission: Permission): boolean {
  if (permission === 'read') return perms.some((p) => p.endsWith(':read'))
  return perms.includes(permission)
}
