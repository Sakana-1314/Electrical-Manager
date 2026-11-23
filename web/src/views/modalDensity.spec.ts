// @vitest-environment node
/**
 * 弹窗密度的接线守卫。
 *
 * preset="card" 弹窗分两档（ui-design-guidelines「弹窗密度」一节）：
 * - 表单类弹窗：紧凑密度——表单行距 14px、页脚按钮 28px/12px，并压除 Naive 表单项
 *   「空态占位」（默认每行预留 24px 校验反馈区、top 标签行另有 24px min-height 与
 *   6px 下内边距，空态约 38px 纯空白）；
 * - 详情弹窗（`data-detail-modal`）：以阅读为主，**不压空态占位**，保留 Naive 默认的
 *   24px 标签行高与反馈区，行高 / 行距回到宽松口径（2026-11-23 用户反馈过挤）。
 *
 * 这些规则被删掉、漏掉 `:not([data-detail-modal])` 限定或改短都不会报错，只会静默
 * 改变行距，所以直接扫 `styles.css` 源码守住接线约定——与 `mobileDialog.spec.ts`
 * 同一思路。纯读文件，node 环境。
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const styles = readFileSync(`${process.cwd()}/src/styles.css`, 'utf8')

describe('弹窗密度样式接线', () => {
  it('样式表已读入（兜底）', () => {
    expect(styles).toContain('.n-card.n-modal')
  })

  it('表单行距 14px（末行归零，两档弹窗共用）', () => {
    expect(styles).toMatch(/\.n-card\.n-modal \.n-form-item \{[^}]*margin-bottom: 14px;/)
    expect(styles).toMatch(/\.n-card\.n-modal \.n-form-item:last-child \{[^}]*margin-bottom: 0;/)
  })

  it('表单类弹窗压掉空态占位（校验反馈区 / top 标签行），且用 :not 排除详情弹窗', () => {
    // 没有 `:not([data-detail-modal])` 就会连详情弹窗一起压，正是「详情弹窗变挤」的回归
    expect(styles).not.toMatch(
      /^\.n-card\.n-modal \.n-form-item \.n-form-item-feedback-wrapper \{/m,
    )
    expect(styles).toMatch(
      /\.n-card\.n-modal:not\(\[data-detail-modal\]\) \.n-form-item \.n-form-item-feedback-wrapper \{[^}]*min-height: 0;/,
    )
    expect(styles).toMatch(
      /\.n-card\.n-modal:not\(\[data-detail-modal\]\) \.n-form-item--top-labelled \{[^}]*grid-template-rows: minmax\(0, auto\) 1fr;/,
    )
    expect(styles).toMatch(
      /\.n-card\.n-modal:not\(\[data-detail-modal\]\) \.n-form-item--top-labelled \.n-form-item-label \{[^}]*min-height: 0;[^}]*padding-bottom: 2px;/,
    )
  })

  it('详情弹窗不覆盖 Naive 的标签行高 / 反馈区（保持宽松）', () => {
    // 详情弹窗只允许通过 :not 被排除；任何直接命中的收紧规则都算回归
    const detailRules = [
      ...styles.matchAll(
        /\.n-card\.n-modal(?!:not\(\[data-detail-modal\]\))[^{]*\.n-form-item[^{]*\{[^}]*\}/g,
      ),
    ].map((match) => match[0])
    for (const rule of detailRules) {
      expect(rule, `详情弹窗命中了收紧规则：${rule}`).not.toMatch(/min-height: 0;/)
      expect(rule, `详情弹窗命中了收紧规则：${rule}`).not.toMatch(/padding-bottom: 2px;/)
    }
  })

  it('页脚按钮统一 28px / 12px', () => {
    expect(styles).toMatch(
      /\.n-card\.n-modal \.n-card__footer \.n-button,[^{]*\{[^}]*height: 28px;[^}]*font-size: 12px;/,
    )
  })
})
