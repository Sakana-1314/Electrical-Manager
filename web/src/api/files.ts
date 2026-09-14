import { apiClient } from './client'
import type { Attachment, AttachmentCleanup, AttachmentDelete, FileObject, Page } from './generated'

/** 附件列表筛选：status 默认只看在用，deleted 查看待清理，all 全看。 */
export interface AttachmentListQuery {
  page?: number
  page_size?: number
  keyword?: string | null
  referenced?: boolean | null
  status?: 'active' | 'deleted' | 'all'
}

export const fileApi = {
  uploadImage: (file: File) => {
    const form = new FormData()
    form.append('file', file)
    return apiClient.post<FileObject>('/files/images', form).then((r) => r.data)
  },
  /** 删除图片：被引用次数为 0 才允许；后端只做软删除，次日凌晨 2 点复查引用后才物理清除。 */
  removeImage: (id: string) =>
    apiClient.delete<AttachmentDelete>(`/files/images/${id}`).then((r) => r.data),
  listAttachments: (query: AttachmentListQuery = {}) =>
    apiClient
      .get<Page<Attachment>>('/files/images/attachments', { params: query })
      .then((r) => r.data),
  restoreAttachment: (id: string) =>
    apiClient.post<Attachment>(`/files/images/attachments/${id}/restore`).then((r) => r.data),
  /** 立即执行待删除附件清理（与凌晨 2 点后台任务同一逻辑，仍会复查引用）。 */
  purgeAttachments: () =>
    apiClient.post<AttachmentCleanup>('/files/images/attachments/purge').then((r) => r.data),
}
