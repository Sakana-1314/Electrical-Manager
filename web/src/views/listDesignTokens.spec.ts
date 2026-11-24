// @vitest-environment node
/**
 * 列表页 / 控件的全局令牌守卫。
 *
 * 列表页的页面间距、卡片、筛选区、表格、分页与控件尺寸统一由 `styles.css` 的
 * `--page-*` / `--list-*` / `--control-*` 令牌决定（ui-design-guidelines「列表页统一排版」）。
 * 页面局部样式不再写 `.filter-heading` / `.filter-actions` / `.filter-action-buttons`
 * 这一套布局，也不写死字号、行高、内边距；含表格的数据卡片在所有视口下都贴边。
 *
 * 这些约定被删掉或改回字面值时不会报错，只会静默回到「每个页面各写一套」的状态，
 * 所以直接扫源码守住接线。纯读文件，node 环境。
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const WEB_ROOT = process.cwd()
const styles = readFileSync(`${WEB_ROOT}/src/styles.css`, 'utf8')

function vueFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = `${dir}/${entry}`
    if (statSync(path).isDirectory()) return vueFiles(path)
    return path.endsWith('.vue') ? [path] : []
  })
}

/** 取顶部 :root 令牌定义（不含深色主题覆盖）。 */
function rootTokens(): string {
  const start = styles.indexOf(':root {')
  const end = styles.indexOf('\n}', start)
  return start === -1 || end === -1 ? '' : styles.slice(start, end + 1)
}

const tokens = rootTokens()

const REQUIRED_TOKENS = [
  '--page-gap',
  '--page-header-min-height',
  '--page-header-gap',
  '--page-header-padding',
  '--page-title-size',
  '--page-title-line-height',
  '--list-card-header-padding',
  '--list-card-content-padding',
  '--list-card-title-size',
  '--list-filter-card-padding',
  '--list-body-size',
  '--list-body-line-height',
  '--list-caption-size',
  '--list-caption-line-height',
  '--list-emphasis-size',
  '--list-cell-title-line-height',
  '--list-cell-gap',
  '--list-inline-gap',
  '--list-panel-heading-gap',
  '--list-filter-heading-gap',
  '--list-filter-count-size',
  '--list-filter-count-line-height',
  '--list-filter-actions-gap',
  '--list-filter-actions-margin',
  '--list-filter-actions-padding',
  '--list-filter-bar-gap',
  '--list-filter-grid-gap',
  '--list-filter-col-min-width',
  '--list-filter-label-gap',
  '--list-filter-label-size',
  '--list-action-button-min-width',
  '--list-table-font-size',
  '--list-table-line-height',
  '--list-table-cell-padding-y',
  '--list-table-cell-padding-x',
  '--list-table-header-font-size',
  '--list-table-header-line-height',
  '--list-table-header-padding-y',
  '--list-table-header-padding-x',
  '--list-table-header-weight',
  '--list-pagination-margin-top',
  '--list-pagination-padding-top',
  '--list-pagination-padding-x',
  '--list-pagination-padding-bottom',
  '--list-tree-node-gap',
  '--list-tree-node-min-width',
  '--list-tree-node-padding',
  '--list-tree-padding',
  '--list-badge-size',
  '--list-badge-line-height',
  '--control-height',
  '--control-font-size',
  '--control-padding-x',
  '--control-width',
  '--control-width-short',
  '--control-width-medium',
  '--control-width-unit',
  '--control-width-unit-small',
  '--control-tag-height',
  '--control-tag-font-size',
  '--control-tag-padding-x',
  '--control-tag-gap',
]

