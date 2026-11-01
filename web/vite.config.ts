import { fileURLToPath, URL } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import Components from 'unplugin-vue-components/vite'
import { NaiveUiResolver } from 'unplugin-vue-components/resolvers'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    // 子路径部署：VITE_BASE_PATH='/Electrical-Manager/demo/' 时资源与路由都挂在该前缀下。
    // 默认 '/' 与既有部署行为完全一致；router 用 import.meta.env.BASE_URL 自动跟随。
    base: env.VITE_BASE_PATH?.trim() || '/',
    plugins: [vue(), Components({ resolvers: [NaiveUiResolver()] })],
    resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
    define: {
      __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
    },
    build: {
      assetsDir: 'yangrucheng-assets',
      rollupOptions: {
        output: {
          // 框架运行时单独成块：业务代码每次发版哈希都会变，框架代码只在升级依赖时才变，
          // 拆开后老用户发版后只需重新下载业务块。Naive UI 不放进来——它按组件拆块、随页面按需加载，
          // 整体塞进一个 vendor 块反而会让首屏多下载 DataTable / DatePicker 等大组件。
          manualChunks(id) {
            if (/[\\/]node_modules[\\/](@vue|vue|vue-router|pinia|axios)[\\/]/.test(id)) {
              return 'vendor-vue'
            }
          },
        },
      },
    },
    server: {
      port: 5173,
      // 本地联调走后端：VITE_API_BASE_URL 用默认 /api/v1 时由 Vite 代理转发。
      // 联调 Apifox Mock 时把 VITE_API_BASE_URL 填成 Mock 的完整地址，请求不再经过代理。
      proxy: { '/api': env.VITE_API_PROXY || 'http://localhost:8000' },
    },
  }
})
