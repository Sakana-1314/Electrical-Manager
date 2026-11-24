// @vitest-environment node
/**
 * 浮动标签的接线守卫。
 *
 * 所有输入框 / 下拉 / 多选 / 日期 / 文本域采用浮动标签：未输入且未聚焦时标签在框内，
 * 聚焦或有值后缩小移到框上方并一直显示；空态时控件自带占位层隐藏，避免与标签重影。
 *
 * 值判定不依赖 placeholder 属性，而是看 Naive UI 的占位层是否还存在：
 * - 空输入 / 日期 / 数字输入：`.n-input__placeholder`
 * - 空选择器（含多选）：`.n-base-selection-placeholder`
 * 多控件表单项（数量 + 单位）只要任一控件有值就浮起。
 *
 * 这些规则被删掉、改回只靠 placeholder、或漏掉筛选字段 / 弹窗小尺寸时都不会报错，
 * 只会静默失去浮动效果，所以直接扫源码守住接线约定。纯读文件，node 环境。
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const WEB_ROOT = process.cwd()
const styles = readFileSync(`${WEB_ROOT}/src/styles.css`, 'utf8')

/** 取「浮动标签」区块：从标题注释到「侧栏菜单密度」之前。 */
function floatingSection(): string {
  const marker = '============ 浮动标签'
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

const floating = floatingSection()
const tokens = rootTokens()

describe('浮动标签令牌', () => {
  it('样式表 / 区块 / :root 均已读入（兜底）', () => {
    expect(styles.length).toBeGreaterThan(0)
    expect(floating.length, '未找到「浮动标签」区块').toBeGreaterThan(0)
    expect(tokens.length).toBeGreaterThan(0)
  })

  it('浮动标签令牌已定义', () => {
    for (const token of [
      '--floating-label-size',
      '--floating-label-line-height',
      '--floating-label-inset-x',
      '--floating-label-top',
      '--floating-label-bg',
      '--floating-label-padding-x',
      '--floating-label-inside-size',
      '--floating-label-inside-line-height',
      '--control-height-large',
    ]) {
      expect(tokens, `:root 缺少 ${token}`).toContain(`${token}:`)
    }
  })
})

describe('浮动标签接线', () => {
  it('输入 / 下拉表单项的标签改为绝对定位，未输入时在框内', () => {
    expect(floating).toMatch(
      /\.n-form-item--top-labelled:has\(\.n-input, \.n-base-selection\):not\(\s*\n\s*:has\(\.n-form-item-label \.n-checkbox\)\s*\n\s*\) \{[\s\S]*?position: relative;[\s\S]*?grid-template-rows: 1fr;/,
    )
    expect(floating).toMatch(
      /\.n-form-item-label \{[\s\S]*?position: absolute;[\s\S]*?top: calc\(var\(--floating-field-height\) \/ 2\);[\s\S]*?transform: translateY\(-50%\);/,
    )
  })

  it('聚焦或有值后缩到框线上、断开框线，选择器同时覆盖输入与选择器', () => {
    expect(floating).toContain(':focus-within')
    expect(floating).toContain('.n-base-selection--focus, .n-base-selection--active')
    expect(floating).toMatch(
      /\.n-input__input-el:not\(:placeholder-shown\),\s*\n\s*\.n-input__textarea-el:not\(:placeholder-shown\),\s*\n\s*\.n-base-selection--selected/,
    )
    expect(floating).toMatch(
      /top: var\(--floating-label-top\);[\s\S]*?padding: 0 var\(--floating-label-padding-x\);[\s\S]*?background: var\(--floating-label-bg\);[\s\S]*?font-size: var\(--floating-label-size\);[\s\S]*?transform: translateY\(-50%\);/,
    )
    expect(tokens).toContain('--floating-label-top: 0px;')
  })

  it('空态隐藏控件自带占位层（输入与选择器都覆盖）', () => {
    expect(floating).toMatch(
      /:is\(\.n-input__placeholder, \.n-base-selection-placeholder\) \{\s*\n\s*opacity: 0;/,
    )
    // 只在「未聚焦 + 无值」时隐藏；聚焦或选择器展开时要让占位层回来
    expect(floating).toMatch(
      /:not\(:focus-within\):not\(:has\(\.n-base-selection--focus, \.n-base-selection--active\)\)/,
    )
  })

  it('筛选字段使用同一套浮动标签', () => {
    expect(styles).toMatch(/\.filter-field \{[^}]*position: relative;/)
    expect(styles).toMatch(
      /\.filter-field > span \{[^}]*position: absolute;[\s\S]*?top: calc\(var\(--floating-field-height\) \/ 2\);[\s\S]*?transform: translateY\(-50%\);/,
    )
    expect(floating).toContain('.filter-field:focus-within > span')
    expect(floating).toContain(
      '.filter-field:has(.n-base-selection--focus, .n-base-selection--active) > span',
    )
  })

  it('文本域空态标签贴在首行，不垂直居中', () => {
    expect(floating).toMatch(
      /\.n-form-item--top-labelled:has\(\.n-input__textarea-el:placeholder-shown\)[\s\S]*?top: calc\(var\(--floating-label-inset-x\) - 2px\);/,
    )
    expect(floating).toMatch(
      /\.filter-field:has\(\.n-input__textarea-el:placeholder-shown\)[\s\S]*?top: calc\(var\(--floating-label-inset-x\) - 2px\);/,
    )
  })

  it('非输入类表单项（复选标签 / 开关）保持原标签行', () => {
    expect(floating).toMatch(/\.n-form-item-label \.n-checkbox/)
  })

  it('弹窗小尺寸与登录 large 尺寸各有自己的框内中心', () => {
    expect(floating).toMatch(
      /\.n-card\.n-modal\s*\n\s*\.n-form-item--top-labelled:has\(\.n-input, \.n-base-selection\):not\([\s\S]*?--floating-field-height: var\(--dialog-control-height\);/,
    )
    expect(floating).toMatch(
      /\.login-card\s*\n\s*\.n-form-item--top-labelled:has\(\.n-input, \.n-base-selection\):not\([\s\S]*?--floating-field-height: var\(--control-height-large\);/,
    )
  })
})

describe('页面结构接线', () => {
  it('用户详情表单改用浮动标签（不再左侧标签）', () => {
    const source = readFileSync(`${WEB_ROOT}/src/views/settings/UsersView.vue`, 'utf8')
    expect(source).not.toContain('label-placement="left"')
    expect(source).toContain('<n-form size="small" :show-feedback="false"')
  })

  it('附件筛选改成 filter-field + filter-grid，让标签可以浮起', () => {
    const source = readFileSync(`${WEB_ROOT}/src/views/settings/AttachmentsView.vue`, 'utf8')
    expect(source).toContain('class="filter-grid"')
    expect(source).not.toContain('class="filter-bar"')
    expect(source.match(/class="filter-field"/g)?.length ?? 0).toBe(3)
    expect(source.match(/<span>/g)?.length ?? 0).toBeGreaterThanOrEqual(3)
  })

  it('备忘录标题 / 正文不再只靠 placeholder，改用浮动字段标签', () => {
    const source = readFileSync(`${WEB_ROOT}/src/views/MemosView.vue`, 'utf8')
    expect(source.match(/class="filter-field memo-field"/g)?.length ?? 0).toBe(2)
    expect(source).toContain('<span>标题</span>')
    expect(source).toContain('<span>正文</span>')
  })
})
