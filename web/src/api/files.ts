import { apiClient } from './client'
import type {
  Attachment,
  AttachmentBulkDelete,
  AttachmentDelete,
  FileObject,
  ImageDigestMatch,
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

/**
 * 图片上传的请求超时（30 分钟）。
 *
 * 不能用全局的 30s：单张最大 10MB，慢速上行（现场 4G、受限局域网）光传输就可能超过 30s，
 * 而 axios/XHR 的 `timeout` 是**整个请求的总时长**，一旦超时请求已被中止，重传只能从头再来。
 * 这里一次给足 30 分钟，把「传得慢」和「连接真的断了」区分开：后者由浏览器/系统自己报错。
 */
export const IMAGE_UPLOAD_TIMEOUT_MS = 30 * 60_000

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
        // 30 分钟：大图 + 慢上行不能按全局 30s 判定失败（见 IMAGE_UPLOAD_TIMEOUT_MS）
        timeout: IMAGE_UPLOAD_TIMEOUT_MS,
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
  /**
   * 上传前查重：提交原始文件摘要（只对 >1MB 的图片调用）。
   *
   * 命中时返回可复用的文件与一段**随机中间片段**的挑战材料（`offset` / `length` / `slice_sha256`），
   * 由前端本地对同位置字节二次校验；未命中返回 `matched: false`，调用方走正常上传。
   */
  checkImageDigest: (payload: { sha256: string; size_bytes: number }) =>
    apiClient.post<ImageDigestMatch>('/files/images/dedup-check', payload).then((r) => r.data),
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
