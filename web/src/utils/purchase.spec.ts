import { beforeEach, describe, expect, it } from 'vitest'
import {
  defaultPurchaseOrderNo,
  getLastPurchaseResponsible,
  mergeExportColumns,
  rememberPurchaseResponsible,
} from './purchase'

describe('默认申购单号', () => {
  beforeEach(() => localStorage.clear())

  it('按上海时区生成日期编号', () => {
    expect(defaultPurchaseOrderNo(new Date('2026-07-16T16:30:05Z'))).toBe('申购 2026/7/17')
  })

  it('记住最后一次新增使用的实际需求人', () => {
    rememberPurchaseResponsible('  李工  ')

    expect(getLastPurchaseResponsible()).toBe('李工')
  })

  it('不使用空值覆盖已记住的实际需求人', () => {
    rememberPurchaseResponsible('王工')
    rememberPurchaseResponsible('   ')

    expect(getLastPurchaseResponsible()).toBe('王工')
  })
})

describe('mergeExportColumns 导出列合并规则', () => {
  const ORDER = ['name', 'planned_qty', 'unit_name', 'usage']

  it('勾了合并列（planned_qty）时自动补上计量单位，且保持原列顺序', () => {
    // 列表只显示一列「数量」，导出要仍是「计划数量、计量单位」相邻两列
    expect(mergeExportColumns(['name', 'planned_qty'], ORDER)).toEqual([
      'name',
      'planned_qty',
      'unit_name',
    ])
  })

  it('未勾合并列时原样按列顺序输出，不擅自补列', () => {
    expect(mergeExportColumns(['name', 'usage'], ORDER)).toEqual(['name', 'usage'])
    expect(mergeExportColumns(['unit_name'], ORDER)).toEqual(['unit_name'])
  })

  it('全部勾选时输出完整列顺序', () => {
    expect(mergeExportColumns(ORDER, ORDER)).toEqual(ORDER)
  })

  it('空选择返回空数组（调用方据此提示「请至少显示一个字段」）', () => {
    expect(mergeExportColumns([], ORDER)).toEqual([])
  })
})
