import { describe, expect, it } from 'vitest'
import type { FileObject, LedgerTag } from '@/api/generated'
import {
  buildLedgerTagTree,
  collectSubtreeIds,
  formatTagIds,
  initialLedgerFilters,
  isOrphanTag,
  ledgerFiltersFromQuery,
  ledgerQuery,
  parseTagIds,
  tagColumnDisplay,
  tagParentOptions,
  tagPath,
  tagSelectOptions,
} from './ledger'

function tag(id: number, name: string, parentId: number | null, childCount = 0): LedgerTag {
  return {
    id,
    parent_id: parentId,
    name,
    remark: null,
    level: parentId === null ? 1 : 2,
    child_count: childCount,
    images: [] as FileObject[],
    created_at: '2026-09-01T00:00:00+00:00',
    updated_at: '2026-09-01T00:00:00+00:00',
    version: 1,
  }
}

/** 配电柜 / 低压柜 / 抽屉柜 + 高压柜 + 两个孤立标签，父子顺序故意打乱。 */
const tags: LedgerTag[] = [
  tag(3, '抽屉柜', 2),
  tag(1, '配电柜', null, 2),
  tag(6, '临时标签', null),
  tag(2, '低压柜', 1, 1),
  tag(4, '高压柜', 1),
  tag(5, '现场仪表', null),
]

describe('标签 id 串解析与规范化', () => {
  it('空值与非数字项一律丢弃', () => {
    expect(parseTagIds(undefined)).toEqual([])
    expect(parseTagIds('')).toEqual([])
    expect(parseTagIds(' , , ')).toEqual([])
    expect(parseTagIds('3,abc,-1,0,12')).toEqual([3, 12])
  })
  it('去重并升序', () => {
    expect(parseTagIds('12, 3,12,7')).toEqual([3, 7, 12])
    expect(formatTagIds([12, 3, 12, 0, -5])).toBe('3,12')
    expect(formatTagIds([])).toBe('')
  })
  it('URL 恢复与筛选参数序列化互逆', () => {
    const filters = ledgerFiltersFromQuery({ keyword: ' 电机 ', tag_ids: '7,3' })
    expect(filters).toEqual({ keyword: ' 电机 ', tag_ids: [3, 7] })
    expect(ledgerQuery(filters)).toEqual({ keyword: '电机', tag_ids: '3,7' })
    expect(ledgerQuery(initialLedgerFilters())).toEqual({ keyword: undefined, tag_ids: undefined })
  })
})

describe('孤立标签判定与层级路径', () => {
  it('孤立 = 无父且无子；根节点有子标签不算孤立', () => {
    expect(isOrphanTag(tag(6, '临时标签', null))).toBe(true)
    expect(isOrphanTag(tags[2])).toBe(true)
    expect(isOrphanTag(tags[0])).toBe(false)
    expect(isOrphanTag(tags[1])).toBe(false)
  })
  it('路径按层级拼接，父节点缺失时止于当前节点', () => {
    expect(tagPath(tags, tag(3, '抽屉柜', 2))).toBe('配电柜 / 低压柜 / 抽屉柜')
    expect(tagPath(tags, tag(99, '孤儿', 88))).toBe('孤儿')
  })
})

describe('扁平标签 → 横向树', () => {
  it('按层级挂载，同级按 id 升序', () => {
    const forest = buildLedgerTagTree(tags)
    expect(forest.map((node) => node.label)).toEqual(['配电柜', '现场仪表', '临时标签'])
    expect(forest[0]?.children.map((node) => node.label)).toEqual(['低压柜', '高压柜'])
    expect(forest[0]?.children[0]?.children.map((node) => node.label)).toEqual(['抽屉柜'])
    expect(forest[0]?.id).toBe('tag:1')
    expect(forest[0]?.expand).toBe(true)
  })
  it('父节点被筛掉时按根节点处理，不丢节点', () => {
    const forest = buildLedgerTagTree([tag(3, '抽屉柜', 2)])
    expect(forest.map((node) => node.label)).toEqual(['抽屉柜'])
  })
  it('按 scope 本地剪枝：孤立标签与树标签互斥', () => {
    const orphans = buildLedgerTagTree(tags, 'orphan')
    expect(orphans.map((node) => node.label)).toEqual(['现场仪表', '临时标签'])
    const tree = buildLedgerTagTree(tags, 'tree')
    expect(tree.map((node) => node.label)).toEqual(['配电柜'])
    expect(tree[0]?.children.map((node) => node.label)).toEqual(['低压柜', '高压柜'])
  })
  it('不修改入参（树组件会往节点写 $ 前缀字段）', () => {
    const source = structuredClone(tags)
    buildLedgerTagTree(source)
    expect(source).toEqual(tags)
  })
})

