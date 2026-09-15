import type { HazardLevel, HazardStatus, HazardType } from '@/api/generated'

/** 隐患状态的中文标签（与后端枚举值同名，这里集中一处便于复用与断言）。 */
export const hazardStatuses: HazardStatus[] = ['待整改', '整改受阻', '已整改']

/** 隐患等级取值。 */
export const hazardLevels: HazardLevel[] = ['一般隐患', '重大隐患']

/** 状态标签的 Naive UI type（与仓库其它状态标签的语义色一致）。 */
export const hazardStatusTypes: Record<HazardStatus, 'warning' | 'error' | 'success'> = {
  待整改: 'warning',
  整改受阻: 'error',
  已整改: 'success',
}

/** 等级标签的 Naive UI type：重大隐患用红色，一般隐患用 info。 */
export const hazardLevelTypes: Record<HazardLevel, 'error' | 'info'> = {
  一般隐患: 'info',
  重大隐患: 'error',
}

/** 隐患列表筛选条件（文本框用空串、可选下拉用 null，与仓库其它列表页一致）。 */
export interface HazardFilters {
  status: HazardStatus | null
  level: HazardLevel | null
  hazard_type_id: number | null
  hazard_unit_id: number | null
  rectify_person: string | null
  area: string
  keyword: string
  dateRange: [number, number] | null
}

/** 筛选条件的初始值（重置即回到这里）。 */
export function initialHazardFilters(): HazardFilters {
  return {
    status: null,
    level: null,
    hazard_type_id: null,
    hazard_unit_id: null,
    rectify_person: null,
    area: '',
    keyword: '',
    dateRange: null,
  }
}

/** 时间戳 → 上海时区的 YYYY-MM-DD（日期筛选与后端 inspection_date 同一口径）。 */
function toShanghaiDate(timestamp: number): string {
  const shifted = new Date(timestamp + 8 * 60 * 60 * 1000)
  const month = String(shifted.getUTCMonth() + 1).padStart(2, '0')
  const day = String(shifted.getUTCDate()).padStart(2, '0')
  return `${shifted.getUTCFullYear()}-${month}-${day}`
}

/** 筛选条件 → 接口查询参数：空值一律不传，日期区间取两端。 */
export function hazardQuery(filters: HazardFilters): Record<string, string | number | undefined> {
  const [from, to] = filters.dateRange ?? []
  return {
    status: filters.status ?? undefined,
    level: filters.level ?? undefined,
    hazard_type_id: filters.hazard_type_id ?? undefined,
    hazard_unit_id: filters.hazard_unit_id ?? undefined,
    rectify_person: filters.rectify_person ?? undefined,
    area: filters.area.trim() || undefined,
    keyword: filters.keyword.trim() || undefined,
    date_from: from === undefined ? undefined : toShanghaiDate(from),
    date_to: to === undefined ? undefined : toShanghaiDate(to),
  }
}

/**
 * 是否逾期未整改：要求完成时间早于今天，且状态不是「已整改」。
 * 今天到期不算逾期（与后端统计口径一致）。
 */
export function isHazardOverdue(dueDate: string, status: HazardStatus, today: string): boolean {
  if (status === '已整改') {
    return false
  }
  return dueDate < today
}

/** 隐患类型横向树的叶子节点：对应 `hazard_type` 的一行（一个大类 + 一个小类组合）。 */
export interface HazardTypeLeaf {
  /** 树节点唯一键，形如 `type:12`（`id` 是 vue3-tree-org 的默认 key 字段名） */
  id: string
  /** 展示文案（小类） */
  label: string
  /** 该行原始数据，编辑/删除时用 */
  type: HazardType
}

/** 隐患类型横向树的分组节点：一个大类及其下的小类。 */
export interface HazardTypeBranch {
  /** 树节点唯一键，形如 `major:电气设备` */
  id: string
  /** 展示文案（大类） */
  label: string
  /** 该大类下的小类数量（节点上展示计数） */
  count: number
  /** 默认展开：树组件按该字段决定是否展开子节点 */
  expand: boolean
  children: HazardTypeLeaf[]
}

/**
 * 把扁平的「大类 + 小类」组合行按大类分组成两级树。
 *
 * 存储层没有父子层级（`hazard_type` 一行一个组合），层级关系只在前端由 `major` 推导：
 * - 保持入参顺序（后端已按 `major, minor, id` 排序），因此同一大类的小类顺序稳定；
 * - 返回全新对象，不与入参共享引用——树组件会往节点上写 `$` 前缀字段，不能污染列表数据；
 * - 节点字段用 `id` / `label` / `expand` / `children`，与 vue3-tree-org 的默认 key 约定一致；
 * - 大类默认展开（`expand: true`），进入页面即可看到全部小类。
 */
export function buildHazardTypeTree(types: HazardType[]): HazardTypeBranch[] {
  const branches = new Map<string, HazardTypeBranch>()
  for (const type of types) {
    const branch = branches.get(type.major) ?? {
      id: `major:${type.major}`,
      label: type.major,
      count: 0,
      expand: true,
      children: [],
    }
    branch.children.push({ id: `type:${type.id}`, label: type.minor, type })
    branch.count = branch.children.length
    branches.set(type.major, branch)
  }
  return [...branches.values()]
}
