/**
 * 表格在移动端的卡片式呈现（接线守卫 + 折叠逻辑单测）。
 *
 * 手机屏幕上宽表只能左右拖，一次看不到几列；`PersistentDataTable` 在 ≤768px 时改用
 * 「一条记录一张卡」的排版（标题取第一列，其余列做「标签 + 值」，操作列放卡片底部）。
 * 桌面端仍用原表格，列宽拖动与横向滚动不变。
 *
 * 这里守住三件事：
 *  1. 接线：PersistentDataTable 必须按移动端断点切到卡片，且仍把 scroll-x 传给表格；
 *  2. 折叠逻辑：标题 / 字段 / 操作列的分拣规则（选择列、无标题列不参与）；
 *  3. 样式：卡片排版只在移动端断点内生效，桌面端表格样式不被改写。
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { DataTableColumns } from 'naive-ui'
import { buildMobileCards } from './mobileCards'

const table = readFileSync(`${process.cwd()}/src/components/PersistentDataTable.vue`, 'utf8')
const styles = readFileSync(`${process.cwd()}/src/styles.css`, 'utf8')

type Row = { id: number; name: string; spec: string; qty: number; action?: string }

const columns = [
  { title: '名称', key: 'name' },
  { title: '型号', key: 'spec' },
  { title: '数量', key: 'qty', render: (row: Row) => `${row.qty} 个` },
  { title: '操作', key: 'action', render: (row: Row) => row.action },
] as unknown as DataTableColumns<Record<string, unknown>>

const rows: Row[] = [
  { id: 1, name: '接触器', spec: 'CJX2', qty: 3 },
  { id: 2, name: '断路器', spec: 'C65N', qty: 0 },
]

describe('移动端表格卡片', () => {
  it('PersistentDataTable 在移动端按断点切到卡片，桌面端仍是表格', () => {
    expect(table).toContain("useMediaQuery('(max-width: 768px)')")
    expect(table).toContain('MobileTableCards')
    // 表格分支仍把 scroll-x 传下去（桌面端宽表依赖它）
    expect(table).toMatch(/scroll-x="scrollX"/)
  })

  it('第一列做标题，其余列做标签 + 值，操作列单独放底部', () => {
    const cards = buildMobileCards(columns, rows as unknown as Record<string, unknown>[], (row) =>
      Number((row as unknown as Row).id),
    )
    expect(cards).toHaveLength(2)
    expect(cards[0]!.key).toBe(1)
    expect(cards[0]!.titleLabel).toBe('名称')
    expect(cards[0]!.title).toBe('接触器')
    expect(cards[0]!.fields.map((field) => field.label)).toEqual(['型号', '数量'])
    expect(cards[0]!.fields[1]!.value).toBe('3 个')
    expect(cards[0]!.actions).toHaveLength(1)
  })

  it('空值显示占位符，选择 / 展开列不参与卡片字段', () => {
    const withSelection = [{ type: 'selection' }, ...columns] as unknown as DataTableColumns<
      Record<string, unknown>
    >
    const cards = buildMobileCards(withSelection, [
      { id: 3, name: '热继电器', spec: '', qty: 1 },
    ] as unknown as Record<string, unknown>[])
    expect(cards[0]!.title).toBe('热继电器')
    expect(cards[0]!.fields.find((field) => field.label === '型号')!.value).toBe('—')
    expect(cards[0]!.fields).toHaveLength(2)
  })

  it('卡片排版只在移动端断点内定义，桌面端表格规则不被改动', () => {
    const cards = readFileSync(`${process.cwd()}/src/components/MobileTableCards.vue`, 'utf8')
    expect(cards).toContain('mobile-table-cards')
    const mobileBlock = styles.match(/@media \(max-width: 768px\) \{[\s\S]*?\n\}/)?.[0] ?? ''
    expect(styles).toMatch(/\.mobile-table-cards \{/)
    // 卡片样式不能写进基础表格选择器里，否则桌面端也会应用
    expect(styles).not.toMatch(/^\.n-data-table \.mobile-card/m)
    // 卡片只在移动端挂载（PersistentDataTable 用 isMobile 切换）
    expect(table).toContain('v-if="isMobile"')
    expect(mobileBlock.length).toBeGreaterThan(0)
  })
})