describe('标签选择器与列表展示', () => {
  it('选项与树同构，附带完整路径', () => {
    const options = tagSelectOptions(tags)
    expect(options.map((option) => option.key)).toEqual([1, 5, 6])
    expect(options[0]?.children?.map((option) => option.key)).toEqual([2, 4])
    expect(options[0]?.children?.[0]?.children?.[0]?.path).toBe('配电柜 / 低压柜 / 抽屉柜')
  })
  it('标签列最多展示 3 个，其余计数', () => {
    const refs = [1, 2, 3, 4, 5].map((id) => ({ id, name: `t${id}`, path: `p${id}` }))
    expect(tagColumnDisplay(refs)).toEqual({ visible: refs.slice(0, 3), extra: 2 })
    expect(tagColumnDisplay(refs.slice(0, 2))).toEqual({ visible: refs.slice(0, 2), extra: 0 })
  })
  it('上级标签选项把第 3 层节点置灰（不能再挂子标签）', () => {
    const deep = [...tags, { ...tag(7, '抽屉单元', 3), level: 3 }]
    const options = tagParentOptions(deep)
    const level2 = options[0]?.children ?? []
    const level3 = level2[0]?.children ?? []
    expect(level3.map((option) => option.key)).toEqual([3])
    expect(level2[1]?.disabled).toBeUndefined()
    expect(level3[0]?.disabled).toBeUndefined()
    expect(level3[0]?.children?.[0]).toMatchObject({ key: 7, disabled: true })
  })
})

describe('改上级（reparent）辅助', () => {
  it('collectSubtreeIds 返回自身与全部子孙，环状脏数据也能终止', () => {
    expect(collectSubtreeIds(tags, 1)).toEqual([1, 2, 3, 4])
    expect(collectSubtreeIds(tags, 3)).toEqual([3])
    expect(collectSubtreeIds(tags, 99)).toEqual([99])
    // a → b → a：环里两个节点都只出现一次
    const loop = [tag(11, 'a', 12), tag(12, 'b', 11)]
    expect(collectSubtreeIds(loop, 11)).toEqual([11, 12])
  })

  it('传 excludeId 时自身与子孙置灰，兄弟与非本子树节点保持可选', () => {
    const options = tagParentOptions(tags, 2)
    const root = options[0]
    // 配电柜(1) 不是 低压柜(2) 的子孙，仍可作上级
    expect(root?.disabled).toBeUndefined()
    const children = root?.children ?? []
    expect(children[0]).toMatchObject({ key: 2, disabled: true })
    // 低压柜自己的子标签也在禁用集里
    expect(children[0]?.children?.[0]).toMatchObject({ key: 3, disabled: true })
    // 同层兄弟与其它根节点不受影响
    expect(children[1]?.disabled).toBeUndefined()
    expect(options[1]?.disabled).toBeUndefined()
  })

  it('excludeId 为一级标签时整棵子树（含跨级子孙）都置灰', () => {
    const deep = [...tags, { ...tag(7, '抽屉单元', 3), level: 3 }]
    const options = tagParentOptions(deep, 1)
    const root = options.find((option) => option.key === 1)
    expect(root?.disabled).toBe(true)
    expect(root?.children?.[0]?.disabled).toBe(true)
    expect(root?.children?.[0]?.children?.[0]?.disabled).toBe(true)
    expect(root?.children?.[0]?.children?.[0]?.children?.[0]).toMatchObject({
      key: 7,
      disabled: true,
    })
  })
})
