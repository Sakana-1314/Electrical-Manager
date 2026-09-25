// @vitest-environment node
/**
 * 移动端「表格占满卡片」的接线守卫。
 *
 * 移动端要求含表格的数据卡片去掉内边距，让表格四边直接占满卡片；屏幕留白（.app-content）
 * 保持不变，桌面端维持原样。这段规则完全靠 `styles.css` 里一条断点规则，一旦被删掉或挪出
 * 断点都不会报错，只会静默回到「表格缩在卡片中间」；另外 `.data-card` 还被「关于」页、
 * 台账标签 / 隐患类型（树）、工作管理（甘特时间线）复用，选择器写宽了会误伤那些页面。
 * 所以这里直接扫源码守住接线约定——与 `mobileDialog.spec.ts` 同一思路，纯读文件。
 *
 * 注意：`naive-ui` 2.x 的内容区类名是**单短横线** `.n-card-content`；写成 BEM 的
 * `.n-card__content` 是空选择器（改这条规则时最容易踩的坑，实测过）。
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const styles = readFileSync(`${process.cwd()}/src/styles.css`, 'utf8')

const RULE = '.data-card:has(.n-data-table) > .n-card-content'

/** 取 `@media (max-width: 768px) {` 那个断点块（区块内规则有缩进，以顶格 `}` 收尾）。 */
function mobileBlock(): string {
  const at = styles.indexOf('@media (max-width: 768px) {')
  if (at === -1) return ''
  const end = styles.indexOf('\n}', at)
  return end === -1 ? '' : styles.slice(at, end + 2)
}

const mobile = mobileBlock()

describe('移动端表格卡片的接线', () => {
  it('样式表已读入（兜底）', () => {
    expect(styles.length).toBeGreaterThan(0)
    expect(mobile.length).toBeGreaterThan(0)
  })

  it('内容区类名必须是 naive-ui 实际产出的 .n-card-content（不是 BEM 的 n-card__content）', () => {
    expect(mobile).toContain(RULE)
    // 单短横线才是真实类名；出现双下划线写法说明又写成了空选择器
    expect(mobile).not.toContain('.data-card:has(.n-data-table) > .n-card__content')
  })

  it('含表格的数据卡片内边距归零', () => {
    expect(mobile).toMatch(
      /\.data-card:has\(\.n-data-table\) > \.n-card-content \{\s*\n\s*padding: 0;/,
    )
  })

  it('只命中「卡片里确实有表格」的情况，不误伤复用 .data-card 的非表格页面', () => {
    // :has(.n-data-table) 是唯一的作用域限定；去掉它会把关于页 / 树 / 甘特时间线一起改掉
    expect(RULE).toContain(':has(.n-data-table)')
    // 佐证限定条件确有必要：这三个 .data-card 页面并没有 n-data-table（树 / 卡片 / 甘特时间线）
    const nonTableCards = [
      'web/src/views/settings/AboutView.vue',
      'web/src/views/ledger/LedgerTagsView.vue',
      'web/src/views/work/WorkWorkersView.vue',
    ]
    for (const relative of nonTableCards) {
      const source = readFileSync(`${process.cwd()}/../${relative}`, 'utf8')
      expect(source, relative).toContain('data-card')
      expect(source, relative).not.toContain('n-data-table')
    }
  })

  it('分页条补回左右内边距，不贴卡片边缘', () => {
    expect(mobile).toMatch(
      /\.data-card:has\(\.n-data-table\) \.pagination-bar \{\s*\n\s*padding-left: 12px;\s*\n\s*padding-right: 12px;/,
    )
  })

  it('卡片裁剪内容，保证内边距归零后四角圆角不被方形背景盖掉', () => {
    // padding 归零后表头（灰底）与行背景直接顶到卡片四角，卡片默认 overflow: visible
    // 不裁剪子元素，圆角就被"盖"成直角（实测过）。必须让卡片裁剪内容。
    expect(mobile).toMatch(/\.data-card:has\(\.n-data-table\) \{\s*\n\s*overflow: hidden;/)
    // 不能用 auto/scroll：那会给卡片再套一层滚动条（表格自己已有横向滚动）
    const rule = mobile.match(/\.data-card:has\(\.n-data-table\) \{[^}]*\}/)?.[0] ?? ''
    expect(rule).not.toContain('overflow: auto')
    expect(rule).not.toContain('overflow: scroll')
    // 圆角本身仍由全局 --radius-card 提供，断言这条 token 还在
    expect(styles).toContain('--radius-card: 14px')
  })

  it('规则落在 ≤768px 断点内，桌面端不受影响', () => {
    const ruleIndex = styles.indexOf(RULE)
    const blockStart = styles.indexOf('@media (max-width: 768px) {')
    expect(ruleIndex).toBeGreaterThan(blockStart)
    // 该断点结束位置之后不应再有这条规则，否则就是漏在断点外
    expect(mobile).toContain(RULE)
  })

  it('屏幕留白保留：不把 .app-content 的内边距一起归零', () => {
    expect(mobile).not.toMatch(/\.app-content\s*\{\s*\n\s*padding:\s*0/)
  })

  it('桌面端不变：不顺手启用历史遗留的 .data-card .n-card__content 规则', () => {
    // 这条 BEM 写法是空选择器（真实类名是单短横线），一直没生效。
    // 若把它改成 .n-card-content 就会以更高特异性压过 naive 默认值，把桌面端上内边距
    // 从 20px 改成 18px —— 那属于本次「桌面端维持不变」之外的改动，必须留在原地。
    expect(styles).toContain('.data-card .n-card__content {')
    // 非移动端块里不得出现会生效的 .data-card .n-card-content
    const desktopPart = styles.slice(0, styles.indexOf('@media (max-width: 768px) {'))
    expect(desktopPart).not.toContain('.data-card .n-card-content')
  })
})
