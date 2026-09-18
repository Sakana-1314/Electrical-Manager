import { describe, expect, it } from 'vitest'
import {
  addDays,
  buildDaySlots,
  buildHalfColumns,
  buildTimelineRow,
  clampWorkRange,
  defaultWorkRange,
  formatIdList,
  formatNameList,
  formatRecordRange,
  overviewRowKey,
  parseIdList,
  parseNameList,
  parseStatusList,
  rangeDays,
  recordHalfKeys,
  recordSlotLabel,
  sortParticipantNames,
  weekdayLabel,
  workBarHash,
  workBarPaletteIndex,
  workOverviewFiltersFromQuery,
  workOverviewQuery,
  workRangePresets,
  workTaskFiltersFromQuery,
  workTaskQuery,
  WORK_RANGE_MAX_DAYS,
} from './work'

/** 半日格 key 断言用的最小记录对象。 */
const record = (
  start_date: string,
  start_half: 'AM' | 'PM',
  end_date: string,
  end_half: 'AM' | 'PM',
) => ({ start_date, start_half, end_date, end_half })

describe('日期区间与快捷档', () => {
  it('加减天数不跨时区漂移', () => {
    expect(addDays('2026-09-01', 1)).toBe('2026-09-02')
    expect(addDays('2026-09-30', 1)).toBe('2026-10-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31')
  })

  it('默认区间是本月整月', () => {
    expect(defaultWorkRange('2026-09-13')).toEqual({ start: '2026-09-01', end: '2026-09-30' })
    // 闰年 2 月
    expect(defaultWorkRange('2024-02-10')).toEqual({ start: '2024-02-01', end: '2024-02-29' })
  })

  it('快捷档覆盖今天 / 本周 / 下周 / 本月 / 上月', () => {
    const byLabel = Object.fromEntries(
      workRangePresets.map((preset) => [preset.label, preset.range('2026-09-13')]),
    )
    // 2026-09-13 是周日 → 本周为 09-07（周一）~ 09-13（周日）
    expect(byLabel['今天']).toEqual({ start: '2026-09-13', end: '2026-09-13' })
    expect(byLabel['本周']).toEqual({ start: '2026-09-07', end: '2026-09-13' })
    expect(byLabel['下周']).toEqual({ start: '2026-09-14', end: '2026-09-20' })
    expect(byLabel['本月']).toEqual({ start: '2026-09-01', end: '2026-09-30' })
    expect(byLabel['上月']).toEqual({ start: '2026-08-01', end: '2026-08-31' })
  })

  it('区间天数含端点，超长时保留结束日期收窄开始日期', () => {
    expect(rangeDays({ start: '2026-09-01', end: '2026-09-01' })).toBe(1)
    expect(rangeDays({ start: '2026-09-01', end: '2026-09-30' })).toBe(30)
    expect(clampWorkRange({ start: '2026-09-01', end: '2026-09-30' })).toEqual({
      start: '2026-09-01',
      end: '2026-09-30',
    })
    const clamped = clampWorkRange({ start: '2026-01-01', end: '2026-12-31' })
    expect(rangeDays(clamped)).toBe(WORK_RANGE_MAX_DAYS)
    expect(clamped.end).toBe('2026-12-31')
    // 起止颠倒按同一天处理，避免渲染出空网格
    expect(clampWorkRange({ start: '2026-09-10', end: '2026-09-01' })).toEqual({
      start: '2026-09-01',
      end: '2026-09-01',
    })
  })
})

