import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useThemeStore } from './theme'
import { THEME_MODE_STORAGE_KEY } from '@/utils/themeMode'

describe('theme store（界面外观）', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.removeItem(THEME_MODE_STORAGE_KEY)
    delete document.documentElement.dataset.theme
  })

  afterEach(() => {
    localStorage.removeItem(THEME_MODE_STORAGE_KEY)
    delete document.documentElement.dataset.theme
  })

  it('默认 auto：未做过选择时跟随系统（测试环境无系统深色 → 浅色）', () => {
    const store = useThemeStore()
    expect(store.mode).toBe('auto')
    expect(store.isDark).toBe(false)
  })

  it('进入应用立即把解析结果写到 html（首次加载不闪主题）', () => {
    useThemeStore()
    expect(document.documentElement.dataset.theme).toBe('light')
    expect(document.documentElement.style.colorScheme).toBe('light')
  })

  it('切到 dark：解析为深色、落本地并同步 html', () => {
    const store = useThemeStore()
    store.setMode('dark')
    expect(store.mode).toBe('dark')
    expect(store.isDark).toBe(true)
    expect(localStorage.getItem(THEME_MODE_STORAGE_KEY)).toBe('dark')
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(document.documentElement.style.colorScheme).toBe('dark')
  })

  it('切回 auto：不再固定深色，跟随系统（测试环境为浅色）', () => {
    const store = useThemeStore()
    store.setMode('dark')
    store.setMode('auto')
    expect(store.isDark).toBe(false)
    expect(document.documentElement.dataset.theme).toBe('light')
  })

  it('刷新后读取本地已保存档位（light 覆盖系统）', () => {
    localStorage.setItem(THEME_MODE_STORAGE_KEY, 'light')
    setActivePinia(createPinia())
    const store = useThemeStore()
    expect(store.mode).toBe('light')
    expect(store.isDark).toBe(false)
  })

  it('本地存的是非法档位时回落 auto', () => {
    localStorage.setItem(THEME_MODE_STORAGE_KEY, 'sepia')
    setActivePinia(createPinia())
    expect(useThemeStore().mode).toBe('auto')
  })
})
