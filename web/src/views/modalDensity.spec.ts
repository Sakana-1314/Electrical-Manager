// @vitest-environment node
/**
 * 弹窗统一排版的接线守卫。
 *
 * 所有 `preset="card"` 弹窗共用 `:root` 里的 `--dialog-*` 设计令牌
 * （ui-design-guidelines「弹窗统一排版」一节）：标题 16 / 正文与标签 13 /
 * 辅助说明 12，字段行距、标签间距、外框内边距、tabs 与页脚尺寸都只从令牌取值。
 * 表单弹窗与详情弹窗同口径，不再用 `data-detail-modal` 分叉出两套行距；
 * 该标记只用于识别详情弹窗（关闭接线与清单守卫）。
 *
 * 这些规则被删掉、改成字面值、或重新引入 `:not([data-detail-modal])` 分叉都不会报错，
 * 只会静默让弹窗重新各写各的，所以直接扫 `styles.css` 源码守住接线约定
 * ——与 `mobileDialog.spec.ts` 同一思路。纯读文件，node 环境。
 */
import { readFileSync, readdirSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const styles = readFileSync(`${process.cwd()}/src/styles.css`, 'utf8')

/** 取「弹窗统一排版」区块正文：从区块标题注释到下一节「侧栏菜单密度」之前。 */
function dialogSection(): string {
  const marker = '============ 弹窗统一排版'
  const at = styles.indexOf(marker)
  if (at === -1) return ''
  const start = styles.lastIndexOf('/*', at)
  const end = styles.indexOf('/* 侧栏菜单密度', at)
  return end === -1 ? '' : styles.slice(start, end)
}

/** 取顶部 :root 令牌定义（不含深色主题覆盖）。 */
function rootTokens(): string {
  const start = styles.indexOf(':root {')
  const end = styles.indexOf('\n}', start)
  return start === -1 || end === -1 ? '' : styles.slice(start, end + 1)
}

const dialog = dialogSection()
const tokens = rootTokens()

const REQUIRED_TOKENS = [
  '--dialog-title-size',
  '--dialog-title-line-height',
  '--dialog-title-weight',
  '--dialog-body-size',
  '--dialog-body-line-height',
  '--dialog-label-size',
  '--dialog-label-line-height',
  '--dialog-label-gap',
  '--dialog-field-gap',
  '--dialog-section-gap',
  '--dialog-section-title-size',
  '--dialog-section-title-line-height',
  '--dialog-section-title-gap',
  '--dialog-caption-size',
  '--dialog-caption-line-height',
  '--dialog-block-gap',
  '--dialog-block-padding',
  '--dialog-block-radius',
  '--dialog-tab-size',
  '--dialog-tab-gap',
  '--dialog-tab-content-gap',
  '--dialog-footer-gap',
  '--dialog-footer-button-height',
  '--dialog-footer-button-size',
  '--dialog-footer-button-padding',
  '--dialog-header-padding',
  '--dialog-content-padding',
  '--dialog-footer-padding',
  '--dialog-body-max-height',
  '--dialog-scroll-gutter',
]

describe('弹窗设计令牌', () => {
  it('样式表已读入（兜底）', () => {
    expect(styles).toContain('.n-card.n-modal')
    expect(dialog.length, '未找到「弹窗统一排版」区块').toBeGreaterThan(0)
    expect(tokens.length, '未找到 :root 令牌').toBeGreaterThan(0)
  })

  it('所有弹窗令牌都在 :root 定义，且字号层级固定为 16 / 13 / 12', () => {
    for (const token of REQUIRED_TOKENS) {
      expect(tokens, `:root 缺少 ${token}`).toContain(`${token}:`)
    }
    expect(tokens).toContain('--dialog-title-size: 16px;')
    expect(tokens).toContain('--dialog-body-size: 13px;')
    expect(tokens).toContain('--dialog-label-size: 13px;')
    expect(tokens).toContain('--dialog-caption-size: 12px;')
  })

  it('窄屏 / 矮视口与 ≤360px 只通过令牌收紧间距', () => {
    expect(styles).toMatch(
      /@media \(max-width: 768px\), \(max-height: 560px\) \{\s*\n\s*:root \{[\s\S]*?--dialog-field-gap: 16px;[\s\S]*?--dialog-footer-padding: 14px 12px 8px;/,
    )
    expect(styles).toMatch(
      /@media \(max-width: 360px\) \{\s*\n\s*:root \{[\s\S]*?--dialog-footer-button-height: 26px;[\s\S]*?--dialog-footer-button-size: 11px;/,
    )
  })
})

describe('弹窗统一排版接线', () => {
  it('外框（header / content / footer）与标题只引用令牌', () => {
    expect(dialog).toMatch(
      /\.n-card\.n-modal > \.n-card-header \{[^}]*padding: var\(--dialog-header-padding\);/,
    )
    expect(dialog).toMatch(
      /\.n-card\.n-modal > \.n-card-content \{[^}]*padding: var\(--dialog-content-padding\);/,
    )
    expect(dialog).toMatch(
      /\.n-card\.n-modal > \.n-card__footer \{[^}]*padding: var\(--dialog-footer-padding\);/,
    )
    expect(dialog).toMatch(
      /\.n-card\.n-modal > \.n-card-header \.n-card-header__main \{[^}]*font-size: var\(--dialog-title-size\);/,
    )
  })

  it('表单行距 / 标签间距 / 空态占位对所有弹窗统一（不再按 data-detail-modal 分叉）', () => {
    expect(dialog).toMatch(
      /\.n-card\.n-modal \.n-form-item \{[^}]*margin-bottom: var\(--dialog-field-gap\);/,
    )
    expect(dialog).toMatch(/\.n-card\.n-modal \.n-form-item:last-child \{[^}]*margin-bottom: 0;/)
    expect(dialog).toMatch(
      /\.n-card\.n-modal \.n-form-item--top-labelled \.n-form-item-label \{[^}]*padding-bottom: var\(--dialog-label-gap\);/,
    )
    expect(dialog).toMatch(
      /\.n-card\.n-modal \.n-form-item \.n-form-item-feedback-wrapper \{[^}]*min-height: 0;/,
    )
    // 详情弹窗不再走另一套行距
    expect(styles).not.toContain(':not([data-detail-modal])')
  })

  it('tabs / 描述列表 / 表格 / 提示与正文同档', () => {
    expect(dialog).toMatch(
      /\.n-card\.n-modal \.n-tabs-tab \{[^}]*font-size: var\(--dialog-tab-size\);/,
    )
    expect(dialog).toMatch(
      /\.n-card\.n-modal \.n-tabs-tab-pad \{[^}]*width: var\(--dialog-tab-gap\);/,
    )
    expect(dialog).toMatch(
      /\.n-card\.n-modal \.n-tab-pane \{[^}]*padding-top: var\(--dialog-tab-content-gap\);/,
    )
    expect(dialog).toContain('.n-descriptions-table-content')
    expect(dialog).toContain('.n-data-table-td')
    expect(dialog).toMatch(
      /\.n-card\.n-modal \.n-alert \{[^}]*margin-bottom: var\(--dialog-block-gap\);/,
    )
  })

  it('页脚按钮与左右分组只引用令牌', () => {
    expect(dialog).toMatch(
      /\.n-card\.n-modal \.n-card__footer \.n-button,[^{]*\{[^}]*height: var\(--dialog-footer-button-height\);[^}]*font-size: var\(--dialog-footer-button-size\);/,
    )
    expect(dialog).toMatch(/\.modal-footer \{[^}]*gap: var\(--dialog-footer-gap\);/)
    expect(dialog).toMatch(
      /\.modal-footer-left,\s*\n\s*\.modal-footer-right \{[^}]*gap: var\(--dialog-footer-gap\);/,
    )
  })

  it('区块标题 / 辅助说明统一走全局类', () => {
    expect(dialog).toMatch(
      /\.dialog-section-title \{[^}]*font-size: var\(--dialog-section-title-size\);[^}]*font-weight: var\(--dialog-title-weight\);/,
    )
    expect(dialog).toMatch(
      /\.dialog-hint \{[^}]*font-size: var\(--dialog-caption-size\);[^}]*line-height: var\(--dialog-caption-line-height\);/,
    )
  })

  it('弹窗排版区块里不出现字面字号 / 行高（必须走 var())', () => {
    const literals = [...dialog.matchAll(/(?:font-size|line-height):\s*([^;]+);/g)]
      .map((match) => match[1].trim())
      .filter((value) => !value.startsWith('var('))
    expect(literals, `弹窗区块仍有字面排版值：${literals.join(' / ')}`).toEqual([])
  })

  it('preset="card" 组件自己的样式也只用令牌，不写字面字号 / 行高', () => {
    const dir = `${process.cwd()}/src/components`
    const offenders = readdirSync(dir)
      .filter((name) => name.endsWith('.vue'))
      .flatMap((name) => {
        const source = readFileSync(`${dir}/${name}`, 'utf8')
        if (!source.includes('preset="card"')) return []
        const styleBlocks = [...source.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)]
          .map((match) => match[1])
          .join('\n')
        return [...styleBlocks.matchAll(/(?:font-size|line-height):\s*([^;]+);/g)]
          .map((match) => match[1].trim())
          .filter((value) => !value.startsWith('var('))
          .map((value) => `${name}: ${value}`)
      })
    expect(offenders, `弹窗组件仍有字面排版值：${offenders.join(' / ')}`).toEqual([])
  })
})