describe('筛选条件与 URL 互转', () => {
  it('查询参数省略空值', () => {
    const query = workOverviewQuery({
      range: { start: '2026-09-01', end: '2026-09-30' },
      task_ids: [3, 1, 3],
      participants: ['李建军', ' '],
      keyword: '  ',
    })
    expect(query).toEqual({
      start_date: '2026-09-01',
      end_date: '2026-09-30',
      task_ids: '1,3',
      participants: '李建军',
      keyword: undefined,
    })
  })

  it('从 URL 恢复筛选条件，非法项丢弃、缺失区间回落默认本月', () => {
    const filters = workOverviewFiltersFromQuery(
      {
        start_date: '2026-08-01',
        end_date: '2026-08-31',
        task_ids: '2,abc,0',
        participants: '李建军,王海涛',
        keyword: '轴承',
      },
      '2026-09-13',
    )
    expect(filters).toEqual({
      range: { start: '2026-08-01', end: '2026-08-31' },
      task_ids: [2],
      participants: ['李建军', '王海涛'],
      keyword: '轴承',
    })
    const fallback = workOverviewFiltersFromQuery({}, '2026-09-13')
    expect(fallback.range).toEqual({ start: '2026-09-01', end: '2026-09-30' })
  })

  it('任务视图的状态筛选按合法取值过滤', () => {
    const query = workTaskQuery({
      range: { start: '2026-09-01', end: '2026-09-07' },
      statuses: ['进行中', '已完成'],
      keyword: '电机',
    })
    expect(query.status).toBe('进行中,已完成')
    const filters = workTaskFiltersFromQuery(
      { start_date: '2026-09-01', end_date: '2026-09-07', status: '进行中,乱填' },
      '2026-09-13',
    )
    expect(filters.statuses).toEqual(['进行中'])
  })

  it('列表串的解析与格式化互为逆运算', () => {
    expect(parseIdList('3, 12,12,abc,0')).toEqual([3, 12])
    expect(formatIdList([3, 0, 12, 3])).toBe('3,12')
    expect(parseNameList('李建军, 王海涛 ,李建军')).toEqual(['李建军', '王海涛'])
    expect(formatNameList(['李建军', '', '王海涛'])).toBe('李建军,王海涛')
    expect(formatIdList([])).toBeUndefined()
    expect(formatNameList([])).toBeUndefined()
    expect(parseStatusList('进行中')).toEqual(['进行中'])
    expect(parseStatusList(null)).toEqual([])
  })
})

