// @vitest-environment node
/**
 * 移动端 / 矮视口弹窗的接线守卫。
 *
 * 弹窗在手机上的留白、限高、单一滚动与页脚单行，完全靠 `styles.css` 里一段带标记的全局规则
 * （Naive 生成的 `.n-card.n-modal`）；页面不写断点、不加局部样式。这段规则一旦被挪出断点、
 * 断点顺序被调换（≤360px 必须排在弹窗规则之后，否则 320px 下被覆盖回大按钮），或者被后续
 * 改动删掉，都不会报错，只会静默失效（弹窗重新贴边、页脚重新折行、甚至按钮被挤出卡片看不见），
 * 所以这里直接扫源码守住接线约定——与 `filterCollapse.spec.ts` 同一思路。纯读文件，用 node 环境。
 *
 * 注意：不能用「第一个 @media (max-width: 768px) 块」来定位——`styles.css` 里还有别的
 * 768px 通用块，而弹窗块本身用的是组合查询 `(max-width: 768px), (max-height: 560px)`。
 * 这里按注释里的区块标题定位，取到弹窗块正文后再断言具体规则。
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const styles = readFileSync(`${process.cwd()}/src/styles.css`, 'utf8')

const MARKER = '============ 移动端 / 矮视口弹窗'

/** 取弹窗区块：从区块标题所在注释开始，到紧随其后那个顶格的 `}` 收尾。 */
function dialogSection(): string {
  const at = styles.indexOf(MARKER)
  if (at === -1) return ''
  const start = styles.lastIndexOf('/*', at)
  const end = styles.indexOf('\n}', at)
  return end === -1 ? '' : styles.slice(start, end + 2)
}

/** 取某个断点区块（区块内规则有缩进，因此以顶格的 `}` 收尾）。 */
function mediaBlock(query: string): string {
  return styles.match(new RegExp(`@media \\(${query}\\) \\{[\\s\\S]*?\\n\\}`))?.[0] ?? ''
}

const dialog = dialogSection()
const small = mediaBlock('max-width: 360px')

describe('移动端弹窗样式接线', () => {
  it('样式表已读入（兜底）', () => {
    expect(styles.length).toBeGreaterThan(0)
    expect(dialog.length, `未找到弹窗区块标记 ${MARKER}`).toBeGreaterThan(0)
    expect(small.length).toBeGreaterThan(0)
  })

  it('留白只作用于 preset="card" 弹窗，且左右为 18px', () => {
    expect(dialog).toContain(':has(> .n-card.n-modal)')
    expect(dialog).toContain('padding: var(--dialog-pad-y) 18px')
  })

  it('上下留白上限 144px，且在矮视口里自适应收窄', () => {
    // 固定 144px 会在矮视口（如手机横屏 844×390、667×375）里把卡片压到 87px，
    // 页脚放不下就被挤出卡片、按钮看不见，所以必须是 min() + 保底高度。
    expect(dialog).toContain(
      '--dialog-pad-y: min(144px, max(0px, (var(--dialog-avail) - 260px) / 2))',
    )
  })

  it('限高与留白同源，保证「卡片 + 上下留白」铺满视口', () => {
    expect(dialog).toContain('--dialog-avail: 100vh')
    expect(dialog).toContain('--dialog-avail: 100dvh')
    expect(dialog).toContain('max-height: calc(var(--dialog-avail) - var(--dialog-pad-y) * 2)')
  })

  it('矮视口也命中（手机横屏宽度 >768px，只按宽度判断会整套失效）', () => {
    expect(dialog).toMatch(/@media \(max-width: 768px\), \(max-height: 560px\)/)
  })

  it('只保留内容区一层滚动（内层上限让位）', () => {
    expect(dialog).toContain('.n-card.n-modal > .n-card-content {')
    expect(dialog).toContain('overflow-y: auto')
    expect(dialog).toContain('.n-card.n-modal .n-scrollbar {')
    expect(dialog).toContain('max-height: none !important')
    expect(dialog).toContain('.n-card.n-modal .modal-body {')
  })

  it('标题行与页脚不参与收缩（否则限高后页脚被压扁、按钮溢出卡片下沿）', () => {
    // 卡片是 flex 纵向容器：不给页脚 flex: none，限高后它会被压到 10~20px，按钮反而被裁切
    expect(dialog).toMatch(
      /\.n-card\.n-modal > \.n-card-header,\s*\n\s*\.n-card\.n-modal > \.n-card__footer \{\s*\n\s*flex: none;/,
    )
  })

  it('底部按钮缩小尺寸与字号，且按钮组不换行', () => {
    expect(dialog).toContain('.n-card.n-modal > .n-card__footer .n-button {')
    expect(dialog).toContain('height: 28px')
    expect(dialog).toContain('font-size: 12px')
    // 压过组件库写在元素上的行内 flex-flow: wrap，否则按钮组会折行
    expect(dialog).toContain('flex-wrap: nowrap !important')
    expect(dialog).toContain('.n-card.n-modal > .n-card__footer .n-space')
    expect(dialog).toContain('.n-card.n-modal > .n-card__footer .modal-footer')
    expect(dialog).toContain('flex: none')
  })

  it('极窄屏再压一档，并排在弹窗规则之后（否则被覆盖）', () => {
    expect(small).toContain('height: 26px')
    expect(small).toContain('font-size: 11px')

    const wideIndex = styles.indexOf(MARKER)
    const narrowIndex = styles.indexOf('@media (max-width: 360px)')
    expect(wideIndex).toBeGreaterThan(-1)
    expect(narrowIndex).toBeGreaterThan(-1)
    expect(narrowIndex).toBeGreaterThan(wideIndex)
  })
})
