import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import { systemSettingsApi } from './api/systemSettings'
import { useSettingsStore } from './stores/settings'
import { useThemeStore } from './stores/theme'
import { configureImageBaseUrl } from './utils/image'
import './styles.css'

async function bootstrap() {
  try {
    const imageSettings = await systemSettingsApi.imageAcceleration()
    configureImageBaseUrl(imageSettings.image_acceleration_server_url)
  } catch {
    configureImageBaseUrl('')
  }
  const app = createApp(App)
  const pinia = createPinia()
  app.use(pinia).use(router)
  // 外观（自动 / 浅色 / 深色）在 mount 前落到 <html>，与 index.html 的首屏预置脚本一致，避免闪主题。
  useThemeStore(pinia).apply()
  // 二级库模式等系统配置在 mount 前加载，保证菜单/路由守卫首次导航即可读到。
  await useSettingsStore(pinia).load()
  app.mount('#app')
}

void bootstrap()
