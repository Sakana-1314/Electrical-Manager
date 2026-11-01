import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import { systemSettingsApi } from './api/systemSettings'
import { useSettingsStore } from './stores/settings'
import { useThemeStore } from './stores/theme'
import { configureImageBaseUrl } from './utils/image'
import { loadNaiveDarkTheme } from './utils/naiveDarkTheme'
import './styles.css'

async function loadImageAcceleration() {
  try {
    const imageSettings = await systemSettingsApi.imageAcceleration()
    configureImageBaseUrl(imageSettings.image_acceleration_server_url)
  } catch {
    configureImageBaseUrl('')
  }
}

async function bootstrap() {
  const app = createApp(App)
  const pinia = createPinia()
  app.use(pinia).use(router)
  // 外观（自动 / 浅色 / 深色）在 mount 前落到 <html>，与 index.html 的首屏预置脚本一致，避免闪主题。
  const theme = useThemeStore(pinia)
  theme.apply()
  // 图片加速地址与二级库模式等系统配置互不依赖，并行拉取：首屏等待从「两次往返」降为一次，
  // 弱网下两个 3s 探针最坏也只等 3s（原来串行最坏 6s 白屏）。
  // 系统配置要在 mount 前就绪，保证菜单/路由守卫首次导航即可读到。
  // 深色档下 Naive UI 的深色主题是按需加载的代码块，同批等它就绪，避免首屏组件先浅后深。
  await Promise.all([
    loadImageAcceleration(),
    useSettingsStore(pinia).load(),
    theme.isDark ? loadNaiveDarkTheme().catch(() => undefined) : undefined,
  ])
  app.mount('#app')
}

void bootstrap()
