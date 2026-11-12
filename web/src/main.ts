import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import { ensureBackendSelected } from './api/backend'
import { useSettingsStore } from './stores/settings'
import { useThemeStore } from './stores/theme'
import { loadNaiveDarkTheme } from './utils/naiveDarkTheme'
import './styles.css'

async function bootstrap() {
  const app = createApp(App)
  const pinia = createPinia()
  app.use(pinia).use(router)
  // 外观（自动 / 浅色 / 深色）在 mount 前落到 <html>，与 index.html 的首屏预置脚本一致，避免闪主题。
  const theme = useThemeStore(pinia)
  theme.apply()
  // 双后端：先并发探测所有候选地址并选出延迟更低的线路，后续所有请求都走选中的地址；
  // 只配置一条地址时立即返回，不产生额外请求。
  await ensureBackendSelected()
  // 二级库模式要在 mount 前就绪，保证菜单/路由守卫首次导航即可读到。
  // 深色档下 Naive UI 的深色主题是按需加载的代码块，同批等它就绪，避免首屏组件先浅后深。
  await Promise.all([
    useSettingsStore(pinia).load(),
    theme.isDark ? loadNaiveDarkTheme().catch(() => undefined) : undefined,
  ])
  app.mount('#app')
}

void bootstrap()
