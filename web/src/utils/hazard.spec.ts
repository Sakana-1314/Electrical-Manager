import { describe, expect, it } from 'vitest'
import {
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
