import { apiClient } from './client'
import type { Project, ProjectCreate, ProjectUpdate } from './generated'

/**
 * 项目管理接口：列表对所有登录用户开放（右上角的项目切换器要用），增删改只允许超级管理员。
 * 项目列表本身不需要 X-Project-Id；其余业务请求由 client.ts 的拦截器统一带上当前项目。
 */
export const projectApi = {
  list: () => apiClient.get<Project[]>('/projects').then((r) => r.data),
  create: (payload: ProjectCreate) =>
    apiClient.post<Project>('/projects', payload).then((r) => r.data),
  update: (id: number, payload: ProjectUpdate) =>
    apiClient.patch<Project>(`/projects/${id}`, payload).then((r) => r.data),
  remove: (id: number, version: number) =>
    apiClient.delete(`/projects/${id}`, { headers: { 'If-Match': String(version) } }),
}
