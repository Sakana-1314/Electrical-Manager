import { describe, expect, it } from 'vitest'
import {
  initialWorkTaskFilters,
  joinWorkTags,
  splitWorkTags,
  workProgressText,
  workTaskFiltersFromQuery,
  workTaskQuery,
} from './work'

describe('工作管理筛选与标签', () => {
  it('标签串拆分：英文 / 中文逗号、去空白、去重保序', () => {
    expect(splitWorkTags('')).toEqual([])
    expect(splitWorkTags('安全,检修')).toEqual(['安全', '检修'])
    expect(splitWorkTags(' 安全 ，检修,, 安全 ')).toEqual(['安全', '检修'])
  })

  it('标签列表拼成英文逗号字符串', () => {
    expect(joinWorkTags(['安全', ' 检修 ', '安全'])).toBe('安全,检修')
    expect(joinWorkTags([])).toBe('')
  })

  it('筛选条件与查询参数互转', () => {
    const filters = { keyword: '校称', tags: ['安全', '检修'], status: '未完成' as const }
    expect(workTaskQuery(filters)).toEqual({
      keyword: '校称',
      tags: '安全,检修',
      status: '未完成',
    })
    expect(
      workTaskFiltersFromQuery({ keyword: '校称', tags: '安全，检修', status: '未完成' }),
    ).toEqual(filters)
    // 空条件不出现
    expect(workTaskQuery(initialWorkTaskFilters())).toEqual({})
    // 手改 URL 的非法状态就地忽略
    expect(workTaskFiltersFromQuery({ status: '瞎写' }).status).toBeNull()
  })

  it('完成度展示按整数百分比并夹在 0~100', () => {
    expect(workProgressText(0)).toBe('0%')
    expect(workProgressText(99.6)).toBe('100%')
    expect(workProgressText(-5)).toBe('0%')
    expect(workProgressText(150)).toBe('100%')
  })
})
