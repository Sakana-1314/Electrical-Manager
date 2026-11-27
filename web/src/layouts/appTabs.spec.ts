// @vitest-environment node
/**
 * 顶部标签页的接线守卫。
 *
 * 三项约定都不会在运行时报错，只会在不知不觉中退回到旧行为，所以直接扫源码守住：
 * - 标签等宽：宽度必须由「8 个中文字宽」的令牌算出，不能写成随内容变化或各标签不同的值；
 * - 标签页均走 keep-alive，切标签不重新挂载（不重新请求数据）；
 * - 关闭标签 / 淘汰时要换实例代号，下次打开是干净实例。
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const WEB_ROOT = process.cwd()
const read = (path: string) => readFileSync(`${WEB_ROOT}/${path}`, 'utf8')

const tabsComponent = read('src/layouts/AppTabs.vue')
const layout = read('src/layouts/AppLayout.vue')
const composable = read('src/composables/useAppTabs.ts')
const router = read('src/router/index.ts')

describe('标签等宽（8 个中文字宽）', () => {
  it('宽度由 --app-tab-text-width（8em）加固定装饰宽度算出', () => {
    expect(tabsComponent).toContain('--app-tab-text-width: 8em;')
    expect(tabsComponent).toMatch(
      /width: calc\(var\(--app-tab-text-width\) \+ var\(--app-tab-decoration-width\)\);/,
    )
  })

  it('标签不允许被内容撑宽（flex: none + 标题省略号）', () => {
    expect(tabsComponent).toMatch(
      /\.app-tab \{[^}]*flex: none;[^}]*width: calc\(var\(--app-tab-text-width\)/,
    )
    expect(tabsComponent).toMatch(
      /\.app-tab-label \{[^}]*overflow: hidden;[^}]*text-overflow: ellipsis;[^}]*white-space: nowrap;/,
    )
  })
})

describe('切标签不重新加载数据', () => {
  it('布局层对标签页统一套 keep-alive，上限与标签数一致', () => {
    expect(layout).toMatch(/<keep-alive :max="MAX_APP_TABS">/)
    expect(layout).toContain('v-if="isTabPage(currentRoute)"')
    expect(layout).toContain(':key="tabCacheKey(String(currentRoute.name))"')
  })

  it('缓存键带实例代号：关闭 / 淘汰后重开是新实例', () => {
    expect(composable).toMatch(/return `\$\{key\}#\$\{tokens\.value\[key\] \?\? 0\}`/)
    expect(composable).toContain('function invalidate(')
    expect(composable).toMatch(/closeAppTab[\s\S]*?invalidate\(key\)/)
  })

  it('标签上限 8，与 keep-alive 槽位一致', () => {
    expect(read('src/utils/appTabs.ts')).toContain('export const MAX_APP_TABS = 8')
  })
})

describe('标签页批量操作', () => {
  it('首个标签前有「⋯」菜单，支持关闭其他 / 关闭所有', () => {
    expect(tabsComponent).toContain("label: '关闭其他标签页'")
    expect(tabsComponent).toContain("label: '关闭所有标签页'")
    expect(tabsComponent).toMatch(/class="app-tabs-more"/)
    // 菜单位于第一个标签之前
    expect(tabsComponent.indexOf('app-tabs-more')).toBeLessThan(
      tabsComponent.indexOf('v-for="tab in tabs"'),
    )
    expect(composable).toContain('export function closeOtherTabs()')
    expect(composable).toContain('export function closeAllTabs(router: Router)')
  })

  it('关闭所有后当前页仍是标签页时回落地页，导航条不会空掉', () => {
    expect(composable).toMatch(/closeAllTabs[\s\S]*?router\.replace\('\/'\)/)
  })
})

describe('左侧分组手风琴', () => {
  it('菜单受控 expanded-keys，分组同时只展开一个', () => {
    expect(layout).toContain(':expanded-keys="expandedKeys"')
    expect(layout).toContain('@update:expanded-keys="onUpdateExpandedKeys"')
    expect(layout).toContain('accordionExpandedKeys')
    expect(layout).toContain('groupKeyForRoute')
  })
})

describe('标签页的入口边界', () => {
  it('公共页与单据页不进标签', () => {
    expect(composable).toContain('!route.meta.public && !route.meta.noTab')
    // 入库 / 出库有离开确认，进标签会在切标签时弹「放弃未提交的单据」
    expect(router.match(/noTab: true/g)?.length ?? 0).toBe(2)
  })

  it('退出登录清空标签（换账号不能留着上一个账号的页面）', () => {
    expect(read('src/layouts/UserMenu.vue')).toMatch(/function logout\(\)[\s\S]*?resetAppTabs\(\)/)
  })
})
