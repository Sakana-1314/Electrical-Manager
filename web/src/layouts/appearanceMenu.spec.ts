import { describe, expect, it, vi } from 'vitest'
import { h } from 'vue'
import type { MenuOption } from 'naive-ui'
import type { IconRender } from './appearanceMenu'
import {
  THEME_MENU_GROUP_KEY,
  THEME_MENU_GROUP_LABEL,
  appearanceButtonLabel,
  buildThemeMenuGroup,
  isThemeModeKey,
} from './appearanceMenu'

const renderIcon = vi.fn<IconRender>(() => () => h('span'))

describe('appearanceMenu（用户菜单的外观入口）', () => {
  it('「外观」作为分组标题出现，内含自动/浅色/深色三个档位', () => {
    const group = buildThemeMenuGroup('auto', renderIcon)
    expect(group).toHaveLength(1)
    expect(group[0].type).toBe('group')
    expect(group[0].label).toBe(THEME_MENU_GROUP_LABEL)
    expect(group[0].key).toBe(THEME_MENU_GROUP_KEY)
    const children = group[0].children as MenuOption[]
    expect(children.map((child) => child.key)).toEqual(['auto', 'light', 'dark'])
    expect(children.map((child) => child.label)).toEqual(['自动', '浅色', '深色'])
    // 每个档位都带图标（选中档位换成对勾，仍然是图标）
    expect(children.every((child) => typeof child.icon === 'function')).toBe(true)
    expect(renderIcon).toHaveBeenCalledTimes(3)
  })

  it('当前档位用其它档位各自不同的图标，且与未选中档位不同', () => {
    renderIcon.mockClear()
    buildThemeMenuGroup('dark', renderIcon)
    const [autoIcon, lightIcon, darkIcon] = renderIcon.mock.calls.map(([icon]) => icon)
    expect(autoIcon).not.toBe(lightIcon)
    expect(darkIcon).not.toBe(lightIcon)
    expect(darkIcon).not.toBe(autoIcon)
  })

  it('key → 档位判定只认三个合法档位', () => {
    expect(isThemeModeKey('auto')).toBe(true)
    expect(isThemeModeKey('light')).toBe(true)
    expect(isThemeModeKey('dark')).toBe(true)
    expect(isThemeModeKey('logout')).toBe(false)
    expect(isThemeModeKey(THEME_MENU_GROUP_KEY)).toBe(false)
    expect(isThemeModeKey('')).toBe(false)
  })

  it('按钮说明同时给出档位与实际明暗（自动档跟随系统）', () => {
    expect(appearanceButtonLabel('auto', true)).toBe('外观：自动（当前深色）')
    expect(appearanceButtonLabel('auto', false)).toBe('外观：自动（当前浅色）')
    expect(appearanceButtonLabel('dark', true)).toBe('外观：深色（当前深色）')
    expect(appearanceButtonLabel('light', false)).toBe('外观：浅色（当前浅色）')
  })
})
