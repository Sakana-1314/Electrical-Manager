import { apiBaseUrl, imageBaseUrl, joinUrl, resolveImageBaseUrl } from '@/config/env'
import { readBlobBytes, sha256Hex } from './sha256'

export const allowedImageTypes = ['image/jpeg', 'image/png', 'image/webp'] as const
export const maxImageBytes = 10 * 1024 * 1024
/** 「本地摘要校验、命中免上传」的阈值：只对大于 1MB 的图片查重（与后端 `DEDUP_MIN_BYTES` 对应）。 */
export const dedupMinBytes = 1024 * 1024
let activeImageBaseUrl = imageBaseUrl

export function configureImageBaseUrl(serverUrl: string): void {
  activeImageBaseUrl = serverUrl.trim() ? resolveImageBaseUrl(serverUrl, apiBaseUrl) : imageBaseUrl
}

export function imageUrl(fileId: string): string {
  return joinUrl(activeImageBaseUrl, encodeURIComponent(fileId))
}

export function imagePreviewUrl(fileId: string, size: number): string {
  return `${imageUrl(fileId)}?size=${size}`
}

export function validateImageSelection(
  existingCount: number,
  files: File[],
  maxCount = 9,
): string | null {
  if (existingCount + files.length > maxCount) return `每个物资最多上传 ${maxCount} 张图片`
  const invalidType = files.find(
    (file) => !allowedImageTypes.includes(file.type as (typeof allowedImageTypes)[number]),
  )
  if (invalidType) return `${invalidType.name} 不是支持的图片类型`
  const oversized = files.find((file) => file.size > maxImageBytes)
  if (oversized) return `${oversized.name} 超过 10 MB`
  return null
}

/** 是否值得先做摘要查重：小图直接上传更省事，也省掉一次主线程哈希。 */
export function shouldCheckDuplicate(file: File): boolean {
  return file.size > dedupMinBytes
}

/** 服务端返回的中间片段挑战材料（字段可能为 null，未命中时整组都是 null）。 */
export interface DedupSlice {
  offset?: number | null
  length?: number | null
  slice_sha256?: string | null
}

/**
 * 二次校验：对本地同位置字节算摘要，与挑战材料比对。
 *
 * 只要挑战材料不完整、越界（`offset + length` 超出文件长度）或摘要对不上就返回 false，
 * 调用方一律退回正常上传——校验只用来省流量，不该让上传失败。
 */
export async function matchesDedupSlice(file: File, slice: DedupSlice): Promise<boolean> {
  const { offset, length, slice_sha256: expected } = slice
  if (typeof offset !== 'number' || typeof length !== 'number' || !expected) return false
  if (!Number.isInteger(offset) || !Number.isInteger(length)) return false
  if (offset < 0 || length <= 0 || offset + length > file.size) return false
  const bytes = await readBlobBytes(file.slice(offset, offset + length))
  return sha256Hex(bytes) === expected.toLowerCase()
}
