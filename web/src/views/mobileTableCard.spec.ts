// @vitest-environment node
/**
 * 「表格占满卡片」的接线守卫。
 *
 * 所有视口下，含表格的数据卡片都不做内容区内边距，让表格四边直接贴着卡片；屏幕留白
 * （`.app-content` 的左右内边距）保持不变。这段规则完全靠 `styles.css` 的全局选择器，
 * 一旦被删掉、写回断点内或改成 BEM 空选择器都不会报错，只会静默回到「表格缩在卡片中间」。
 * 另外 `.data-card` 还被「关于」页、台账标签 / 隐患类型（树）、工作管理（甘特时间线）复用，
 * 选择器写宽了会误伤那些页面，所以这里直接扫源码守住接线约定。
 *
 * 注意：`naive-ui` 2.x 的内容区类名是**单短横线** `.n-card-content`；写成 BEM 的
 * `.n-card__content` 是空选择器（改这条规则时最容易踩的坑，实测过）。
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const styles = readFileSync(`${process.cwd()}/src/styles.css`, 'utf8')

const RULE = '.data-card:has(.n-data-table) > .n-card-content'

/** 取全局（非断点内）规则正文：截到第一个 `@media` 之前。 */
const globalPart = styles.slice(0, styles.indexOf('\n@media (max-width: 900px)'))

describe('表格卡片贴边的接线', () => {
  it('样式表已读入（兜底）', () => {
    expect(styles.length).toBeGreaterThan(0)
    expect(globalPart.length).toBeGreaterThan(0)
  })

  it('内容区类名必须是 naive-ui 实际产出的 .n-card-content（不是 BEM 的 n-card__content）', () => {
    expect(globalPart).toContain(RULE)
    expect(globalPart).not.toContain('.data-card:has(.n-data-table) > .n-card__content')
  })

  it('所有视口下含表格的数据卡片内边距归零', () => {
    expect(globalPart).toMatch(
      /\.data-card:has\(\.n-data-table\) > \.n-card-content \{\s*\n\s*padding: 0;/,
    )
    // 不能再落回移动端断点里：桌面端也要贴边
    const mobile = styles.match(/@media \(max-width: 768px\) \{[\s\S]*?\n\}/)?.[0] ?? ''
    expect(mobile).not.toContain(RULE)
  })

  it('只命中「卡片里确实有表格」的情况，不误伤复用 .data-card 的非表格页面', () => {
    expect(RULE).toContain(':has(.n-data-table)')
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

  it('手机端边框只留一层：外层 data-card 去掉边框与阴影，记录卡片保留白底与边框', () => {
    const rule = styles.match(/\.data-card:has\(\.mobile-table-cards\) \{[^}]*\}/)?.[0] ?? ''
    expect(rule, '未找到手机端外层 data-card 的覆盖规则').not.toBe('')
    expect(rule).toMatch(/border: 0;/)
    expect(rule).toMatch(/box-shadow: none;/)
    // 内容仍是白底：外层不能被改成透明背景
    expect(rule).not.toContain('background')
    // 必须限定在 ≤768px 断点内（桌面端仍保留外层卡片边框）
    const ruleIndex = styles.indexOf('.data-card:has(.mobile-table-cards)')
    const mediaIndex = styles.lastIndexOf('@media', ruleIndex)
    expect(styles.slice(mediaIndex, ruleIndex)).toContain('max-width: 768px')
    // 记录卡片自己那层边框和白底仍然保留
    expect(globalPart).toMatch(/\.mobile-card \{[^}]*border: 1px solid var\(--color-border-subtle\);/)
    expect(globalPart).toMatch(/\.mobile-card \{[^}]*background: var\(--color-surface\);/)
  })

  it('分页条补回左右 / 下内边距，不贴卡片边缘', () => {
    expect(globalPart).toMatch(
      /\.data-card:has\(\.n-data-table\) \.pagination-bar \{[^}]*padding-right: var\(--list-pagination-padding-x\);[^}]*padding-bottom: var\(--list-pagination-padding-bottom\);[^}]*padding-left: var\(--list-pagination-padding-x\);/,
    )
  })

  it('卡片裁剪内容，保证内边距归零后四角圆角不被方形背景盖掉', () => {
    expect(globalPart).toMatch(/\.data-card:has\(\.n-data-table\) \{\s*\n\s*overflow: hidden;/)
    // 不能用 auto/scroll：那会给卡片再套一层滚动条（表格自己已有横向滚动）
    const rule = globalPart.match(/\.data-card:has\(\.n-data-table\) \{[^}]*\}/)?.[0] ?? ''
    expect(rule).not.toContain('overflow: auto')
    expect(rule).not.toContain('overflow: scroll')
    expect(styles).toContain('--radius-card: 12px')
  })

  it('屏幕留白保留：不把 .app-content 的内边距一起归零', () => {
    expect(globalPart).not.toMatch(/\.app-content\s*\{\s*\n\s*padding:\s*0/)
  })

  it('不再保留历史遗留的 .data-card .n-card__content 空选择器', () => {
    expect(styles).not.toContain('.data-card .n-card__content {')
  })
})
