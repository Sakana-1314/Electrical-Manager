import { apiClient } from './client'
import type {
  ManagedUser,
  MiniProgramUser,
  MiniProgramUserMergeInput,
  PermissionDef,
  RoleCreate,
  RoleRead,
  RoleUpdate,
  MiniProgramUserUpdate,
  Page,
  PagedQueryParams,
} from './generated'

/** 管理端用户列表查询 */
/** 角色（RBAC）：角色 CRUD 与权限目录（编辑用户的多角色分配用） */
export const roleApi = {
  roles: () => apiClient.get<RoleRead[]>('/roles').then((r) => r.data),
  permissions: () => apiClient.get<PermissionDef[]>('/roles/permissions').then((r) => r.data),
  createRole: (payload: RoleCreate) =>
    apiClient.post<RoleRead>('/roles', payload).then((r) => r.data),
  updateRole: (id: number, payload: RoleUpdate) =>
    apiClient.patch<RoleRead>(`/roles/${id}`, payload).then((r) => r.data),
  deleteRole: (id: number, version: number) =>
    apiClient.delete(`/roles/${id}`, { headers: { 'If-Match': String(version) } }),
}

export interface UserListQuery extends PagedQueryParams {
  keyword?: string
}

/** 小程序用户列表查询 */
export type MiniProgramUserListQuery = PagedQueryParams

export const dictionaryApi = {
  users: (params?: UserListQuery) =>
    apiClient.get<Page<ManagedUser>>('/users', { params }).then((r) => r.data),
  createUser: (payload: Partial<ManagedUser> & { password?: string }) =>
    apiClient.post<ManagedUser>('/users', payload).then((r) => r.data),
  updateUser: (id: number, payload: Partial<ManagedUser> & { password?: string }) =>
    apiClient.patch<ManagedUser>(`/users/${id}`, payload).then((r) => r.data),
  regenerateUserApiToken: (id: number, version: number) =>
    apiClient
      .post<ManagedUser>(`/users/${id}/api-token/regenerate`, { version })
      .then((r) => r.data),
  deleteUser: (id: number) => apiClient.delete(`/users/${id}`),
  miniProgramUsers: (params?: MiniProgramUserListQuery) =>
    apiClient.get<Page<MiniProgramUser>>('/mini-program-users', { params }).then((r) => r.data),
  updateMiniProgramUser: (id: number, payload: MiniProgramUserUpdate) =>
    apiClient.patch<MiniProgramUser>(`/mini-program-users/${id}`, payload).then((r) => r.data),
  deleteMiniProgramUser: (id: number, version: number) =>
    apiClient.delete(`/mini-program-users/${id}`, { headers: { 'If-Match': String(version) } }),
  mergeMiniProgramUsers: (targetId: number, payload: MiniProgramUserMergeInput) =>
    apiClient
      .post<MiniProgramUser>(`/mini-program-users/${targetId}/merge`, payload)
      .then((r) => r.data),
}
