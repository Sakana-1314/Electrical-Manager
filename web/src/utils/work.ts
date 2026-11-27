import type { SelectOption } from 'naive-ui'

/** 工作管理列表筛选：标签（多选）+ 完成状态 + 关键字。 */
export type WorkTaskStatusFilter = '未完成' | '已完成'

export interface WorkTaskFilters {
  keyword: string
  tags: string[]
  status: WorkTaskStatusFilter | null
}

export const workTaskStatusOptions: SelectOption[] = [
  { label: '未完成', value: '未完成' },
  { label: '已完成', value: '已完成' },
]

/** 默认筛选：全部任务（标签、状态都不限）。 */
export function initialWorkTaskFilters(): WorkTaskFilters {
  return { keyword: '', tags: [], status: null }
}

/** 拆分标签串（英文 / 中文逗号），去空白、去空、去重保序。 */
export function splitWorkTags(value: string): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const part of value.split(/[,，]/)) {
    const tag = part.trim()
    if (tag === '' || seen.has(tag)) continue
    seen.add(tag)
    out.push(tag)
  }
  return out
}

/** 标签列表 → 英文逗号分隔字符串（服务端存储口径）。 */
export function joinWorkTags(tags: string[]): string {
  return splitWorkTags(tags.join(',')).join(',')
}

/** 筛选条件 → URL / 接口查询参数（空条件不出现）。 */
export function workTaskQuery(f: WorkTaskFilters): Record<string, string> {
  const out: Record<string, string> = {}
  if (f.keyword.trim()) out.keyword = f.keyword.trim()
  if (f.tags.length > 0) out.tags = joinWorkTags(f.tags)
  if (f.status) out.status = f.status
  return out
}

/** URL 查询参数 → 筛选条件（手改 URL 的非法值就地忽略）。 */
export function workTaskFiltersFromQuery(query: Record<string, unknown>): WorkTaskFilters {
  const status = String(query.status ?? '')
  return {
    keyword: String(query.keyword ?? ''),
    tags: splitWorkTags(String(query.tags ?? '')),
    status: status === '未完成' || status === '已完成' ? status : null,
  }
}

/** 完成度展示：整数百分比（越界按 0 / 100 处理）。 */
export function workProgressText(progress: number): string {
  const value = Math.min(100, Math.max(0, Math.round(progress)))
  return `${value}%`
}
