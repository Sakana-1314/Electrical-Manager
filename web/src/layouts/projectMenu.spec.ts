import { describe, expect, it, vi } from 'vitest'
import { h } from 'vue'
import { CheckmarkOutline } from '@vicons/ionicons5'
import type { MenuOption } from 'naive-ui'
import type { Project } from '@/api/generated'
import type { IconRender } from './appearanceMenu'
import {
  PROJECT_MENU_KEY,
  PROJECT_MENU_LABEL_PREFIX,
  PROJECT_NONE_KEY,
  PROJECT_NONE_LABEL,
  buildProjectMenuSubmenu,
  isProjectMenuKey,
  projectIdFromMenuKey,
  projectOptionLabel,
} from './projectMenu'

const renderIcon = vi.fn<IconRender>(() => () => h('span'))

function project(overrides: Partial<Project> = {}): Project {
  return {
    id: 1,
    code: 'P05',
    name: 'P05 项目',
    enabled: true,
    is_default: true,
    remark: null,
    created_at: '2026-01-05T09:00:00+08:00',
    updated_at: '2026-01-05T09:00:00+08:00',
    version: 1,
    ...overrides,
  }
}

const projects = [project(), project({ id: 2, code: 'P06', name: 'P06 项目', is_default: false })]

describe('projectMenu（用户菜单的项目二级菜单）', () => {
  it('父项显示当前项目编码，子项只显示名称（不外显编码，避免重复）', () => {
    renderIcon.mockClear()
    const menu = buildProjectMenuSubmenu(projects, 1, renderIcon)
    expect(menu).toHaveLength(1)
    const parent = menu[0]
    expect(PROJECT_MENU_LABEL_PREFIX).toBe('项目：')
    expect(parent.label).toBe('项目：P05')
    expect(parent.key).toBe(PROJECT_MENU_KEY)
    // 二级菜单：父项自身不是分组标题，靠 children 触发展开
    expect(parent.type).toBeUndefined()
    const children = parent.children as MenuOption[]
    expect(children.map((child) => child.key)).toEqual(['project:1', 'project:2'])
    // 子项只写名称：名称本身已含编码时不会出现「P05 P05 项目」
    expect(children.map((child) => child.label)).toEqual(['P05 项目', 'P06 项目'])
    // 每个子项都带图标（当前项目是对勾，其余是文件夹，缩进一致）
    expect(children.every((child) => typeof child.icon === 'function')).toBe(true)
    // 父项图标 + 两个子项图标
    expect(renderIcon).toHaveBeenCalledTimes(3)
  })

  it('当前项目显示对勾，其余项目不显示', () => {
    renderIcon.mockClear()
    buildProjectMenuSubmenu(projects, 2, renderIcon)
    // 父项图标排在最前，两个子项图标紧随其后
    expect(renderIcon).toHaveBeenCalledTimes(3)
    const childIcons = renderIcon.mock.calls.slice(1).map(([icon]) => icon)
    expect(childIcons[1]).toBe(CheckmarkOutline)
    expect(childIcons[0]).not.toBe(CheckmarkOutline)
  })

  it('没有当前项目时父项显示「未选择」', () => {
    const menu = buildProjectMenuSubmenu(projects, null, renderIcon)
    expect(menu[0].label).toBe(`${PROJECT_MENU_LABEL_PREFIX}未选择`)
  })

  it('项目列表为空时只给一个禁用的占位子项', () => {
    const menu = buildProjectMenuSubmenu([], null, renderIcon)
    expect(menu).toHaveLength(1)
    expect(menu[0].label).toBe(`${PROJECT_MENU_LABEL_PREFIX}未选择`)
    const children = menu[0].children as MenuOption[]
    expect(children).toHaveLength(1)
    expect(children[0]).toMatchObject({
      key: PROJECT_NONE_KEY,
      label: PROJECT_NONE_LABEL,
      disabled: true,
    })
  })

  it('子项标签不外显编码：名称里没有编码时也照原样显示', () => {
    expect(projectOptionLabel({ code: 'P06', name: '华星镍业二期' })).toBe('华星镍业二期')
    expect(projectOptionLabel({ code: 'P05', name: 'P05 项目' })).toBe('P05 项目')
    // 名称意外为空时退回编码，菜单项不会变成空白
    expect(projectOptionLabel({ code: 'P07', name: '  ' })).toBe('P07')
  })

  it('key → 项目判定只认 project:<id> 形式的子项（父项与占位项不算项目）', () => {
    expect(isProjectMenuKey('project:1')).toBe(true)
    expect(isProjectMenuKey(PROJECT_NONE_KEY)).toBe(true)
    expect(isProjectMenuKey(PROJECT_MENU_KEY)).toBe(false)
    expect(isProjectMenuKey('logout')).toBe(false)
    expect(isProjectMenuKey('')).toBe(false)

    expect(projectIdFromMenuKey('project:12')).toBe(12)
    // 占位项与父项解析不出项目 id，select 时会被忽略
    expect(projectIdFromMenuKey(PROJECT_NONE_KEY)).toBeNull()
    expect(projectIdFromMenuKey(PROJECT_MENU_KEY)).toBeNull()
    expect(projectIdFromMenuKey('logout')).toBeNull()
  })
})
