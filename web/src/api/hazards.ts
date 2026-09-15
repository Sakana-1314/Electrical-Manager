import { apiClient } from './client'
import type {
  Hazard,
  HazardFilterOptions,
  HazardLevel,
  HazardStats,
  HazardStatus,
  HazardType,
  HazardTypeUpdate,
  HazardTypeWrite,
  HazardUnit,
  HazardUnitUpdate,
  HazardUnitWrite,
  HazardUpdate,
  HazardWrite,
  Page,
  PagedQueryParams,
} from './generated'

/** 隐患台账列表查询 */
export interface HazardListQuery extends PagedQueryParams {
  status?: HazardStatus
  level?: HazardLevel
  hazard_type_id?: number
  hazard_unit_id?: number
  area?: string
  keyword?: string
  rectify_person?: string
  date_from?: string
  date_to?: string
}

/** 责任单位列表查询 */
export interface HazardUnitListQuery {
  keyword?: string
  enabled?: boolean
}

export const hazardApi = {
  hazards: (params?: HazardListQuery) =>
    apiClient.get<Page<Hazard>>('/hazards', { params }).then((r) => r.data),
  hazard: (id: number) => apiClient.get<Hazard>(`/hazards/${id}`).then((r) => r.data),
  createHazard: (payload: HazardWrite) =>
    apiClient.post<Hazard>('/hazards', payload).then((r) => r.data),
  // 更新走请求体里的 version 乐观锁（与申购计划等模块一致）
  updateHazard: (id: number, payload: HazardUpdate) =>
    apiClient.patch<Hazard>(`/hazards/${id}`, payload).then((r) => r.data),
  // 删除走 If-Match 头，避免版本号进入访问日志
  deleteHazard: (id: number, version: number) =>
    apiClient.delete(`/hazards/${id}`, { headers: { 'If-Match': String(version) } }),
  stats: () => apiClient.get<HazardStats>('/hazards/stats').then((r) => r.data),
  filterOptions: () =>
    apiClient.get<HazardFilterOptions>('/hazards/filter-options').then((r) => r.data),

  units: (params?: HazardUnitListQuery) =>
    apiClient.get<HazardUnit[]>('/hazard-units', { params }).then((r) => r.data),
  createUnit: (payload: HazardUnitWrite) =>
    apiClient.post<HazardUnit>('/hazard-units', payload).then((r) => r.data),
  updateUnit: (id: number, payload: HazardUnitUpdate) =>
    apiClient.patch<HazardUnit>(`/hazard-units/${id}`, payload).then((r) => r.data),
  deleteUnit: (id: number, version: number) =>
    apiClient.delete(`/hazard-units/${id}`, { headers: { 'If-Match': String(version) } }),

  types: () => apiClient.get<HazardType[]>('/hazard-types').then((r) => r.data),
  createType: (payload: HazardTypeWrite) =>
    apiClient.post<HazardType>('/hazard-types', payload).then((r) => r.data),
  updateType: (id: number, payload: HazardTypeUpdate) =>
    apiClient.patch<HazardType>(`/hazard-types/${id}`, payload).then((r) => r.data),
  deleteType: (id: number, version: number) =>
    apiClient.delete(`/hazard-types/${id}`, { headers: { 'If-Match': String(version) } }),
}
