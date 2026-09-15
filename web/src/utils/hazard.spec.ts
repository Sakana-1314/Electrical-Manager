import { describe, expect, it } from 'vitest'
import type { HazardType } from '@/api/generated'
import {
  buildHazardTypeTree,
  hazardQuery,
  hazardStatusTypes,
  initialHazardFilters,
  isHazardOverdue,
  type HazardFilters,
} from './hazard'

function filters(overrides: Partial<HazardFilters> = {}): HazardFilters {
  return { ...initialHazardFilters(), ...overrides }
}

describe('隐患筛选条件 → 查询参数', () => {
  it('空筛选不产生任何参数（不限制）', () => {
    const query = hazardQuery(filters())
    expect(query.status).toBeUndefined()
    expect(query.level).toBeUndefined()
    expect(query.hazard_type_id).toBeUndefined()
    expect(query.hazard_unit_id).toBeUndefined()
    expect(query.area).toBeUndefined()
    expect(query.keyword).toBeUndefined()
    expect(query.date_from).toBeUndefined()
    expect(query.date_to).toBeUndefined()
  })

  it('文本去掉首尾空格，纯空格视为不限', () => {
    expect(hazardQuery(filters({ area: '  选矿厂  ' })).area).toBe('选矿厂')
    expect(hazardQuery(filters({ keyword: '   ' })).keyword).toBeUndefined()
  })

  it('枚举与 id 原样透传', () => {
    const query = hazardQuery(
      filters({ status: '整改受阻', level: '重大隐患', hazard_type_id: 3, hazard_unit_id: 2 }),
    )
    expect(query.status).toBe('整改受阻')
    expect(query.level).toBe('重大隐患')
    expect(query.hazard_type_id).toBe(3)
    expect(query.hazard_unit_id).toBe(2)
  })

  it('整改员工按精确值筛选，未选时不传', () => {
    expect(hazardQuery(filters()).rectify_person).toBeUndefined()
    expect(hazardQuery(filters({ rectify_person: '孙浩宇' })).rectify_person).toBe('孙浩宇')
  })

  it('日期区间按东八区转成 YYYY-MM-DD', () => {
    // 2026-09-01 00:00 (+08:00) 与 2026-09-30 00:00 (+08:00)
    const start = Date.parse('2026-09-01T00:00:00+08:00')
    const end = Date.parse('2026-09-30T00:00:00+08:00')
    const query = hazardQuery(filters({ dateRange: [start, end] }))
    expect(query.date_from).toBe('2026-09-01')
    expect(query.date_to).toBe('2026-09-30')
  })

  it('区间只选了一端时只传已选那一端，不把另一端当成 1970-01-01', () => {
    const start = Date.parse('2026-09-01T00:00:00+08:00')
    // naive-ui 的 daterange 在只点了起点时给的是 [时间戳, null]
    const halfFrom = hazardQuery(
      filters({ dateRange: [start, null] as unknown as [number, number] }),
    )
    expect(halfFrom.date_from).toBe('2026-09-01')
    expect(halfFrom.date_to).toBeUndefined()

    const halfTo = hazardQuery(filters({ dateRange: [null, start] as unknown as [number, number] }))
    expect(halfTo.date_from).toBeUndefined()
    expect(halfTo.date_to).toBe('2026-09-01')
  })
})

describe('逾期判定', () => {
  it('要求完成时间早于今天且未整改才算逾期', () => {
    expect(isHazardOverdue('2026-09-12', '待整改', '2026-09-13')).toBe(true)
    expect(isHazardOverdue('2026-09-12', '整改受阻', '2026-09-13')).toBe(true)
  })

  it('今天到期不算逾期（与后端统计口径一致）', () => {
    expect(isHazardOverdue('2026-09-13', '待整改', '2026-09-13')).toBe(false)
  })

  it('已整改的记录从不标逾期', () => {
    expect(isHazardOverdue('2026-09-01', '已整改', '2026-09-13')).toBe(false)
  })

  it('未来到期不算逾期', () => {
    expect(isHazardOverdue('2026-09-20', '待整改', '2026-09-13')).toBe(false)
  })
})

describe('状态标签配色', () => {
  it('待整改/整改受阻/已整改分别对应 warning/error/success', () => {
    expect(hazardStatusTypes['待整改']).toBe('warning')
    expect(hazardStatusTypes['整改受阻']).toBe('error')
    expect(hazardStatusTypes['已整改']).toBe('success')
  })
})

describe('隐患类型 → 两级横向树', () => {
  const type = (id: number, major: string, minor: string): HazardType =>
    ({
      id,
      major,
      minor,
      created_at: '2026-09-01T00:00:00+08:00',
      updated_at: '2026-09-01T00:00:00+08:00',
      version: 1,
    }) as HazardType

  it('按大类分组，同组小类保持入参顺序（后端已排序）', () => {
    const tree = buildHazardTypeTree([
      type(3, '电气设备', '绝缘破损'),
      type(4, '电气设备', '接线松动'),
      type(5, '安全防护', '护栏缺失'),
    ])
    expect(tree.map((branch) => branch.label)).toEqual(['电气设备', '安全防护'])
    expect(tree[0].children.map((leaf) => leaf.label)).toEqual(['绝缘破损', '接线松动'])
    expect(tree[0].count).toBe(2)
    expect(tree[1].count).toBe(1)
  })

  it('大类节点与叶子节点用互不冲突的唯一 id', () => {
    const tree = buildHazardTypeTree([type(3, '电气设备', '绝缘破损')])
    expect(tree[0].id).toBe('major:电气设备')
    expect(tree[0].children[0].id).toBe('type:3')
  })

  it('叶子保留原始行数据，供编辑与删除使用', () => {
    const row = type(7, '电气设备', '接地不良')
    const tree = buildHazardTypeTree([row])
    expect(tree[0].children[0].type).toEqual(row)
  })

  it('空输入返回空数组（页面据此渲染空状态）', () => {
    expect(buildHazardTypeTree([])).toEqual([])
  })

  it('不与入参共享引用（树组件会往节点写 $ 字段，不能污染列表数据）', () => {
    const rows = [type(3, '电气设备', '绝缘破损')]
    const tree = buildHazardTypeTree(rows)
    expect(tree[0]).not.toBe(rows[0])
    expect(tree[0].children[0]).not.toBe(rows[0])
    // 原始行不被加上树结构字段；其 id 仍是接口返回的数字主键
    expect(rows[0]).not.toHaveProperty('children')
    expect(rows[0].id).toBe(3)
    expect(tree[0].children[0].id).toBe('type:3')
  })
})
