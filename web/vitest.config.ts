import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

/**
 * 测试环境必须是 `test`（而不是继承外部的 `production`）。
 *
 * 原因：Vue 的 `package.json` exports 在 `require` 条件下按 `NODE_ENV` 选择构建产物——
 * `production` 会解析到 `vue.cjs.prod.js`。prod 构建**移除了 devtools hook**，而
 * `@vue/test-utils` 的 `wrapper.emitted()` 正是靠这个 hook 捕获自定义事件
 * （见其 `attachEmitListener`）。于是只要外部环境变量是 `NODE_ENV=production`
 * （常见于 CI / 生产 shell / Docker），所有「断言组件 emit」的用例都会静默失败，
 * 看起来像代码 bug。这里在加载 Vue 之前强制改回 `test`，让测试结果与外部环境无关。
 */
process.env.NODE_ENV = 'test'

export default defineConfig({
  plugins: [vue()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  define: {
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
  test: { environment: 'jsdom', setupFiles: ['./src/test/setup.ts'] },
})
