// @vitest-environment node
/**
 * 顶部导航条接线守卫。
 *
 * 导航条本体就是标签栏：当前页由激活标签呈现，**不再单独写页面名**，
 * 避免同一页面名在标题与标签上出现两次。导航条在桌面与移动端都渲染同一条
 * （桌面 40px / 移动端 48px），标签撑满整条高度、上下不留白；
 * 各视图也不再渲染 `.page-title` 大标题。
 * 这些约定被改回旧结构时不会报错，只会静默出现「零次 / 两次页面名」，所以直接扫源码守住。
 * 纯读文件，因此用 node 环境。
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const WEB_ROOT = process.cwd()
const layout = readFileSync(`${WEB_ROOT}/src/layouts/AppLayout.vue`, 'utf8')
const tabs = readFileSync(`${WEB_ROOT}/src/layouts/AppTabs.vue`, 'utf8')
const styles = readFileSync(`${WEB_ROOT}/src/styles.css`, 'utf8')

function vueFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = `${dir}/${entry}`
    if (statSync(path).isDirectory()) return vueFiles(path)
    return path.endsWith('.vue') ? [path] : []
  })
}

describe('顶部导航条', () => {
  it('导航条本体就是标签栏，不再重复显示页面名', () => {
    expect(layout).toContain('class="app-topbar"')
    expect(layout).toMatch(/<n-layout-header[^>]*class="app-topbar"[^>]*>[\s\S]*?<AppTabs \/>/)
    // 标题行已删除：同一页面名只在标签上出现一次
    expect(layout).not.toContain('topbar-title')
    // 菜单按钮只在移动端出现，导航条本身不能被 isMobile 条件包住
    expect(layout).not.toMatch(/<n-layout-header[^>]*v-if="isMobile"/)
    expect(layout).toMatch(/<button\s+v-if="isMobile"/)
  })

  it('导航条高度很矮：桌面 40px、移动端 48px；标签撑满整条高度、上下不留白', () => {
    expect(layout).toMatch(/\.app-topbar \{[^}]*height: 40px;/)
    expect(layout).toMatch(/\.app-topbar\.is-mobile \{[^}]*height: 48px;/)
    expect(tabs).toMatch(/\.app-tabs \{[^}]*height: 100%;/)
    // 扁平标签：纵向不留白（padding 必须是 `0 …` 形式）
    expect(tabs).toMatch(/\.app-tab \{[^}]*padding: 0 [^;]*;/)
    // 标签之间有横向间距（不是连成一片的色块）
    expect(tabs).toMatch(/\.app-tabs \{[^}]*gap: var\(--app-tab-gap\);/)
    expect(tabs).toMatch(/--app-tab-gap: [1-9][0-9]*px;/)
    // 激活态：页面背景色 + 主题色文字，底部 1px 同色阴影盖住导航条下边框，与页面融合
    expect(tabs).toMatch(
      /\.app-tab\.is-active \{[^}]*background: var\(--color-bg\);[^}]*box-shadow: 0 1px 0 var\(--color-bg\);[^}]*color: var\(--color-primary\);/,
    )
    // 形状：上方两角圆、底部直角（不是四角圆角块）；不画下划线
    expect(tabs).toMatch(/\.app-tab \{[^}]*border-radius: 8px 8px 0 0;/)
    expect(tabs).not.toContain('.app-tab.is-active::after')
  })

  it('视图不再渲染页面大标题', () => {
    for (const path of vueFiles(`${WEB_ROOT}/src`)) {
      expect(readFileSync(path, 'utf8'), path).not.toContain('class="page-title"')
    }
    expect(styles).not.toContain('.page-title {')
  })
})