describe('半日格与时间线', () => {
  it('日期表头带星期与周末 / 今天标记', () => {
    const days = buildDaySlots({ start: '2026-09-11', end: '2026-09-14' }, '2026-09-13')
    expect(days.map((day) => [day.date, day.weekday, day.isWeekend, day.isToday])).toEqual([
      ['2026-09-11', '五', false, false],
      ['2026-09-12', '六', true, false],
      ['2026-09-13', '日', true, true],
      ['2026-09-14', '一', false, false],
    ])
    const columns = buildHalfColumns(days)
    expect(columns).toHaveLength(8)
    expect(columns[0]).toMatchObject({ key: '2026-09-11:AM', date: '2026-09-11', half: 'AM' })
    expect(columns[1]).toMatchObject({ key: '2026-09-11:PM', half: 'PM' })
  })

  it('单天的时段判定：全天 / 上午 / 下午', () => {
    expect(recordSlotLabel(record('2026-09-01', 'AM', '2026-09-01', 'PM'), '2026-09-01')).toBe(
      '全天',
    )
    expect(recordSlotLabel(record('2026-09-01', 'AM', '2026-09-01', 'AM'), '2026-09-01')).toBe(
      '上午',
    )
    expect(recordSlotLabel(record('2026-09-01', 'PM', '2026-09-01', 'PM'), '2026-09-01')).toBe(
      '下午',
    )
    expect(recordSlotLabel(record('2026-09-01', 'AM', '2026-09-01', 'PM'), '2026-09-02')).toBeNull()
  })

  it('跨天记录：首日按开始档、末日按结束档、中间全天', () => {
    const cross = record('2026-09-01', 'PM', '2026-09-03', 'AM')
    expect(recordSlotLabel(cross, '2026-09-01')).toBe('下午')
    expect(recordSlotLabel(cross, '2026-09-02')).toBe('全天')
    expect(recordSlotLabel(cross, '2026-09-03')).toBe('上午')
    expect(recordHalfKeys(cross, { start: '2026-09-01', end: '2026-09-10' })).toEqual([
      '2026-09-01:PM',
      '2026-09-02:AM',
      '2026-09-02:PM',
      '2026-09-03:AM',
    ])
    // 查询区间裁剪：只保留落在区间内的半日格
    expect(recordHalfKeys(cross, { start: '2026-09-02', end: '2026-09-02' })).toEqual([
      '2026-09-02:AM',
      '2026-09-02:PM',
    ])
    expect(recordHalfKeys(cross, { start: '2026-09-04', end: '2026-09-05' })).toEqual([])
  })

  it('单日记录只有一格（上午档，无下午）', () => {
    expect(
      recordHalfKeys(record('2026-09-01', 'AM', '2026-09-01', 'AM'), {
        start: '2026-09-01',
        end: '2026-09-01',
      }),
    ).toEqual(['2026-09-01:AM'])
  })

  it('时间线按泳道分层：重叠的色块不叠在一起', () => {
    const columns = buildHalfColumns(
      buildDaySlots({ start: '2026-09-01', end: '2026-09-05' }, '2026-09-13'),
    )
    const items = [
      { id: 1, slots: ['2026-09-01:AM', '2026-09-01:PM', '2026-09-02:AM'] },
      { id: 2, slots: ['2026-09-02:AM', '2026-09-02:PM'] },
      { id: 3, slots: ['2026-09-02:PM', '2026-09-03:AM'] },
      { id: 4, slots: ['2026-09-04:AM'] },
    ]
    const row = buildTimelineRow({
      key: 'task:1',
      label: '1# 回转窑主电机轴承更换',
      meta: '进行中',
      items,
      columns,
      columnsOf: (item) => item.slots,
    })
    expect(row.hiddenCount).toBe(0)
    // 泳道：1 与 2、3 时间上重叠 → 各自分层；3 与 1 相邻不重叠，回到第 0 层
    expect(row.intervals.map((interval) => [interval.item.id, interval.lane])).toEqual([
      [1, 0],
      [2, 1],
      [3, 0],
      [4, 0],
    ])
    // 列下标：09-01 AM 是第 0 列，09-03 AM 是第 4 列
    expect(row.intervals[0]).toMatchObject({ startIndex: 0, endIndex: 2 })
    expect(row.intervals[2]).toMatchObject({ startIndex: 3, endIndex: 4 })
    expect(row.intervals[3]).toMatchObject({ startIndex: 6, endIndex: 6 })
  })

  it('超过泳道上限的色块只计数', () => {
    const columns = buildHalfColumns(
      buildDaySlots({ start: '2026-09-01', end: '2026-09-01' }, '2026-09-13'),
    )
    const items = [
      { id: 1, slots: ['2026-09-01:AM'] },
      { id: 2, slots: ['2026-09-01:AM'] },
      { id: 3, slots: ['2026-09-01:AM'] },
      { id: 4, slots: ['2026-09-01:AM'] },
      { id: 5, slots: ['2026-09-01:AM'] },
    ]
    const row = buildTimelineRow({
      key: 'worker:李建军',
      label: '李建军',
      items,
      columns,
      columnsOf: (item) => item.slots,
    })
    expect(row.intervals.map((interval) => interval.lane)).toEqual([0, 1, 2])
    expect(row.hiddenCount).toBe(2)
  })

  it('区间外的数据不进时间线', () => {
    const columns = buildHalfColumns(
      buildDaySlots({ start: '2026-09-01', end: '2026-09-30' }, '2026-09-13'),
    )
    const row = buildTimelineRow({
      key: 'task:2',
      label: '区间外任务',
      items: [{ id: 1, slots: [] as string[] }],
      columns,
      columnsOf: (item) => item.slots,
    })
    expect(row.intervals).toEqual([])
    expect(row.hiddenCount).toBe(0)
  })
})

describe('展示辅助', () => {
  it('记录区间文案带半天档', () => {
    expect(formatRecordRange(record('2026-09-01', 'AM', '2026-09-03', 'PM'))).toBe(
      '2026/09/01 上午 → 2026/09/03 下午',
    )
    expect(formatRecordRange(record('2026-09-01', 'AM', '2026-09-01', 'PM'))).toBe(
      '2026/09/01 上午 → 2026/09/01 下午',
    )
  })

  it('姓名按中文（拼音）排序，色板索引稳定', () => {
    // 拼音序：陈（chen）< 李（li）< 王（wang）
    expect(sortParticipantNames(['王海涛', '陈志远', '李建军'])).toEqual([
      '陈志远',
      '李建军',
      '王海涛',
    ])
    expect(workBarPaletteIndex(7)).toBe(1)
    expect(workBarPaletteIndex(-7)).toBe(1)
    expect(workBarHash('李建军')).toBe(workBarHash('李建军'))
    expect(workBarPaletteIndex(workBarHash('李建军'))).toBeLessThan(6)
  })

  it('总览行 key 与星期文案', () => {
    expect(overviewRowKey({ record_id: 3, date: '2026-09-01' })).toBe('3:2026-09-01')
    expect(weekdayLabel('2026-09-13')).toBe('周日')
    expect(weekdayLabel('2026-09-14')).toBe('周一')
  })
})
