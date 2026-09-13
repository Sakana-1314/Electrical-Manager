import { h, type VNode } from 'vue'
import { NIcon, type MenuOption } from 'naive-ui'
import type { Component } from 'vue'
import { CheckmarkOutline, ContrastOutline, MoonOutline, SunnyOutline } from '@vicons/ionicons5'
import { THEME_MODE_OPTIONS, type ThemeMode } from '@/utils/themeMode'

/**
 * 顶栏用户菜单里的「外观」入口（自动 / 浅色 / 深色）。
 *
 * 独立出来便于单测：菜单结构与「哪个 key 属于外观档位」都是纯逻辑，
 * 不需要挂载布局组件；图标渲染按 Naive UI 的 MenuOption 约定包装成 NIcon。
 * 约定：档位 key 就是 ThemeMode 本身，选中项前面显示对勾，未选中显示该档位图标。
 */
export const THEME_MODE_LABELS: Record<ThemeMode, string> = {
  auto: '自动',
  light: '浅色',
  dark: '深色',
}

const THEME_MODE_ICONS = {
  auto: ContrastOutline,
  light: SunnyOutline,
  dark: MoonOutline,
} as const

/** 外观分组标题（同时是分组 key，避免与档位 key 冲突）。 */
export const THEME_MENU_GROUP_LABEL = '外观'
export const THEME_MENU_GROUP_KEY = 'theme-group'

export type IconRender = (icon: Component) => () => VNode

/** key 是否属于外观档位（用于用户菜单 select 分发）。 */
export function isThemeModeKey(key: string): key is ThemeMode {
  return (THEME_MODE_OPTIONS as readonly string[]).includes(key)
}

/** 顶栏外观按钮的无障碍说明：同时给出当前档位与实际明暗。 */
export function appearanceButtonLabel(mode: ThemeMode, isDark: boolean): string {
  return `外观：${THEME_MODE_LABELS[mode]}（当前${isDark ? '深色' : '浅色'}）`
}

/** 构造用户菜单里的「外观」分组：三个档位，当前档位用对勾标记。 */
export function buildThemeMenuGroup(mode: ThemeMode, renderIcon: IconRender): MenuOption[] {
  return [
    {
      type: 'group',
      label: THEME_MENU_GROUP_LABEL,
      key: THEME_MENU_GROUP_KEY,
      children: THEME_MODE_OPTIONS.map((option) => ({
        key: option,
        label: THEME_MODE_LABELS[option],
        icon: renderIcon(option === mode ? CheckmarkOutline : THEME_MODE_ICONS[option]),
      })),
    },
  ]
}

/** 供 NIcon 包装用（与 AppLayout 的 renderIcon 完全一致的实现，便于独立测试）。 */
export const renderMenuIcon: IconRender = (icon) => () => h(NIcon, null, { default: () => h(icon) })
