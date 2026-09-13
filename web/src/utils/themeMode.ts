/**
 * 界面外观偏好（纯浏览器本地，不落库、不产生任何请求）。
 *
 * 约定：
 * - 浏览器级偏好：同一浏览器换账号共享，换浏览器各自独立（与备忘录字号偏好一致）。
 * - 只有 auto / light / dark 三个档位，非法值一律回落默认 auto（跟随系统）。
 * - 默认 auto：系统深色则深色、系统浅色则浅色，用户显式选择后按选择固定。
 * - localStorage 不可用（隐私模式、老浏览器、SSR）时静默降级为默认值，页面功能不受影响。
 */

export const THEME_MODE_STORAGE_KEY = 'theme.mode'
export const THEME_MODE_DEFAULT = 'auto'

/** 可选档位，同时作为校验白名单：新增档位只改这里（下拉选项与校验都取自它）。 */
export const THEME_MODE_OPTIONS = ['auto', 'light', 'dark'] as const

export type ThemeMode = (typeof THEME_MODE_OPTIONS)[number]

/** 归一化为合法档位：未知 / 空值一律回落默认 auto。 */
export function normalizeThemeMode(value: unknown): ThemeMode {
  return THEME_MODE_OPTIONS.includes(value as ThemeMode) ? (value as ThemeMode) : THEME_MODE_DEFAULT
}

/** 读取本地外观偏好（未写入 / 值非法 / 存储不可用时返回默认 auto）。 */
export function readThemeMode(): ThemeMode {
  try {
    return normalizeThemeMode(localStorage.getItem(THEME_MODE_STORAGE_KEY))
  } catch {
    return THEME_MODE_DEFAULT
  }
}

/** 写入本地外观偏好；存储不可用时静默失败，仅本次会话生效。返回归一化后的档位。 */
export function writeThemeMode(value: unknown): ThemeMode {
  const mode = normalizeThemeMode(value)
  try {
    localStorage.setItem(THEME_MODE_STORAGE_KEY, mode)
  } catch {
    // 存储不可用（隐私模式 / 配额满）：忽略写入失败，档位仍对当前会话生效。
  }
  return mode
}
