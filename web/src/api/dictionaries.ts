import { apiClient } from './client'
import type {
  ManagedUser,
  RoleRead,
  UserMergeRequest,
  Page,
  PagedQueryParams,
} from './generated'

/** 管理端用户列表查询 */
/** 角色（RBAC）：内置角色固定种子、无 CRUD；本接口只读，供用户编辑的多角色下拉使用 */
export const roleApi = {
  roles: () => apiClient.get<RoleRead[]>('/roles').then((r) => r.data),
}

export interface UserListQuery extends PagedQueryParams {
  /** 小程序来源用户不再单列：统一列表按 source / 微信身份区分 */

  keyword?: string
}

/** 小程序用户列表查询 */
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
  /** 合并账号：目标保留资料；来源微信身份随迁、角色取并集；来源账号删除 */
  mergeUser: (targetId: number, payload: UserMergeRequest) =>
    apiClient.post<ManagedUser>(`/users/${targetId}/merge`, payload).then((r) => r.data),
}