describe('列表页 / 控件令牌', () => {
  it('样式表与 :root 已读入（兜底）', () => {
    expect(styles.length).toBeGreaterThan(0)
    expect(tokens.length).toBeGreaterThan(0)
  })

  it('所有列表页 / 控件令牌都在 :root 定义', () => {
    for (const token of REQUIRED_TOKENS) {
      expect(tokens, `:root 缺少 ${token}`).toContain(`${token}:`)
    }
  })

  it('页面骨架 / 卡片 / 表格只引用令牌', () => {
    expect(styles).toMatch(/\.page \{[^}]*gap: var\(--page-gap\);/)
    expect(styles).toMatch(
      /\.page \{[^}]*font-size: var\(--list-body-size\);[^}]*line-height: var\(--list-body-line-height\);/,
    )
    expect(styles).toMatch(
      /\.page-header \{[^}]*min-height: var\(--page-header-min-height\);[^}]*gap: var\(--page-header-gap\);[^}]*padding: var\(--page-header-padding\);/,
    )
    expect(styles).toMatch(
      /\.page-title \{[^}]*font-size: var\(--page-title-size\);[^}]*line-height: var\(--page-title-line-height\);/,
    )
    expect(styles).toMatch(
      /\.page \.n-card-header \{[^}]*padding: var\(--list-card-header-padding\);/,
    )
    expect(styles).toMatch(
      /\.page \.n-card-content \{[^}]*padding: var\(--list-card-content-padding\);/,
    )
    expect(styles).toMatch(
      /\.n-data-table \.n-data-table-th \{[^}]*padding: var\(--list-table-header-padding-y\) var\(--list-table-header-padding-x\);[^}]*font-size: var\(--list-table-header-font-size\);[^}]*font-weight: var\(--list-table-header-weight\);[^}]*line-height: var\(--list-table-header-line-height\);/,
    )
    expect(styles).toMatch(
      /\.n-data-table \.n-data-table-td \{[^}]*padding: var\(--list-table-cell-padding-y\) var\(--list-table-cell-padding-x\);[^}]*font-size: var\(--list-table-font-size\);[^}]*line-height: var\(--list-table-line-height\);/,
    )
    expect(styles).toMatch(
      /\.n-table > thead > tr > th \{[^}]*padding: var\(--list-table-header-padding-y\) var\(--list-table-header-padding-x\);[^}]*font-size: var\(--list-table-header-font-size\);/,
    )
    expect(styles).toMatch(
      /\.n-table > tbody > tr > td \{[^}]*padding: var\(--list-table-cell-padding-y\) var\(--list-table-cell-padding-x\);[^}]*font-size: var\(--list-table-font-size\);/,
    )
    expect(tokens).toContain('--list-table-header-padding-y: 10px;')
    expect(tokens).toContain('--list-table-cell-padding-y: 8px;')
  })

  it('筛选区布局由全局类统一提供（无卡片容器 / 无标题行）', () => {
    expect(styles).toMatch(/\.filter-card \{[^}]*background: linear-gradient\(/)
    expect(styles).toMatch(
      /\.page \.filter-card > \.n-card-content \{[^}]*padding: var\(--list-filter-card-padding\);/,
    )
    expect(styles).toMatch(
      /\.filter-panel \{[^}]*display: flex;[^}]*--floating-label-bg: var\(--color-surface\);/,
    )
    expect(styles).toMatch(
      /\.filter-actions \{[^}]*margin-top: var\(--list-filter-actions-margin\);[^}]*padding-top: var\(--list-filter-actions-padding\);/,
    )
    expect(styles).toMatch(
      /\.filter-action-buttons \{[^}]*gap: var\(--list-filter-actions-gap\);[^}]*margin-left: auto;/,
    )
    expect(styles).toMatch(
      /\.filter-action-buttons \.n-button \{[^}]*min-width: var\(--list-action-button-min-width\);/,
    )
    expect(styles).toMatch(/\.filter-field \{[^}]*gap: var\(--filter-field-label-gap\);/)
    expect(styles).toMatch(
      /\.filter-field > span \{[^}]*font-size: var\(--list-filter-label-size\);/,
    )
    expect(styles).toMatch(
      /\.filter-count \{[^}]*font-size: var\(--list-filter-count-size\);[^}]*line-height: var\(--list-filter-count-line-height\);/,
    )
    expect(styles).not.toContain('.filter-heading {')
    expect(styles).not.toContain('.filter-title {')
  })

  it('「已启用 N 项」放在操作行左侧且不再用 n-tag / 标题行', () => {
    const files = [...vueFiles(`${WEB_ROOT}/src/views`), ...vueFiles(`${WEB_ROOT}/src/components`)]
    const counted = files.filter((path) =>
      readFileSync(path, 'utf8').includes('已启用 {{ activeFilterCount }}'),
    )
    expect(counted.length).toBeGreaterThan(5)
    for (const path of counted) {
      const source = readFileSync(path, 'utf8')
      expect(source, `${path} 缺少 filter-count`).toContain('class="filter-count"')
      expect(source, `${path} 计数不在操作行`).toMatch(
        /class="(?:filter-actions|selector-search-actions)"/,
      )
      expect(source, `${path} 仍用 n-tag 显示筛选计数`).not.toContain(
        'n-tag v-if="activeFilterCount"',
      )
      expect(source, `${path} 仍有筛选标题`).not.toContain('filter-title')
    }
    const filtered = files.filter((path) => readFileSync(path, 'utf8').includes('filter-panel'))
    expect(filtered.length).toBeGreaterThan(5)
    for (const path of filtered) {
      const source = readFileSync(path, 'utf8')
      expect(source, `${path} 筛选区缺少紧凑 filter-card`).toContain('class="filter-card"')
      expect(source, `${path} 仍在使用 filter-heading`).not.toContain('class="filter-heading"')
    }
  })

  it('输入框 / 下拉框的宽度、高度、字号只引用控件令牌', () => {
    expect(styles).toMatch(
      /\.filter-field \.n-input,\s*\n\.filter-field \.n-select,\s*\n\.filter-field \.n-date-picker,\s*\n\.filter-field \.n-input-number \{[^}]*width: var\(--control-width\);/,
    )
    // 高度 / 字号由全局控件规则统一，不再按页面 / 弹窗 / 登录页尺寸分档
    expect(styles).toMatch(/\.n-input \{[^}]*--n-font-size: var\(--control-font-size\) !important;/)
    expect(styles).toMatch(
      /\.n-input:not\(\.n-input--textarea\),\s*\n\.n-base-selection \{[^}]*--n-height: var\(--control-height\) !important;[^}]*--n-font-size: var\(--control-font-size\) !important;/,
    )
    expect(styles).toMatch(/\.n-input-group \.n-button \{[^}]*height: var\(--control-height\);/)
    // 多选下拉的值标签同样走控件令牌：默认 14px / 24px 挤在 34px 框内太满
    expect(styles).toMatch(
      /\.n-base-selection-tag-wrapper \.n-tag \{[^}]*--n-height: var\(--control-tag-height\) !important;[^}]*--n-font-size: var\(--control-tag-font-size\) !important;/,
    )
    expect(tokens).toContain('--control-tag-height: 20px;')
    expect(tokens).toContain('--control-tag-font-size: 11px;')
  })

  it('分页条只引用列表令牌', () => {
    expect(styles).toMatch(
      /\.pagination-bar \{[^}]*margin-top: var\(--list-pagination-margin-top\);[^}]*padding-top: var\(--list-pagination-padding-top\);/,
    )
  })

  it('列表页不再各自复制筛选区布局样式', () => {
    const selectors = [
      '.filter-card {',
      '.filter-panel {',
      '.filter-actions {',
      '.filter-action-buttons {',
    ]
    for (const path of vueFiles(`${WEB_ROOT}/src/views`)) {
      const source = readFileSync(path, 'utf8')
      const styleBlocks = [...source.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)]
        .map((match) => match[1])
        .join('\n')
      for (const selector of selectors) {
        expect(styleBlocks, `${path} 仍定义 ${selector}`).not.toContain(selector)
      }
    }
  })
})
