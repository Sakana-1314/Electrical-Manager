/**
 * 筛选折叠的接线守卫。
 *
 * 折叠完全靠一套全局样式（`styles.css` 的 `.filter-grid.is-collapsed`）：收起时按 DOM
 * 顺序保留前 N 个筛选项（桌面端 6 个、手机端 2 个），没有更多项时「更多筛选」按钮由样式
 * 自动隐藏。页面漏绑 `is-collapsed`、或又写回旧的分组包裹层都不会报错，只会静默失效，
 * 所以这里把源码原文扫一遍守住接线约定（与后端「文档/契约一致性测试」同一思路）。
 */
import { describe, expect, it } from 'vitest'

const COLLAPSE_BINDING = `<div class="filter-grid" :class="{ 'is-collapsed': !filterExpanded }">`

const sources = import.meta.glob('./**/*.vue', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

const files = Object.entries(sources).map(([path, source]) => ({ path, source }))

describe('筛选折叠接线', () => {
  it('视图文件已全部读入（glob 兜底）', () => {
    expect(files.length).toBeGreaterThan(5)
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
})
