/**
 * 校验站点文档里的 Mermaid 图。
 *
 * 为什么需要：Mermaid 在浏览器里渲染，语法错误不会让 `vitepress build` 失败——构建产物里
 * 只是一块没渲染出来的代码块，线上才发现图是空的。文档以图为主之后，这里做一次静态门禁：
 *
 *   1. 每个 ```mermaid 代码块都能被 `mermaid.parse()` 解析；
 *   2. 块内不写 HTTP 方法与路由路径。图只描述业务语义（状态、动作、错误码、表名），
 *      接口路径以「接口文档」（Apifox）与 `docs/openapi.yaml` 为准。
 *
 * 用法：
 *   node docs/websites/scripts/check_mermaid.mjs                 # 扫描 pages/ 全部文档
 *   node docs/websites/scripts/check_mermaid.mjs pages/api.md …  # 只校验指定文件 / 目录
 *
 * 依赖：mermaid 来自本工程 `node_modules`；flowchart / stateDiagram 的解析需要 DOM，
 * 因此借用 `web/node_modules` 的 jsdom（仓库内已有，不新增依赖）。找不到 jsdom 时只跳过
 * 语法校验并给出提示，路径检查照常执行。
 *
 * 不接入 CI：`.github/workflows/` 不属于文档改动范围，本地提交前跑一次即可。
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createRequire } from 'node:module'

const here = path.dirname(fileURLToPath(import.meta.url))
const siteDir = path.resolve(here, '..')

const BLOCK = /```mermaid\r?\n([\s\S]*?)```/g

// 图里不该出现的接口路径写法：HTTP 方法 + 路由、/api/ 前缀、带 {参数} 的路由模板。
const PATH_PATTERNS = [
  [/\b(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+\//, 'HTTP 方法 + 路由'],
  [/\/api\/v\d/, '/api/ 开头的接口路径'],
  [/(^|[\s"'(])\/[a-z][a-z0-9-]*\/\{[a-zA-Z_]+\}/, '带路径参数的路由模板'],
]

function collect(targets) {
  const files = []
  for (const target of targets) {
    const stat = fs.statSync(target)
    if (stat.isDirectory()) {
      for (const entry of fs.readdirSync(target, { withFileTypes: true })) {
        const child = path.join(target, entry.name)
        if (entry.isDirectory()) files.push(...collect([child]))
        else if (entry.name.endsWith('.md')) files.push(child)
      }
    } else if (target.endsWith('.md')) {
      files.push(target)
    }
  }
  return files
}

async function loadMermaid() {
  const mermaidPath = path.join(siteDir, 'node_modules/mermaid/dist/mermaid.esm.mjs')
  if (!fs.existsSync(mermaidPath)) {
    console.warn('⚠️  未找到 mermaid（先在本目录 npm install），跳过语法校验')
    return null
  }
  const webRequire = createRequire(path.join(siteDir, '..', '..', 'web', 'package.json'))
  let jsdomPath
  try {
    jsdomPath = webRequire.resolve('jsdom/lib/api.js')
  } catch {
    console.warn('⚠️  未找到 web/node_modules/jsdom，跳过语法校验（只做路径检查）')
    return null
  }
  const { JSDOM } = await import(pathToFileURL(jsdomPath).href)
  const dom = new JSDOM('<!doctype html><html><body></body></html>')
  globalThis.window = dom.window
  globalThis.document = dom.window.document
  Object.defineProperty(globalThis, 'navigator', {
    value: dom.window.navigator,
    configurable: true,
  })
  const mermaid = (await import(pathToFileURL(mermaidPath).href)).default
  mermaid.initialize({ startOnLoad: false })
  return mermaid
}

const targets = process.argv.slice(2)
const roots = targets.length
  ? targets.map((t) => path.resolve(process.cwd(), t))
  : [path.join(siteDir, 'pages')]

const mermaid = await loadMermaid()
const files = collect(roots)
const problems = []
let blocks = 0

for (const file of files) {
  const text = fs.readFileSync(file, 'utf-8')
  const rel = path.relative(process.cwd(), file)
  for (const match of text.matchAll(BLOCK)) {
    const source = match[1]
    const line = text.slice(0, match.index).split('\n').length
    blocks += 1
    for (const [pattern, label] of PATH_PATTERNS) {
      const hit = pattern.exec(source)
      if (hit) {
        problems.push(`${rel}:${line} 图内出现${label}：${hit[0].trim()}`)
      }
    }
    if (mermaid) {
      try {
        await mermaid.parse(source)
      } catch (error) {
        problems.push(`${rel}:${line} Mermaid 语法错误：${String(error).split('\n')[0]}`)
      }
    }
  }
}

for (const problem of problems) console.error('❌', problem)
console.log(`扫描 ${files.length} 个文件、${blocks} 张图，问题 ${problems.length} 个`)
process.exit(problems.length ? 1 : 0)
