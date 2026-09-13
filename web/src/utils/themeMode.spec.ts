import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  THEME_MODE_DEFAULT,
  THEME_MODE_STORAGE_KEY,
  normalizeThemeMode,
  readThemeMode,
  writeThemeMode,
} from './themeMode'

describe('themeMode 外观偏好', () => {
  afterEach(() => {
    localStorage.removeItem(THEME_MODE_STORAGE_KEY)
    vi.restoreAllMocks()
  })

  it('未写入时默认跟随系统（auto）', () => {
    expect(readThemeMode()).toBe('auto')
    expect(THEME_MODE_DEFAULT).toBe('auto')
  })

  it('识别已保存的三个档位', () => {
    for (const mode of ['auto', 'light', 'dark'] as const) {
      localStorage.setItem(THEME_MODE_STORAGE_KEY, mode)
      expect(readThemeMode()).toBe(mode)
    }
  })

  it('非法值回落默认档位', () => {
    localStorage.setItem(THEME_MODE_STORAGE_KEY, 'sepia')
    expect(readThemeMode()).toBe('auto')
    expect(normalizeThemeMode(null)).toBe('auto')
    expect(normalizeThemeMode(undefined)).toBe('auto')
  })

  it('写入后能读回，且返回归一化档位', () => {
    expect(writeThemeMode('dark')).toBe('dark')
    expect(readThemeMode()).toBe('dark')
    // 非法输入不落脏值
    expect(writeThemeMode('sepia')).toBe('auto')
    expect(localStorage.getItem(THEME_MODE_STORAGE_KEY)).toBe('auto')
  })

  it('存储不可用时不抛错：读回落默认值，写静默失败', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    expect(readThemeMode()).toBe('auto')
    vi.restoreAllMocks()

    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    expect(writeThemeMode('light')).toBe('light')
  })
})
