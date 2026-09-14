import { h, type VNode } from 'vue'
import { NIcon, type MenuOption } from 'naive-ui'
import type { Component } from 'vue'
import { CheckmarkOutline, ContrastOutline, MoonOutline, SunnyOutline } from '@vicons/ionicons5'
import { THEME_MODE_OPTIONS, type ThemeMode } from '@/utils/themeMode'

/**
 * 顶栏用户菜单里的「外观」二级菜单（自动 / 浅色 / 深色）。
 *
 * 独立出来便于单测：菜单结构与「哪个 key 属于外观档位」都是纯逻辑，
 * 不需要挂载布局组件；图标渲染按 Naive UI 的 MenuOption 约定包装成 NIcon。
 * 约定：父项只负责展开子菜单（key 不是档位），子项 key 就是 ThemeMode 本身，
 * 选中项前面显示对勾，未选中显示该档位图标。
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

/** 外观二级菜单的父项标题与 key（父项本身不是档位，避免与子项 key 冲突）。 */
export const THEME_MENU_LABEL = '外观'
export const THEME_MENU_KEY = 'theme-menu'

export type IconRender = (icon: Component) => () => VNode

/** key 是否属于外观档位（用于用户菜单 select 分发）。 */
export function isThemeModeKey(key: string): key is ThemeMode {
  return (THEME_MODE_OPTIONS as readonly string[]).includes(key)
}

/**
 * 构造用户菜单里的「外观」二级菜单：父项鼠标悬浮向左展开三个档位。
 *
 * 顶栏账号在页面最右上角，Naive UI 子菜单默认向右展开、空间不足时自动翻转，
 * 因此这里无需额外配置就会朝左浮现。父项图标反映当前实际明暗（`auto` 档按解析结果），
 * 让当前是深色还是浅色在菜单里一眼可读；当前档位在前面显示对勾。
 */
export function buildThemeMenuSubmenu(
  mode: ThemeMode,
  isDark: boolean,
  renderIcon: IconRender,
): MenuOption[] {
  return [
    {
      label: THEME_MENU_LABEL,
      key: THEME_MENU_KEY,
      icon: renderIcon(isDark ? MoonOutline : SunnyOutline),
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
