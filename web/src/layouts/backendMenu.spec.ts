import { describe, expect, it, vi } from 'vitest'
import { h } from 'vue'
import { CheckmarkOutline, ServerOutline } from '@vicons/ionicons5'
import type { MenuOption } from 'naive-ui'
import type { IconRender } from './appearanceMenu'
import {
  BACKEND_ITEM_KEY_PREFIX,
  BACKEND_MENU_KEY,
  backendIndexFromMenuKey,
  backendOptionLabel,
  buildBackendMenuSubmenu,
  isBackendMenuKey,
} from './backendMenu'

const origin = 'https://app.example.com'
const renderIcon = vi.fn<IconRender>(() => () => h('span'))

function children(menu: MenuOption[]): MenuOption[] {
  return (menu[0]?.children ?? []) as MenuOption[]
}

describe('backendMenu（用户菜单的线路二级菜单）', () => {
  it('只有一条线路时不显示菜单', () => {
    expect(buildBackendMenuSubmenu(['/api/v1'], 0, renderIcon, origin)).toEqual([])
    expect(buildBackendMenuSubmenu([], 0, renderIcon, origin)).toEqual([])
  })

  it('多条线路：父项显示当前线路，子项用下标作 key 并给当前项打勾', () => {
    renderIcon.mockClear()
    const urls = ['/api/v1', 'https://api-b.example.com/api/v1']
    const menu = buildBackendMenuSubmenu(urls, 1, renderIcon, origin)

    expect(menu).toHaveLength(1)
    expect(menu[0]?.key).toBe(BACKEND_MENU_KEY)
    expect(menu[0]?.label).toBe('线路：api-b.example.com')
    expect(children(menu).map((item) => item.key)).toEqual(['backend:0', 'backend:1'])
    expect(children(menu).map((item) => item.label)).toEqual(['本站', 'api-b.example.com'])
    expect(renderIcon.mock.calls.map(([icon]) => icon)).toEqual([
      ServerOutline,
      ServerOutline,
      CheckmarkOutline,
    ])
  })

  it('同源地址显示「本站」，非默认前缀带上路径以便区分', () => {
    expect(backendOptionLabel('/api/v1', origin)).toBe('本站')
    expect(backendOptionLabel('/secondary/api/v1', origin)).toBe('本站/secondary/api/v1')
    expect(backendOptionLabel('https://api.example.com/api/v1', origin)).toBe('api.example.com')
    expect(backendOptionLabel('https://api.example.com:8443/api/v1', origin)).toBe(
      'api.example.com:8443',
    )
  })

  it('解析线路子项 key', () => {
    expect(isBackendMenuKey(`${BACKEND_ITEM_KEY_PREFIX}1`)).toBe(true)
    expect(isBackendMenuKey(BACKEND_MENU_KEY)).toBe(false)
    expect(backendIndexFromMenuKey('backend:1')).toBe(1)
    expect(backendIndexFromMenuKey('backend:-1')).toBeNull()
    expect(backendIndexFromMenuKey('backend:x')).toBeNull()
    expect(backendIndexFromMenuKey('project:1')).toBeNull()
  })
})
