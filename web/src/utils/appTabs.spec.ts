// @vitest-environment node
/**
 * 标签页纯逻辑的接线守卫（`utils/appTabs.ts`）。
 *
 * 三个容易回归的点：
 * - 标签必须有上限，否则长开的工位会堆出几十个标签、把 8 个 keep-alive 槽位挤爆；
 * - 关闭当前标签要落到邻居，关最后一个只剩一个标签时不许关；
 * - 同一页面带不同查询参数（详情 / 翻页）不新增标签，只更新那一枚的地址。
 */
import { describe, expect, it } from 'vitest'
import {
  activeKeyAfterClose,
  closeTab,
  evictedKeys,
  MAX_APP_TABS,
  upsertTab,
  type AppTab,
} from './appTabs'

const tab = (key: string, path = `/${key}`): AppTab => ({ key, title: key, path })

describe('标签页上限', () => {
  it('最多 8 枚（与 keep-alive 槽位一致）', () => {
    expect(MAX_APP_TABS).toBe(8)
  })

  it('超过上限按打开顺序淘汰最早的，新标签保留在末尾', () => {
    let tabs: AppTab[] = []
    for (let i = 0; i < MAX_APP_TABS + 2; i += 1) tabs = upsertTab(tabs, tab(`p${i}`))
    expect(tabs).toHaveLength(MAX_APP_TABS)
    expect(tabs.map((item) => item.key)).toEqual(['p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8', 'p9'])
  })

  it('能算出被淘汰的标签，供布局层释放缓存', () => {
    const before = [tab('a'), tab('b'), tab('c')]
    const after = upsertTab(before, tab('d'), 3)
    expect(evictedKeys(before, after)).toEqual(['a'])
  })
})

describe('打开 / 更新标签', () => {
  it('同一页面再打开一次只更新地址，不新增标签、顺序不变', () => {
    const tabs = [tab('a'), tab('b'), tab('c')]
    const next = upsertTab(tabs, { key: 'a', title: '工作台', path: '/a?page=3' })
    expect(next).toHaveLength(3)
    expect(next.map((item) => item.key)).toEqual(['a', 'b', 'c'])
    expect(next[0].path).toBe('/a?page=3')
    expect(next[0].title).toBe('工作台')
  })

  it('不修改传入的数组（避免状态原地变更导致 watch 不触发）', () => {
    const tabs = [tab('a')]
    upsertTab(tabs, tab('b'))
    expect(tabs).toHaveLength(1)
  })
})

describe('关闭标签', () => {
  const tabs = [tab('a'), tab('b'), tab('c')]

  it('关闭非当前标签：当前激活项不变', () => {
    expect(activeKeyAfterClose(tabs, 'a', 'c')).toBe('c')
  })

  it('关闭当前标签：优先右邻居', () => {
    expect(activeKeyAfterClose(tabs, 'b', 'b')).toBe('c')
  })

  it('关闭末尾的当前标签：回落到左邻居', () => {
    expect(activeKeyAfterClose(tabs, 'c', 'c')).toBe('b')
  })

  it('关掉最后一个标签时返回空（调用方据此禁止关闭）', () => {
    expect(activeKeyAfterClose([tab('a')], 'a', 'a')).toBeNull()
  })

  it('移除只按 key 过滤', () => {
    expect(closeTab(tabs, 'b').map((item) => item.key)).toEqual(['a', 'c'])
  })
})
