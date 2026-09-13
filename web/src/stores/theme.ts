import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import { usePreferredDark } from '@vueuse/core'
import { readThemeMode, writeThemeMode, type ThemeMode } from '@/utils/themeMode'

/** 浏览器地址栏 / 状态栏的配色（跟随解析后的外观，避免深色页面顶着一块白）。 */
const META_THEME_COLOR: Record<'light' | 'dark', string> = {
  light: '#ffffff',
  dark: '#161a21',
}

/**
 * 界面外观（自动 / 浅色 / 深色）。
 *
 * 约定：
 * - 默认 auto（跟随系统）：首次访问、未做过选择时跟随操作系统的深浅色设置，并实时响应系统切换。
 * - 用户显式选择 light / dark 后固定该档位，只记在浏览器本地（不落库、不产生请求）。
 * - 解析结果写到 <html data-theme="light|dark">：styles.css 的令牌按该属性切换，
 *   同时同步 color-scheme，让滚动条、原生表单控件、系统 UI 一起跟随。
 * - Naive UI 组件自身的明暗由 App.vue 的 n-config-provider 按同一状态切换（darkTheme）。
 */
export const useThemeStore = defineStore('theme', () => {
  const mode = ref<ThemeMode>(readThemeMode())
  /** 系统当前是否为深色（usePreferredDark 直接监听 matchMedia，系统切换实时生效）。 */
  const prefersDark = usePreferredDark()
  const isDark = computed(() => (mode.value === 'auto' ? prefersDark.value : mode.value === 'dark'))

  /** 把当前解析结果写到 <html> 与浏览器 UI 配色，供首屏与切换时同步调用。 */
  function apply() {
    if (typeof document === 'undefined') return
    const resolved = isDark.value ? 'dark' : 'light'
    const root = document.documentElement
    root.dataset.theme = resolved
    // color-scheme 影响滚动条、占位符、原生控件与浏览器 UI，必须与外观保持一致。
    root.style.colorScheme = resolved
    let meta = document.querySelector('meta[name="theme-color"]')
    if (!meta) {
      meta = document.createElement('meta')
      meta.setAttribute('name', 'theme-color')
      document.head.appendChild(meta)
    }
    meta.setAttribute('content', META_THEME_COLOR[resolved])
  }

  function setMode(value: ThemeMode) {
    mode.value = writeThemeMode(value)
    apply()
  }

  // 系统外观变化（auto 档）时同步 <html>；启动时先按已保存 / 系统设置立即落到 DOM，
  // 与 index.html 的首屏预置脚本结果一致，不会出现闪白或闪黑。
  watch(isDark, apply, { immediate: true })

  return { mode, isDark, setMode, apply }
})
