// @vitest-environment node
/**
 * 「详情弹窗」的接线守卫。
 *
 * 详情页已全部改为列表页弹窗（物资档案 / 操作记录 / 申购计划 / 申购记录），并且要求
 * **点击弹窗外部（遮罩）就能关闭**，同时有未保存修改时先二次确认。这条交互完全靠模板上
 * 一组约定接线，缺一条都不会报错、只会静默失效：
 *
 * 1) `:mask-closable="false"` + `:close-on-esc="false"`：naive-ui 的这两个开关会**直接**
 *    改 show、绕过 `onClose`，留着就绕开了未保存修改的确认；
 * 2) `@mask-click` / `@esc` / `@close` 三个事件都要转发到 `requestClose`，否则点了没反应；
 * 3) `@close` 的处理函数必须返回 `false`（`Modal.handleCloseClick` 只在返回值不为 false
 *    时关闭），否则「继续编辑」拦不住。
 *
 * 另外守住「不再有详情页」：视图与组件里不应再出现 4 个详情路由名或硬编码详情路径。
 * 纯读文件，因此用 node 环境（与 mobileDialog.spec.ts 同一思路）。
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const WEB_ROOT = process.cwd()
const ROUTER_PATH = `${WEB_ROOT}/src/router/index.ts`

/** 详情弹窗在模板上的统一标记（4 个弹窗都带）。 */
const MARKER = 'data-detail-modal'

/** 已移除的详情路由名与硬编码详情路径。 */
const REMOVED_DETAIL_ROUTES = [
  'stock-material-detail',
  'operation-detail',
  'purchase-material-detail',
  'purchase-record-detail',
]
const REMOVED_DETAIL_PATHS = [
  '/warehouse/materials/',
  '/warehouse/operations/',
  '/procurement/materials/',
  '/procurement/records/',
]

/**
 * 去掉注释后再扫描：视图里有「原 /warehouse/materials/:id 详情页」这类说明性注释，
 * 它们不是导航代码，不该被判为「仍引用详情路径」。
 */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
}

function vueFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = `${dir}/${entry}`
    if (statSync(path).isDirectory()) return vueFiles(path)
    return path.endsWith('.vue') ? [path] : []
  })
}

const files = [...vueFiles(`${WEB_ROOT}/src/views`), ...vueFiles(`${WEB_ROOT}/src/components`)].map(
  (path) => ({ path, source: stripComments(readFileSync(path, 'utf8')) }),
)

const detailModals = files.filter((file) => file.source.includes(MARKER))

describe('详情弹窗的关闭接线', () => {
  it('至少存在 4 个详情弹窗（物资 / 流水 / 计划 / 记录）', () => {
    expect(detailModals.length).toBeGreaterThanOrEqual(4)
  })

  it('详情弹窗必须禁用 naive 自身的遮罩与 ESC 关闭，改由 requestClose 收口', () => {
    for (const file of detailModals) {
      // 只看标记所在的那个弹窗标签：从标记往前找到 <n-modal
      const at = file.source.indexOf(MARKER)
      const open = file.source.lastIndexOf('<n-modal', at)
      const close = file.source.indexOf('>', at)
      const tag = file.source.slice(open, close + 1)
      expect(tag, file.path).toContain(':mask-closable="false"')
      expect(tag, file.path).toContain(':close-on-esc="false"')
    }
  })

  it('点遮罩、按 ESC、点 × 三条路径都转发给 requestClose', () => {
    for (const file of detailModals) {
      const at = file.source.indexOf(MARKER)
      const open = file.source.lastIndexOf('<n-modal', at)
      const close = file.source.indexOf('>', at)
      const tag = file.source.slice(open, close + 1)
      expect(tag, file.path).toContain('@mask-click="requestClose')
      expect(tag, file.path).toContain('@esc="requestClose')
      // 关闭按钮走 @close，且处理函数要能返回 false 才能拦住「继续编辑」
      expect(tag, file.path).toMatch(/@close="handleCloseClick"/)
      expect(file.source, file.path).toMatch(/function handleCloseClick\(\): false/)
    }
  })

  it('不再引用已移除的详情路由名与硬编码详情路径', () => {
    for (const file of files) {
      for (const route of REMOVED_DETAIL_ROUTES) {
        expect(file.source, `${file.path} 仍引用详情路由 ${route}`).not.toContain(route)
      }
      for (const path of REMOVED_DETAIL_PATHS) {
        expect(file.source, `${file.path} 仍引用详情路径 ${path}`).not.toContain(path)
      }
    }
  })

  it('路由表里这 4 个路径只作为重定向保留（不再指向详情页组件）', () => {
    const router = readFileSync(ROUTER_PATH, 'utf8')
    for (const name of REMOVED_DETAIL_ROUTES) {
      expect(router, `router 仍定义详情路由 ${name}`).not.toContain(name)
    }
    for (const path of [
      'warehouse/materials/:id',
      'warehouse/operations/:id',
      'procurement/materials/:id',
      'procurement/records/:id',
    ]) {
      expect(router, `router 缺少旧详情路径 ${path} 的兼容重定向`).toContain(path)
    }
    expect(router).not.toContain('DetailView.vue')
  })
})
