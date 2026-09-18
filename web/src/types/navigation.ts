import type { Role } from '@/api/generated'

export type Permission =
  | 'warehouse:write'
  | 'purchase:write'
  | 'settings:write'
  | 'hazard:write'
  | 'ledger:write'
  | 'work:write'
  | 'read'

export const rolePermissions: Record<Role, Permission[]> = {
  SUPER_ADMIN: [
    'warehouse:write',
    'purchase:write',
    'settings:write',
    'hazard:write',
    'ledger:write',
    'work:write',
    'read',
  ],
  WAREHOUSE_ADMIN: ['warehouse:write', 'read'],
  PURCHASE_ADMIN: ['purchase:write', 'read'],
  HAZARD_ADMIN: ['hazard:write', 'read'],
  LEDGER_ADMIN: ['ledger:write', 'read'],
  WORK_ADMIN: ['work:write', 'read'],
  READ_ONLY: ['read'],
}

export const roleLabels: Record<Role, string> = {
  SUPER_ADMIN: '超级管理员',
  WAREHOUSE_ADMIN: '仓库管理员',
  PURCHASE_ADMIN: '申购管理员',
  HAZARD_ADMIN: '隐患管理员',
  LEDGER_ADMIN: '台账管理员',
  WORK_ADMIN: '工作管理员',
  READ_ONLY: '只读角色',
}
