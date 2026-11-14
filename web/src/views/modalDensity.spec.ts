// @vitest-environment node
/**
 * 弹窗紧凑密度的接线守卫。
 *
 * 全部 preset="card" 弹窗共用一套紧凑密度（ui-design-guidelines「弹窗密度」一节）：
 * 表单行距 14px、页脚按钮 28px/12px，以及 Naive 表单项「空态占位」的压除——
 * Naive 默认给每个表单项预留 24px 校验反馈区（feedbackHeightSmall，空态也占位），
 * top 标签行另有 24px min-height（网格行 + 元素）与 6px 下内边距，行与行之间空态
 * 约 38px 纯空白。这些规则被删掉或改短不会报错，只会静默把行距撑回去，所以直接扫
 * `styles.css` 源码守住接线约定——与 `mobileDialog.spec.ts` 同一思路。纯读文件，node 环境。
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const styles = readFileSync(`${process.cwd()}/src/styles.css`, 'utf8')

describe('弹窗紧凑密度样式接线', () => {
  it('样式表已读入（兜底）', () => {
    expect(styles).toContain('.n-card.n-modal')
  })

  it('表单行距 14px（末行归零）', () => {
    expect(styles).toMatch(/\.n-card\.n-modal \.n-form-item \{[^}]*margin-bottom: 14px;/)
    expect(styles).toMatch(/\.n-card\.n-modal \.n-form-item:last-child \{[^}]*margin-bottom: 0;/)
  })

  it('压掉表单项空态占位（校验反馈区 / top 标签行）', () => {
    expect(styles).toMatch(
      /\.n-card\.n-modal \.n-form-item \.n-form-item-feedback-wrapper \{[^}]*min-height: 0;/,
    )
    expect(styles).toMatch(
      /\.n-card\.n-modal \.n-form-item--top-labelled \{[^}]*grid-template-rows: minmax\(0, auto\) 1fr;/,
    )
    expect(styles).toMatch(
      /\.n-card\.n-modal \.n-form-item--top-labelled \.n-form-item-label \{[^}]*min-height: 0;[^}]*padding-bottom: 2px;/,
    )
  })

  it('页脚按钮统一 28px / 12px', () => {
    expect(styles).toMatch(
      /\.n-card\.n-modal \.n-card__footer \.n-button,[^{]*\{[^}]*height: 28px;[^}]*font-size: 12px;/,
    )
  })
})
