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

/** 顶部「窄屏 / 矮视口」令牌档位（与弹窗断点同一组条件）。 */
function narrowTokens(): string {
  return (
    styles.match(
      /@media \(max-width: 768px\), \(max-height: 560px\) \{\s*\n\s*:root \{[\s\S]*?\n\s*\}\s*\n\}/,
    )?.[0] ?? ''
  )
}

const dialog = dialogSection()
const narrow = narrowTokens()
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

  it('上下留白上限 72px，且在矮视口里自适应收窄', () => {
    // 固定 72px 会吃掉 144px；极矮视口（如 320×480）里必须给卡片留下 260px 可用高度，
    // 所以是 min() + 保底高度，而不是写死像素。
    expect(dialog).toContain(
      '--dialog-pad-y: min(72px, max(0px, (var(--dialog-avail) - 260px) / 2))',
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

  it('底部按钮尺寸由令牌收紧，且按钮组不换行', () => {
    // 桌面统一规则在「弹窗统一排版」区块；窄屏只改 :root 令牌，不再写第二套按钮规则
    expect(styles).toMatch(
      /\.n-card\.n-modal \.n-card__footer \.n-button,[^{]*\{[^}]*height: var\(--dialog-footer-button-height\);/,
    )
    expect(narrow).toContain('--dialog-footer-button-padding: 0 6px;')
    expect(small).toContain('--dialog-footer-button-height: 26px;')
    expect(small).toContain('--dialog-footer-button-size: 11px;')
    // 压过组件库写在元素上的行内 flex-flow: wrap，否则按钮组会折行
    expect(dialog).toContain('flex-wrap: nowrap !important')
    expect(dialog).toContain('.n-card.n-modal > .n-card__footer .n-space')
    expect(dialog).toContain('.n-card.n-modal > .n-card__footer .modal-footer')
    expect(dialog).toContain('gap: var(--dialog-footer-gap) !important')
    expect(dialog).toContain('flex: none')
  })

  it('页脚间距由令牌提供，且极窄屏不会把上边距重置为 0', () => {
    expect(narrow).toContain('--dialog-footer-padding: 14px 12px 8px;')
    expect(small).toContain('--dialog-footer-padding: 14px 8px 8px;')
    expect(styles).not.toContain('padding: 0 8px 8px')
    // 不能再有写死页脚内边距的规则（只允许 :root 令牌声明）
    expect(styles).not.toMatch(/\.n-card\.n-modal > \.n-card__footer \{[^}]*padding: 14px/)
  })

  it('极窄屏只通过令牌再压一档页脚', () => {
    expect(small).toContain('--dialog-footer-gap: 4px;')
    expect(small).toContain('--dialog-footer-button-padding: 0 4px;')
    // ≤360px 不再单独写 .n-card__footer 规则，避免和统一规则各改各的
    expect(small).not.toContain('.n-card.n-modal > .n-card__footer')
  })
})
