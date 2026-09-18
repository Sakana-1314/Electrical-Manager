import { apiClient } from './client'
import type {
  Page,
  PagedQueryParams,
  WorkOverviewRow,
  WorkRecord,
  WorkRecordUpdate,
  WorkRecordWrite,
  WorkTask,
  WorkTaskTimeline,
  WorkTaskUpdate,
  WorkTaskWrite,
  WorkWorkerTimeline,
} from './generated'

/** 区间查询基础参数：三个视图都要求日期区间（必填），服务端还会校验区间上限。 */
export interface WorkRangeQuery {
  start_date: string
  end_date: string
}

/** 任务列表查询：keyword 支持 | 或搜索，status 为英文逗号分隔的状态串。 */
export interface WorkTaskListQuery extends PagedQueryParams {
  keyword?: string
  status?: string
}

/** 任务视图时间线查询：在任务列表筛选基础上加日期区间。 */
export interface WorkTaskTimelineQuery extends WorkRangeQuery, WorkTaskListQuery {}

/** 工作总览查询：区间 + 任务 / 参与人员（英文逗号分隔）+ 关键字 + 分页。 */
export interface WorkOverviewQuery extends WorkRangeQuery, PagedQueryParams {
  keyword?: string
  task_ids?: string
  participants?: string
}

/** 人员视图时间线查询：区间 + 姓名关键字 + 分页。 */
export interface WorkWorkerTimelineQuery extends WorkRangeQuery, PagedQueryParams {
  keyword?: string
}

export const workApi = {
  // ===== 任务 =====
  tasks: (params?: WorkTaskListQuery) =>
    apiClient.get<Page<WorkTask>>('/work-tasks', { params }).then((r) => r.data),
  task: (id: number) => apiClient.get<WorkTask>(`/work-tasks/${id}`).then((r) => r.data),
  createTask: (payload: WorkTaskWrite) =>
    apiClient.post<WorkTask>('/work-tasks', payload).then((r) => r.data),
  // 更新走请求体里的 version 乐观锁（与台账/隐患等模块一致）
  updateTask: (id: number, payload: WorkTaskUpdate) =>
    apiClient.patch<WorkTask>(`/work-tasks/${id}`, payload).then((r) => r.data),
  // 删除走 If-Match 头，避免版本号进入访问日志
  deleteTask: (id: number, version: number) =>
    apiClient.delete(`/work-tasks/${id}`, { headers: { 'If-Match': String(version) } }),

  // ===== 工作记录 =====
  record: (id: number) => apiClient.get<WorkRecord>(`/work-records/${id}`).then((r) => r.data),
  createRecord: (payload: WorkRecordWrite) =>
    apiClient.post<WorkRecord>('/work-records', payload).then((r) => r.data),
  updateRecord: (id: number, payload: WorkRecordUpdate) =>
    apiClient.patch<WorkRecord>(`/work-records/${id}`, payload).then((r) => r.data),
  deleteRecord: (id: number, version: number) =>
    apiClient.delete(`/work-records/${id}`, { headers: { 'If-Match': String(version) } }),

  // ===== 三个视图 =====
  overview: (params: WorkOverviewQuery) =>
    apiClient.get<Page<WorkOverviewRow>>('/work-overview', { params }).then((r) => r.data),
  taskTimeline: (params: WorkTaskTimelineQuery) =>
    apiClient.get<Page<WorkTaskTimeline>>('/work-task-timeline', { params }).then((r) => r.data),
  workerTimeline: (params: WorkWorkerTimelineQuery) =>
    apiClient
      .get<Page<WorkWorkerTimeline>>('/work-worker-timeline', { params })
      .then((r) => r.data),

  /** 项目内历史参与人姓名（去重升序）：表单下拉辅助输入与筛选共用。 */
  participants: (params?: { keyword?: string }) =>
    apiClient.get<string[]>('/work-participants', { params }).then((r) => r.data),
}
