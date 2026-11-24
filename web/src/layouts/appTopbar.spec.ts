// @vitest-environment node
/**
 * 顶部导航条接线守卫。
 *
 * 页面名只在布局的 `.app-topbar` 里出现（桌面 40px / 移动端 48px），各视图不再渲染
 * `.page-title` 大标题。导航条一旦被改回 `v-if="isMobile"`、或某个页面又重新长出大标题，
 * 桌面端与移动端的页面名就会出现零次 / 两次，且不会报错——这里直接扫源码守住。
 * 纯读文件，因此用 node 环境。
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const WEB_ROOT = process.cwd()
const layout = readFileSync(`${WEB_ROOT}/src/layouts/AppLayout.vue`, 'utf8')
const styles = readFileSync(`${WEB_ROOT}/src/styles.css`, 'utf8')

function vueFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = `${dir}/${entry}`
    if (statSync(path).isDirectory()) return vueFiles(path)
    return path.endsWith('.vue') ? [path] : []
  })
}

describe('顶部导航条', () => {
  it('桌面端与移动端都渲染同一条导航条，标题取自路由', () => {
    expect(layout).toContain('class="app-topbar"')
    expect(layout).toMatch(/<div class="topbar-title">\{\{ route\.meta\.title \}\}<\/div>/)
    // 菜单按钮只在移动端出现，导航条本身不能被 isMobile 条件包住
    expect(layout).not.toMatch(/<n-layout-header[^>]*v-if="isMobile"/)
    expect(layout).toMatch(/<button\s+v-if="isMobile"/)
  })

  it('导航条高度很矮：桌面 40px、移动端 48px', () => {
    expect(layout).toMatch(/\.app-topbar \{[^}]*height: 40px;/)
    expect(layout).toMatch(/\.app-topbar\.is-mobile \{[^}]*height: 48px;/)
    expect(layout).toMatch(/\.topbar-title \{[^}]*font-size: 13px;/)
  })

  it('视图不再渲染页面大标题', () => {
    for (const path of vueFiles(`${WEB_ROOT}/src`)) {
      expect(readFileSync(path, 'utf8'), path).not.toContain('class="page-title"')
    }
    expect(styles).not.toContain('.page-title {')
  })
})
