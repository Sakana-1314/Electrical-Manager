import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import WorkTimelineGrid from './WorkTimelineGrid.vue'
import type { WorkRecord } from '@/api/generated'
import {
  buildDaySlots,
  buildHalfColumns,
  buildTimelineRow,
  recordHalfKeys,
  type WorkTimelineRow,
} from '@/utils/work'

const RANGE = { start: '2026-09-01', end: '2026-09-03' }
const COLUMNS = buildHalfColumns(buildDaySlots(RANGE, '2026-09-02'))

function record(
  id: number,
  start: string,
  startHalf: 'AM' | 'PM',
  end: string,
  endHalf: 'AM' | 'PM',
) {
  return {
    id,
    task_id: 1,
    task_name: '1# 回转窑主电机轴承更换',
    task_status: '进行中',
    start_date: start,
    start_half: startHalf,
    end_date: end,
    end_half: endHalf,
    participants: ['李建军'],
    remark: null,
    created_at: '2026-09-01T00:00:00+00:00',
    updated_at: '2026-09-01T00:00:00+00:00',
    version: 1,
  } as WorkRecord
}

function row(items: WorkRecord[], key = 'task:1', label = '1# 回转窑主电机轴承更换') {
  return buildTimelineRow<WorkRecord>({
    key,
    label,
    meta: `${items.length} 段`,
    items,
    columns: COLUMNS,
    columnsOf: (item) => recordHalfKeys(item, RANGE),
  })
}

function mountGrid(
  rows: WorkTimelineRow<WorkRecord>[],
  loading = false,
  attrs: Record<string, unknown> = {},
) {
  return mount(WorkTimelineGrid, {
    attrs,
    props: {
      labelTitle: '任务',
      days: buildDaySlots(RANGE, '2026-09-02'),
      columns: COLUMNS,
      rows,
      loading,
      emptyText: '暂无数据',
      labelOf: (item: WorkRecord) => item.participants.join('、'),
      titleOf: (item: WorkRecord) => `${item.task_name}｜${item.start_date}`,
      colorOf: (item: WorkRecord) => item.task_id % 6,
    },
  })
}

describe('WorkTimelineGrid', () => {
  it('渲染表头（日期 + 上午 / 下午）与每行的色块', () => {
    const wrapper = mountGrid([
      row([record(1, '2026-09-01', 'AM', '2026-09-02', 'AM')]),
      row([record(2, '2026-09-02', 'PM', '2026-09-03', 'PM')], 'task:2', '2# 除尘风机检修'),
    ])

    // 3 天 → 6 个半天列；表头每天一格、每半天一格
    expect(wrapper.findAll('.timeline-day')).toHaveLength(3)
    expect(wrapper.findAll('.timeline-half')).toHaveLength(6)
    expect(wrapper.findAll('.timeline-row')).toHaveLength(2)
    expect(wrapper.findAll('.timeline-cell')).toHaveLength(12)
    expect(wrapper.findAll('.timeline-bar')).toHaveLength(2)
    expect(wrapper.find('.timeline-bar').text()).toBe('李建军')
    // 跨列：09-01 AM ~ 09-02 AM 占 3 个半天格（下标 0..2 → 网格列 2..5）
    expect(wrapper.find('.timeline-bar').attributes('style')).toContain('grid-column: 2 / 5')
    expect(wrapper.text()).toContain('2# 除尘风机检修')
  })

  it('点色块抛出 selectInterval，带着原始记录', async () => {
    const first = record(1, '2026-09-01', 'AM', '2026-09-01', 'PM')
    // 色块外面套了 n-tooltip：事件监听用 spy 直接挂在组件上，避免依赖 VTU 的事件簿记
    const onSelect = vi.fn()
    const wrapper = mountGrid([row([first])], false, { onSelectInterval: onSelect })

    await wrapper.find('.timeline-bar').trigger('click')

    expect(onSelect).toHaveBeenCalledTimes(1)
    expect((onSelect.mock.calls[0]![0] as WorkRecord).id).toBe(first.id)
  })

  it('超出泳道上限时只在行尾提示数量', () => {
    const items = [
      record(1, '2026-09-02', 'AM', '2026-09-02', 'AM'),
      record(2, '2026-09-02', 'AM', '2026-09-02', 'AM'),
      record(3, '2026-09-02', 'AM', '2026-09-02', 'AM'),
      record(4, '2026-09-02', 'AM', '2026-09-02', 'AM'),
    ]
    const wrapper = mountGrid([row(items)])

    expect(wrapper.findAll('.timeline-bar')).toHaveLength(3)
    expect(wrapper.find('.timeline-label__more').text()).toBe('+1')
  })

  it('无数据时显示空态、有数据时不显示', async () => {
    const empty = mountGrid([])
    expect(empty.find('.timeline-empty').exists()).toBe(true)
    expect(empty.find('.timeline-scroll').exists()).toBe(false)

    await empty.setProps({ rows: [row([record(1, '2026-09-01', 'AM', '2026-09-01', 'AM')])] })
    expect(empty.find('.timeline-empty').exists()).toBe(false)
    expect(empty.find('.timeline-scroll').exists()).toBe(true)
  })
})
