// @vitest-environment node
/**
 * 筛选折叠的接线守卫。
 *
 * 折叠完全靠一套全局样式（`styles.css` 的 `.filter-grid.is-collapsed`）：收起时按 DOM
 * 顺序保留前 N 个筛选项（桌面端 6 个、手机端 2 个），没有更多项时「更多筛选」按钮由样式
 * 自动隐藏。页面漏绑 `is-collapsed`、写回旧的分组包裹层、或把某个断点的数量规则写到断点
 * 之外都不会报错，只会静默失效（例如手机上只有 3~6 个筛选项的页面按钮被桌面端规则收掉、
 * 剩下的条件再也点不开），所以这里直接扫源码守住接线约定——与后端「文档/契约一致性测试」
 * 同一思路。纯读文件，因此用 node 环境（jsdom 下 node builtins 不可用）。
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const WEB_ROOT = process.cwd()
const COLLAPSE_BINDING = `<div class="filter-grid" :class="{ 'is-collapsed': !filterExpanded }">`

function vueFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = `${dir}/${entry}`
    if (statSync(path).isDirectory()) return vueFiles(path)
    return path.endsWith('.vue') ? [path] : []
  })
}

const files = vueFiles(`${WEB_ROOT}/src/views`).map((path) => ({
  path,
  source: readFileSync(path, 'utf8'),
}))

const styles = readFileSync(`${WEB_ROOT}/src/styles.css`, 'utf8')

/** 取某个断点区块（区块内规则有缩进，因此以顶格的 `}` 收尾）。 */
function mediaBlock(query: string): string {
  return styles.match(new RegExp(`@media \\(${query}\\) \\{[\\s\\S]*?\\n\\}`))?.[0] ?? ''
}

describe('筛选折叠接线', () => {
  it('视图文件已全部读入（兜底）', () => {
    expect(files.length).toBeGreaterThan(5)
    expect(styles.length).toBeGreaterThan(0)
  })

  it('渲染 FilterExpandButton 的页面都给 .filter-grid 绑了 is-collapsed', () => {
    const collapsible = files.filter((file) => file.source.includes('FilterExpandButton'))
    expect(collapsible.length).toBeGreaterThan(0)

    for (const file of collapsible) {
      expect(file.source, file.path).toContain(COLLAPSE_BINDING)
    }
  })

  it('不再使用旧的 .filter-extras-fields 分组包裹层', () => {
    for (const file of files) {
      expect(file.source, file.path).not.toContain('filter-extras-fields')
    }
  })

  it('筛选网格的直接子元素只有筛选项（折叠按子元素序号计数）', () => {
    const grids = files.filter((file) => file.source.includes('class="filter-grid"'))
    expect(grids.length).toBeGreaterThan(0)

    for (const file of grids) {
      const blocks = [...file.source.matchAll(/<div class="filter-grid"[\s\S]*?\n {6}<\/div>/g)]
      expect(blocks.length, file.path).toBeGreaterThan(0)

      for (const block of blocks) {
        const children = [...block[0].matchAll(/^ {8}<(\w[\w-]*)/gm)].map((match) => match[1])
        expect(children.length, file.path).toBeGreaterThan(0)
        expect(new Set(children), file.path).toEqual(new Set(['label']))
      }
    }
  })

  it('两个断点的数量规则各自限定在断点内，不会互相兜底', () => {
    const desktop = mediaBlock('min-width: 769px')
    expect(desktop).toContain(':nth-child(n + 7)')
    expect(desktop).toContain('.filter-collapse-btn')

    const mobile = mediaBlock('max-width: 768px')
    expect(mobile).toContain(':nth-child(n + 3)')
    expect(mobile).toContain('.filter-collapse-btn')

    // 断点之外不能再出现折叠数量规则：桌面端「不超过 6 个就隐藏按钮」若落到全局，
    // 手机上只有 3~6 个筛选项的页面就再也点不开「更多筛选」。
    const outside = styles.replace(desktop, '').replace(mobile, '')
    expect(outside).not.toContain('.filter-grid.is-collapsed >')
    expect(outside).not.toContain(':has(.filter-grid >')
  })
})
