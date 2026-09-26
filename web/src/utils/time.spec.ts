import { describe, expect, it } from 'vitest'
import { dateToTimestamp, formatDate, formatElapsed, toShanghaiDate } from './time'

describe('日期工具', () => {
  it('空日期返回 null，不回落到今天（可选日期必须保持留空）', () => {
    expect(dateToTimestamp(null)).toBeNull()
    expect(dateToTimestamp(undefined)).toBeNull()
    expect(dateToTimestamp('')).toBeNull()
  })

  it('日期字符串解析为东八区当日零点时间戳', () => {
    expect(dateToTimestamp('2026-07-19')).toBe(Date.parse('2026-07-19T00:00:00+08:00'))
  })

  it('时间戳与日期字符串双向一致', () => {
    const timestamp = dateToTimestamp('2026-07-19') as number
    expect(toShanghaiDate(timestamp)).toBe('2026-07-19')
  })

  it('展示空日期为占位符', () => {
    expect(formatDate('')).toBe('—')
    expect(formatDate(undefined)).toBe('—')
    expect(formatDate('2026-07-19')).toBe('2026/07/19')
  })
})

describe('耗时格式化', () => {
  it('不足 1 分钟显示秒', () => {
    expect(formatElapsed(0)).toBe('0秒')
    expect(formatElapsed(999)).toBe('0秒')
    expect(formatElapsed(1000)).toBe('1秒')
    expect(formatElapsed(59_000)).toBe('59秒')
  })

  it('满 1 分钟显示分秒，秒补零让宽度稳定', () => {
    expect(formatElapsed(60_000)).toBe('1分00秒')
    expect(formatElapsed(65_000)).toBe('1分05秒')
    expect(formatElapsed(30 * 60_000)).toBe('30分00秒')
  })

  it('满 1 小时显示小时分', () => {
    expect(formatElapsed(3_600_000)).toBe('1小时00分')
    expect(formatElapsed(3_930_000)).toBe('1小时05分')
  })

  it('向下取整且负数兜底为 0（时钟回拨也不显示负数）', () => {
    expect(formatElapsed(1999)).toBe('1秒')
    expect(formatElapsed(-5000)).toBe('0秒')
  })
})
