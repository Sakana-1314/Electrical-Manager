import { describe, expect, it } from 'vitest'
import type { RouteLocationRaw } from 'vue-router'
import router from './index'

/**
 * 旧详情链接的兼容重定向。
 *
 * 详情页已全部改为列表页弹窗，原来的 4 条详情路径不能直接 404（历史收藏、其它系统的外链、
 * 浏览器历史都还指向它们）。这里守住「旧路径 → 列表页 + ?detail=<id>」的映射，它是
 * 「移除详情页」这件事唯一对外的兼容承诺。
 *
 * 注意 `router.resolve(path)` **不会**跟随 redirect（返回的是带 redirect 的那条记录本身），
 * 所以这里取匹配到的路由记录并直接调用它的 `redirect` 函数来断言目标。
 */
const cases: Array<[string, string, string]> = [
  ['/warehouse/materials/12', 'stock-materials', '12'],
  ['/warehouse/operations/34', 'operations', '34'],
  ['/procurement/materials/56', 'purchase-materials', '56'],
  ['/procurement/records/78', 'purchase-records', '78'],
]

/** 取出该路径匹配到的最后一条路由记录上的 redirect 结果。 */
function redirectTarget(path: string, id: string): RouteLocationRaw {
  const matched = router.resolve(path).matched
  const record = matched[matched.length - 1] as unknown as {
    redirect?: (to: {
      params: Record<string, string>
      query: Record<string, string>
    }) => RouteLocationRaw
  }
  expect(typeof record.redirect, `${path} 应是重定向路由`).toBe('function')
  return record.redirect!({ params: { id }, query: {} })
}

describe('旧详情链接重定向', () => {
  it.each(cases)('%s → %s 且带 ?detail=%s', (from, name, id) => {
    expect(redirectTarget(from, id)).toEqual({ name, query: { detail: id } })
  })

  it('列表页本身仍可直接访问（重定向不影响正常入口）', () => {
    for (const name of [
      'stock-materials',
      'operations',
      'purchase-materials',
      'purchase-records',
    ]) {
      expect(router.resolve({ name }).name).toBe(name)
    }
  })

  it('旧的详情路由名已不存在（不能再用 name 跳到详情页）', () => {
    // vue-router 对未命中的 name 会抛错，用 hasRoute 判定更直接
    for (const name of [
      'stock-material-detail',
      'operation-detail',
      'purchase-material-detail',
      'purchase-record-detail',
    ]) {
      expect(router.hasRoute(name), `${name} 不应再是路由名`).toBe(false)
    }
  })
})
