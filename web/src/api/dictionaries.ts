import { apiClient } from './client'
import type {
  ManagedUser,
  Page,
  PagedQueryParams,
  PermissionRead,
  UserCreate,
  UserMergeRequest,
  UserUpdate,
} from './generated'

/** 权限位目录：系统管理 + 各功能读写（用户编辑界面的可勾选项） */
export const permissionApi = {
  list: () => apiClient.get<PermissionRead[]>('/permissions').then((r) => r.data),
}

export interface UserListQuery extends PagedQueryParams {
  /** 小程序来源用户不再单列：统一列表按 source / 微信身份区分 */

  keyword?: string
}

/** 管理端用户维护 */
export const dictionaryApi = {
  users: (params?: UserListQuery) =>
    apiClient.get<Page<ManagedUser>>('/users', { params }).then((r) => r.data),
  createUser: (payload: UserCreate) =>
    apiClient.post<ManagedUser>('/users', payload).then((r) => r.data),
  updateUser: (id: number, payload: UserUpdate) =>
    apiClient.patch<ManagedUser>(`/users/${id}`, payload).then((r) => r.data),
  regenerateUserApiToken: (id: number, version: number) =>
    apiClient
      .post<ManagedUser>(`/users/${id}/api-token/regenerate`, { version })
      .then((r) => r.data),
  deleteUser: (id: number) => apiClient.delete(`/users/${id}`),
  /** 合并账号：目标保留资料；来源微信身份随迁、权限位取并集；来源账号删除 */
  mergeUser: (targetId: number, payload: UserMergeRequest) =>
    apiClient.post<ManagedUser>(`/users/${targetId}/merge`, payload).then((r) => r.data),
}
