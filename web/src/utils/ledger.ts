/**
 * 台账管理的纯逻辑：标签 id 串的解析 / 规范化、扁平标签 → 横向树、下拉选项与筛选条件。
 * 这里不放请求，全部可在单测里直接断言（页面只做渲染与交互）。
 */
import type { LedgerTag, LedgerTagRef } from '@/api/generated'

/** 标签最多 3 层（与后端 `ledger_service.MAX_TAG_LEVEL` 一致，页面据此隐藏「新增子标签」）。 */
export const LEDGER_TAG_MAX_LEVEL = 3

/** 标签管理的筛选范围：孤立标签 = 既无父节点又无子节点；树标签 = 处在层级里的节点。 */
export type LedgerTagScope = 'orphan' | 'tree'

/** 标签筛选下拉的选项（按 UI 规范不放「全部」，清空即不限）。 */
export const ledgerTagScopeOptions: { label: string; value: LedgerTagScope }[] = [
  { label: '孤立标签', value: 'orphan' },
  { label: '树标签', value: 'tree' },
]

/** 台账总览的筛选条件（文本框用空串、标签多选用数组，与仓库其它列表页一致）。 */
export interface LedgerItemFilters {
  keyword: string
  tag_ids: number[]
}

/** 筛选条件初始值（重置即回到这里）。 */
export function initialLedgerFilters(): LedgerItemFilters {
  return { keyword: '', tag_ids: [] }
}

/** 逗号分隔的标签 id 串 → 去重升序的正整数数组（非数字项直接丢弃）。 */
export function parseTagIds(value: string | null | undefined): number[] {
  if (!value) return []
  const ids = new Set<number>()
  for (const part of value.split(',')) {
    const trimmed = part.trim()
    if (!/^\d+$/.test(trimmed)) continue
    const id = Number(trimmed)
    if (id > 0) ids.add(id)
  }
  return [...ids].sort((a, b) => a - b)
}

/** 标签 id 数组 → 去重升序的英文逗号分隔串（与后端存储口径一致）。 */
export function formatTagIds(ids: number[]): string {
  return [...new Set(ids.filter((id) => Number.isInteger(id) && id > 0))]
    .sort((a, b) => a - b)
    .join(',')
}

/** 筛选条件 → 接口查询参数：空值一律不传（标签按选择顺序传给后端）。 */
export function ledgerQuery(
  filters: LedgerItemFilters,
): Record<string, string | number | undefined> {
  return {
    keyword: filters.keyword.trim() || undefined,
    tag_ids: filters.tag_ids.length ? formatTagIds(filters.tag_ids) : undefined,
  }
}

/** URL query → 筛选条件（从 URL 恢复；非法标签 id 由 parseTagIds 丢弃）。 */
export function ledgerFiltersFromQuery(query: Record<string, unknown>): LedgerItemFilters {
  return {
    keyword: String(query.keyword ?? ''),
    tag_ids: parseTagIds(String(query.tag_ids ?? '')),
  }
}

/** 孤立标签：既没有父节点，也没有子节点。 */
export function isOrphanTag(tag: LedgerTag): boolean {
  return tag.parent_id === null && tag.child_count === 0
}

/** 标签的完整层级路径，如「配电柜 / 低压柜 / 抽屉柜」。 */
export function tagPath(tags: LedgerTag[], tag: LedgerTag): string {
  const byId = new Map(tags.map((item) => [item.id, item]))
  const names = [tag.name]
  const seen = new Set([tag.id])
  let current = tag
  while (current.parent_id !== null) {
    const parent = byId.get(current.parent_id)
    if (!parent || seen.has(parent.id)) break
    seen.add(parent.id)
    names.push(parent.name)
    current = parent
  }
  return names.reverse().join(' / ')
}

/** 横向树节点：`id` / `label` / `expand` / `children` 与 vue3-tree-org 的默认字段约定一致。 */
export interface LedgerTagNode {
  id: string
  label: string
  expand: boolean
  children: LedgerTagNode[]
  /** 该节点对应的原始标签数据（点击编辑、悬停浮层展示备注与图片都用它）。 */
  tag: LedgerTag
}

/**
 * 扁平标签列表 → 横向树（至多 3 层）。
 *
 * - 同级按 id 升序（也是创建顺序，后端同样按 id 返回）；
 * - 返回**全新对象**：vue3-tree-org 会往节点上写 `$` 前缀字段，不能污染接口数据；
 * - 父节点不在入参里（关键字筛选把父节点滤掉）时按根节点处理，节点不会凭空消失；
 * - 传 `scope` 时先在本地剪枝（页面筛选走后端，这里主要用于展示与测试）。
 */
export function buildLedgerTagTree(tags: LedgerTag[], scope?: LedgerTagScope): LedgerTagNode[] {
  const visible = scope
    ? tags.filter((tag) => (scope === 'orphan' ? isOrphanTag(tag) : !isOrphanTag(tag)))
    : tags
  const nodes = new Map<number, LedgerTagNode>()
  for (const tag of [...visible].sort((a, b) => a.id - b.id)) {
    nodes.set(tag.id, { id: `tag:${tag.id}`, label: tag.name, expand: true, children: [], tag })
  }
  const roots: LedgerTagNode[] = []
  for (const node of nodes.values()) {
    const parentId = node.tag.parent_id
    const parent = parentId === null ? undefined : nodes.get(parentId)
    if (parent) parent.children.push(node)
    else roots.push(node)
  }
  return roots
}

/** n-tree-select 的选项节点：`key` 用标签 id，`path` 供已选标签展示完整层级。 */
export interface LedgerTagSelectOption {
  key: number
  label: string
  path: string
  children?: LedgerTagSelectOption[]
}

/** 台账表单里的标签选择器选项：与树同构，任意层级都可选中。 */
export function tagSelectOptions(tags: LedgerTag[]): LedgerTagSelectOption[] {
  const nodes = new Map<number, LedgerTagSelectOption>()
  const ordered = [...tags].sort((a, b) => a.id - b.id)
  for (const tag of ordered) {
    nodes.set(tag.id, { key: tag.id, label: tag.name, path: tagPath(ordered, tag) })
  }
  const roots: LedgerTagSelectOption[] = []
  for (const tag of ordered) {
    const node = nodes.get(tag.id)
    if (!node) continue
    const parent = tag.parent_id === null ? undefined : nodes.get(tag.parent_id)
    if (parent) parent.children = [...(parent.children ?? []), node]
    else roots.push(node)
  }
  return roots
}

/** 列表「标签」列的展示切片：最多前 `max` 个，其余用 +N 表示（与图片列的展示口径一致）。 */
export function tagColumnDisplay(
  refs: LedgerTagRef[],
  max = 3,
): { visible: LedgerTagRef[]; extra: number } {
  return { visible: refs.slice(0, max), extra: Math.max(0, refs.length - max) }
}
