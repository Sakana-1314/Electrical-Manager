// @vitest-environment node
/**
 * 页头 / 详情工具栏按钮排「一排放不下时横向滑动」的接线守卫。
 *
 * 窄屏（≤768px）下按钮排不缩小、不换行，超出部分由本行横向滑动承接。这段规则靠
 * `styles.css` 里两条互相配合的声明，缺一就静默失效（实测过）：
 *
 * 1) `justify-content` 必须是 `flex-start`。用 `flex-end` 时溢出堆在**左端**，而横向滚动
 *    只能滚到 inline-end，左端超出的按钮会永久停在屏幕外——现象就是 320~480px 下
 *    「导出」「批量修改（0）」看不见也点不到。
 * 2) 行内按钮组要按内容宽度占位（`width: max-content`）。只设 `flex: none` 时它仍可能被
 *    压到容器宽度，`scrollWidth === clientWidth`，于是根本没有可滚动区间。
 *
 * 这两条都不会报错，只会让「能滑动」变成「滑不动」，因此扫源码守住接线——与
 * `mobileDialog.spec.ts` / `mobileTableCard.spec.ts` 同一思路，纯读文件。
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const styles = readFileSync(`${process.cwd()}/src/styles.css`, 'utf8')

/** 取 `@media (max-width: 768px) {` 那个断点块（区块内规则有缩进，以顶格 `}` 收尾）。 */
function mobileBlock(): string {
  const at = styles.indexOf('@media (max-width: 768px) {')
  if (at === -1) return ''
  const end = styles.indexOf('\n}', at)
  return end === -1 ? '' : styles.slice(at, end + 2)
}

const mobile = mobileBlock()

describe('按钮排横向滑动的接线', () => {
  it('样式表与断点已读入（兜底）', () => {
    expect(styles.length).toBeGreaterThan(0)
    expect(mobile.length).toBeGreaterThan(0)
  })

  it('页头操作区必须 flex-start，否则左端溢出的按钮永久不可达', () => {
    const rule = mobile.match(/\.page-actions \{[^}]*\}/)?.[0] ?? ''
    expect(rule, '未找到移动端的 .page-actions 规则').toBeTruthy()
    expect(rule).toContain('justify-content: flex-start')
    expect(rule).not.toContain('justify-content: flex-end')
  })

  it('行内按钮组按内容宽度占位，撑出可滚动区间', () => {
    expect(mobile).toMatch(
      /\.page-actions > \.n-space,\s*\n\s*\.detail-toolbar > \.n-space \{\s*\n\s*width: max-content;/,
    )
  })

  it('页头与详情工具栏都开启横向滑动并隐藏滚动条', () => {
    expect(mobile).toMatch(/\.page-actions,\s*\n\s*\.detail-toolbar \{\s*\n\s*overflow-x: auto;/)
    expect(mobile).toContain('scrollbar-width: none')
    // 旧版 iOS 触摸滑动
    expect(mobile).toContain('-webkit-overflow-scrolling: touch')
  })

  it('桌面端不受影响：这些声明只在 ≤768px 断点内', () => {
    const ruleIndex = styles.indexOf('.page-actions,\n  .detail-toolbar {')
    const blockStart = styles.indexOf('@media (max-width: 768px) {')
    expect(ruleIndex).toBeGreaterThan(blockStart)
    expect(mobile).toContain('.page-actions,\n  .detail-toolbar {')
  })
})
