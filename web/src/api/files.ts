import { apiClient } from './client'
import type {
  Attachment,
  AttachmentBulkDelete,
  AttachmentDelete,
  FileObject,
  Page,
} from './generated'

/** 附件列表筛选：不传 status / referenced 即「不限」。 */
export interface AttachmentListQuery {
  page?: number
  page_size?: number
  keyword?: string | null
  referenced?: boolean | null
  status?: 'active' | 'deleted' | 'all'
}

export const fileApi = {
  /**
   * 上传图片。
   *
   * `onProgress` 回传 0~100 的进度（axios 浏览器端走 XHR，`onUploadProgress` 可用；
   * 拿不到总长时不回调，调用方按「不确定进度」展示）。
   * `signal` 用于中止上传（用户移除该项 / 组件卸载）。
   */
  uploadImage: (file: File, onProgress?: (percent: number) => void, signal?: AbortSignal) => {
    const form = new FormData()
    form.append('file', file)
    return apiClient
      .post<FileObject>('/files/images', form, {
        signal,
        onUploadProgress: (event) => {
          if (!onProgress) return
          const total = event.total ?? 0
          if (total <= 0) return
          onProgress(Math.min(100, Math.round((event.loaded / total) * 100)))
        },
      })
      .then((r) => r.data)
  },
  /** 删除图片：被引用次数为 0 才允许；后端只做软删除，保留 7 天后的第一个凌晨 2 点复查引用才物理清除。 */
  removeImage: (id: string) =>
    apiClient.delete<AttachmentDelete>(`/files/images/${id}`).then((r) => r.data),
  listAttachments: (query: AttachmentListQuery = {}) =>
    apiClient
      .get<Page<Attachment>>('/files/images/attachments', { params: query })
      .then((r) => r.data),
  restoreAttachment: (id: string) =>
    apiClient.post<Attachment>(`/files/images/attachments/${id}/restore`).then((r) => r.data),
  /**
   * 删除未引用：把所有 0 引用的附件批量标记为待删除（软删除）。
   * 物理清除由保留期满后第一个凌晨 2 点的定时复查任务执行，没有手动物理删除入口。
   */
  deleteUnreferenced: () =>
    apiClient
      .post<AttachmentBulkDelete>('/files/images/attachments/delete-unreferenced')
      .then((r) => r.data),
}
