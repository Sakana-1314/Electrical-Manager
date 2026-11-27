import { apiClient } from './client'
import type { Page, PagedQueryParams, WorkTask, WorkTaskUpdate, WorkTaskWrite } from './generated'

/** 任务列表查询：tags 为英文逗号分隔的标签（命中任意一个即可），status 为完成状态。 */
export interface WorkTaskListQuery extends PagedQueryParams {
  keyword?: string
  tags?: string
  status?: string
}

export const workApi = {
  tasks: (params?: WorkTaskListQuery) =>
    apiClient.get<Page<WorkTask>>('/work-tasks', { params }).then((r) => r.data),
  task: (id: number) => apiClient.get<WorkTask>(`/work-tasks/${id}`).then((r) => r.data),
  createTask: (payload: WorkTaskWrite) =>
    apiClient.post<WorkTask>('/work-tasks', payload).then((r) => r.data),
  // 更新走请求体里的 version 乐观锁（与台账 / 隐患等模块一致）
  updateTask: (id: number, payload: WorkTaskUpdate) =>
    apiClient.patch<WorkTask>(`/work-tasks/${id}`, payload).then((r) => r.data),
  // 删除走 If-Match 头，避免版本号进入访问日志
  deleteTask: (id: number, version: number) =>
    apiClient.delete(`/work-tasks/${id}`, { headers: { 'If-Match': String(version) } }),

  /** 项目内任务出现过的标签（去重升序），供筛选下拉与标签输入辅助。 */
  taskTags: () => apiClient.get<string[]>('/work-task-tags').then((r) => r.data),
}
