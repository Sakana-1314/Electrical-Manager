import { describe, expect, it, vi } from 'vitest'
import { h } from 'vue'
import type { MenuOption } from 'naive-ui'
import type { IconRender } from './appearanceMenu'
import {
  THEME_MENU_KEY,
  THEME_MENU_LABEL,
  buildThemeMenuSubmenu,
  isThemeModeKey,
} from './appearanceMenu'

const renderIcon = vi.fn<IconRender>(() => () => h('span'))

describe('appearanceMenu（用户菜单的外观二级菜单）', () => {
  it('「外观」是二级菜单父项，子项为自动/浅色/深色三个档位', () => {
    const menu = buildThemeMenuSubmenu('auto', false, renderIcon)
    expect(menu).toHaveLength(1)
    const parent = menu[0]
    expect(parent.label).toBe(THEME_MENU_LABEL)
    expect(parent.key).toBe(THEME_MENU_KEY)
    // 二级菜单：父项自身不是分组标题，靠 children 触发展开
    expect(parent.type).toBeUndefined()
    const children = parent.children as MenuOption[]
    expect(children.map((child) => child.key)).toEqual(['auto', 'light', 'dark'])
    expect(children.map((child) => child.label)).toEqual(['自动', '浅色', '深色'])
    // 每个档位都带图标（选中档位换成对勾，仍然是图标）
    expect(children.every((child) => typeof child.icon === 'function')).toBe(true)
    // 父项图标 + 三个档位图标
    expect(renderIcon).toHaveBeenCalledTimes(4)
  })

  it('父项图标反映当前实际明暗（auto 档按解析结果）', () => {
    renderIcon.mockClear()
    buildThemeMenuSubmenu('auto', true, renderIcon)
    const darkParentIcon = renderIcon.mock.calls[0][0]
    // 父项图标排在最前，档位图标紧随其后
    expect(renderIcon).toHaveBeenCalledTimes(4)

    renderIcon.mockClear()
    buildThemeMenuSubmenu('auto', false, renderIcon)
    const lightParentIcon = renderIcon.mock.calls[0][0]
    // 实际是深色还是浅色，父项图标跟着变
    expect(darkParentIcon).not.toBe(lightParentIcon)
  })

  it('三个档位各自使用不同图标', () => {
    renderIcon.mockClear()
    buildThemeMenuSubmenu('dark', true, renderIcon)
    const [autoIcon, lightIcon, darkIcon] = renderIcon.mock.calls.slice(1).map(([icon]) => icon)
    expect(autoIcon).not.toBe(lightIcon)
    expect(darkIcon).not.toBe(lightIcon)
    expect(darkIcon).not.toBe(autoIcon)
  })

  it('key → 档位判定只认三个合法档位（父项 key 不算档位）', () => {
    expect(isThemeModeKey('auto')).toBe(true)
    expect(isThemeModeKey('light')).toBe(true)
    expect(isThemeModeKey('dark')).toBe(true)
    expect(isThemeModeKey('logout')).toBe(false)
    expect(isThemeModeKey(THEME_MENU_KEY)).toBe(false)
    expect(isThemeModeKey('')).toBe(false)
  })
})
