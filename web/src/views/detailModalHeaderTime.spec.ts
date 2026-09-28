// @vitest-environment node
/**
 * 详情弹窗标题右侧「最后更新时间」的样式接线守卫。
 *
 * 时间放在 `#header-extra` 槽（标题右侧、关闭按钮左侧），字号与到关闭按钮的间距都由
 * `styles.css` 的 `.card-header-time` 一条全局规则决定。间距尤其容易静默丢：组件库只给
 * 关闭按钮 8px 左外边距（`.n-card-header__close { margin: 0 0 0 8px }`），12px 的时间贴上去
 * 会挤在一起；删掉这里的 `margin-right` 不会报任何错，只会在界面上重新贴紧。
 *
 * 纯读文件，因此用 node 环境（与 mobileDialog.spec.ts / detailModalClose.spec.ts 同一思路）。
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const WEB_ROOT = process.cwd()
const styles = readFileSync(`${WEB_ROOT}/src/styles.css`, 'utf8')
const rule = styles.match(/\.card-header-time \{[^}]*\}/)?.[0] ?? ''

/** 用「最后更新时间」的详情弹窗（相对 `web/src`）。 */
const HEADER_TIME_FILES = [
  'components/StockMaterialFormModal.vue',
  'views/procurement/PurchaseMaterialsView.vue',
  'views/procurement/PurchaseRequestsView.vue',
]

describe('详情弹窗标题右侧的更新时间', () => {
  it('字号比正文小一档，且不加 nowrap（窄屏靠换行让位）', () => {
    expect(rule, 'styles.css 里未找到 .card-header-time 规则').not.toBe('')
    expect(rule).toMatch(/font-size:\s*12px/)
    expect(rule).not.toContain('nowrap')
  })

  it('与关闭按钮之间留出间距（组件库的 8px 之外再补 8px）', () => {
    expect(rule).toMatch(/margin-right:\s*8px/)
  })

  it('三个详情弹窗都通过 #header-extra 槽显示时间', () => {
    for (const relative of HEADER_TIME_FILES) {
      const source = readFileSync(`${WEB_ROOT}/src/${relative}`, 'utf8')
      expect(source, `${relative} 缺少 #header-extra 槽`).toContain('#header-extra')
      expect(source, `${relative} 未用 .card-header-time`).toContain('class="card-header-time"')
    }
  })
})
