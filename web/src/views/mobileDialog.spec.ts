// @vitest-environment node
/**
 * 移动端弹窗的接线守卫。
 *
 * 弹窗在手机上的留白、限高、单一滚动与页脚单行，完全靠 `styles.css` 里两条按断点限定的
 * 全局规则（Naive 生成的 `.n-card.n-modal`）；页面不写断点、不加局部样式。这些规则一旦被
 * 挪进/挪出断点、断点顺序被调换（≤360px 必须排在 ≤768px 之后，否则 320px 下被覆盖回大按钮），
 * 或者被后续改动删掉，都不会报错，只会静默失效（弹窗重新贴边、页脚重新折行），所以这里直接
 * 扫源码守住接线约定——与 `filterCollapse.spec.ts` 同一思路。纯读文件，因此用 node 环境。
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const styles = readFileSync(`${process.cwd()}/src/styles.css`, 'utf8')

/** 取某个断点区块（区块内规则有缩进，因此以顶格的 `}` 收尾）。 */
function mediaBlock(query: string): string {
  return styles.match(new RegExp(`@media \\(${query}\\) \\{[\\s\\S]*?\\n\\}`))?.[0] ?? ''
}

const mobile = mediaBlock('max-width: 768px')
const small = mediaBlock('max-width: 360px')

describe('移动端弹窗样式接线', () => {
  it('样式表已读入（兜底）', () => {
    expect(styles.length).toBeGreaterThan(0)
    expect(mobile.length).toBeGreaterThan(0)
    expect(small.length).toBeGreaterThan(0)
  })

  it('手机端弹窗四周留白，且只作用于 preset="card" 弹窗', () => {
    expect(mobile).toContain(':has(> .n-card.n-modal)')
    expect(mobile).toContain('padding: 12px')
  })

  it('手机端弹窗限高在视口内，页脚不会落到屏幕外', () => {
    expect(mobile).toContain('.n-card.n-modal {')
    expect(mobile).toContain('max-height: calc(100vh - 24px)')
    // dvh 跟进手机浏览器地址栏收起/展开，必须给在 vh 之后
    expect(mobile).toContain('max-height: calc(100dvh - 24px)')
  })

  it('手机端只保留内容区一层滚动（内层上限让位）', () => {
    expect(mobile).toContain('.n-card.n-modal > .n-card-content {')
    expect(mobile).toContain('overflow-y: auto')
    expect(mobile).toContain('.n-card.n-modal .n-scrollbar {')
    expect(mobile).toContain('max-height: none !important')
    expect(mobile).toContain('.n-card.n-modal .modal-body {')
  })

  it('手机端底部按钮缩小尺寸与字号', () => {
    expect(mobile).toContain('.n-card.n-modal > .n-card__footer .n-button {')
    expect(mobile).toContain('height: 28px')
    expect(mobile).toContain('font-size: 12px')
  })

  it('手机端按钮组不换行（压过组件库行内 flex-flow: wrap）', () => {
    expect(mobile).toContain('flex-wrap: nowrap !important')
    expect(mobile).toContain('.n-card.n-modal > .n-card__footer .n-space')
    expect(mobile).toContain('.n-card.n-modal > .n-card__footer .modal-footer')
    expect(mobile).toContain('flex: none')
  })

  it('极窄屏再压一档，并排在 768px 断点之后（否则被覆盖）', () => {
    expect(small).toContain('height: 26px')
    expect(small).toContain('font-size: 11px')

    const wideIndex = styles.indexOf('@media (max-width: 768px)')
    const narrowIndex = styles.indexOf('@media (max-width: 360px)')
    expect(wideIndex).toBeGreaterThan(-1)
    expect(narrowIndex).toBeGreaterThan(-1)
    expect(narrowIndex).toBeGreaterThan(wideIndex)
  })
})
