import { apiClient } from './client'
import type {
  LedgerItem,
  LedgerItemUpdate,
  LedgerItemWrite,
  LedgerTag,
  LedgerTagUpdate,
  LedgerTagWrite,
  Page,
  PagedQueryParams,
} from './generated'

/** 台账列表查询：tag_ids 是英文逗号分隔的标签 id，命中任一（含其子孙标签）即返回。 */
export interface LedgerItemListQuery extends PagedQueryParams {
  keyword?: string
  tag_ids?: string
}

/** 标签列表查询：scope 不传即不限（orphan=孤立标签，tree=处在层级里的标签）。 */
export interface LedgerTagListQuery {
  keyword?: string
  scope?: 'orphan' | 'tree'
}

export const ledgerApi = {
  items: (params?: LedgerItemListQuery) =>
    apiClient.get<Page<LedgerItem>>('/ledger-items', { params }).then((r) => r.data),
  item: (id: number) => apiClient.get<LedgerItem>(`/ledger-items/${id}`).then((r) => r.data),
  createItem: (payload: LedgerItemWrite) =>
    apiClient.post<LedgerItem>('/ledger-items', payload).then((r) => r.data),
  // 更新走请求体里的 version 乐观锁（与隐患/申购等模块一致）
  updateItem: (id: number, payload: LedgerItemUpdate) =>
    apiClient.patch<LedgerItem>(`/ledger-items/${id}`, payload).then((r) => r.data),
  // 删除走 If-Match 头，避免版本号进入访问日志
  deleteItem: (id: number, version: number) =>
    apiClient.delete(`/ledger-items/${id}`, { headers: { 'If-Match': String(version) } }),

  tags: (params?: LedgerTagListQuery) =>
    apiClient.get<LedgerTag[]>('/ledger-tags', { params }).then((r) => r.data),
  createTag: (payload: LedgerTagWrite) =>
    apiClient.post<LedgerTag>('/ledger-tags', payload).then((r) => r.data),
  updateTag: (id: number, payload: LedgerTagUpdate) =>
    apiClient.patch<LedgerTag>(`/ledger-tags/${id}`, payload).then((r) => r.data),
  deleteTag: (id: number, version: number) =>
    apiClient.delete(`/ledger-tags/${id}`, { headers: { 'If-Match': String(version) } }),
}
