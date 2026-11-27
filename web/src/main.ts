import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import { ensureBackendSelected } from './api/backend'
import { useThemeStore } from './stores/theme'
import { loadNaiveDarkTheme } from './utils/naiveDarkTheme'
import { installStaleChunkRecovery, resumePendingRoute } from './utils/staleChunk'
import './styles.css'

async function bootstrap() {
  const app = createApp(App)
  const pinia = createPinia()
  app.use(pinia).use(router)
  // 发版后旧代码块 404 的自愈：记住点不动的那一页，整页刷新拿到新哈希后继续跳过去。
  // 必须在首次导航前装上，否则直接打开旧书签时第一个懒加载失败就漏掉了。
  installStaleChunkRecovery(router)
  // 外观（自动 / 浅色 / 深色）在 mount 前落到 <html>，与 index.html 的首屏预置脚本一致，避免闪主题。
  const theme = useThemeStore(pinia)
  theme.apply()
  // 双后端：先并发探测所有候选地址并选出延迟更低的线路，后续所有请求都走选中的地址；
  // 只配置一条地址时立即返回，不产生额外请求。
  await ensureBackendSelected()
  // 深色档下 Naive UI 的深色主题是按需加载的代码块，mount 前等它就绪，避免首屏组件先浅后深。
  if (theme.isDark) await loadNaiveDarkTheme().catch(() => undefined)
  app.mount('#app')
  // 上一次因为旧代码块 404 自动刷新过：挂载后补跳回用户原本要去的页面
  resumePendingRoute(router)
}

void bootstrap()
