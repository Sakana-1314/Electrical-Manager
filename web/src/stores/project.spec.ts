import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type { Project } from '@/api/generated'
import { projectApi } from '@/api/projects'
import { CURRENT_PROJECT_STORAGE_KEY, useProjectStore } from './project'

vi.mock('@/api/projects', () => ({
  projectApi: {
    list: vi.fn(),
  },
}))

const listProjects = vi.mocked(projectApi.list)

function project(overrides: Partial<Project> = {}): Project {
  return {
    id: 1,
    name: '华星现有项目',
    enabled: true,
    is_default: true,
    remark: null,
    created_at: '2026-01-05T09:00:00+08:00',
    updated_at: '2026-01-05T09:00:00+08:00',
    version: 1,
    ...overrides,
  }
}

const first = project()
const second = project({ id: 2, name: '二期项目', is_default: false })
// 停用项目：即便本地选的是它，也不能作为当前项目
const disabled = project({ id: 3, name: '三期项目', enabled: false, is_default: false })

describe('project store（当前项目）', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.removeItem(CURRENT_PROJECT_STORAGE_KEY)
    listProjects.mockReset()
  })

  it('未加载时没有当前项目', () => {
    const store = useProjectStore()
    expect(store.currentProjectId).toBeNull()
    expect(store.currentProject).toBeNull()
    expect(store.loaded).toBe(false)
  })

  it('本地已选且仍是启用项目时沿用本地选择', async () => {
    localStorage.setItem(CURRENT_PROJECT_STORAGE_KEY, '2')
    listProjects.mockResolvedValue([first, second])
    const store = useProjectStore()
    await store.ensureLoaded()
    expect(store.currentProjectId).toBe(2)
    expect(store.currentProject?.name).toBe('二期项目')
    expect(store.loaded).toBe(true)
  })

  it('本地没选过时落到默认项目，并写回本地', async () => {
    listProjects.mockResolvedValue([second, first])
    const store = useProjectStore()
    await store.ensureLoaded()
    expect(store.currentProjectId).toBe(1)
    expect(store.currentProject?.name).toBe('华星现有项目')
    expect(localStorage.getItem(CURRENT_PROJECT_STORAGE_KEY)).toBe('1')
  })

  it('没有默认项目时落到第一个启用项目（跳过停用项目）', async () => {
    listProjects.mockResolvedValue([
      disabled,
      project({ id: 4, name: '四期项目', is_default: false }),
    ])
    const store = useProjectStore()
    await store.ensureLoaded()
    expect(store.currentProjectId).toBe(4)
    expect(store.enabledProjects.map((item) => item.name)).toEqual(['四期项目'])
  })

  it('本地选的是已停用项目时回落到默认项目并改本地记录', async () => {
    localStorage.setItem(CURRENT_PROJECT_STORAGE_KEY, '3')
    listProjects.mockResolvedValue([first, second, disabled])
    const store = useProjectStore()
    await store.ensureLoaded()
    expect(store.currentProjectId).toBe(1)
    expect(localStorage.getItem(CURRENT_PROJECT_STORAGE_KEY)).toBe('1')
  })

  it('本地存的是非法值时按未选择处理', async () => {
    localStorage.setItem(CURRENT_PROJECT_STORAGE_KEY, 'not-a-number')
    listProjects.mockResolvedValue([first])
    const store = useProjectStore()
    await store.ensureLoaded()
    expect(store.currentProjectId).toBe(1)
  })

  it('ensureLoaded 幂等：并发/重复调用只发一次请求', async () => {
    listProjects.mockResolvedValue([first, second])
    const store = useProjectStore()
    await Promise.all([store.ensureLoaded(), store.ensureLoaded()])
    await store.ensureLoaded()
    expect(listProjects).toHaveBeenCalledTimes(1)
  })

  it('拉取失败不抛错、保持未加载，下次导航重试', async () => {
    listProjects.mockRejectedValueOnce(new Error('network'))
    const store = useProjectStore()
    await expect(store.ensureLoaded()).resolves.toBeUndefined()
    expect(store.projects).toEqual([])
    expect(store.loaded).toBe(false)

    listProjects.mockResolvedValue([first])
    await store.ensureLoaded()
    expect(listProjects).toHaveBeenCalledTimes(2)
    expect(store.currentProjectId).toBe(1)
    expect(store.loaded).toBe(true)
  })

  it('select 写入本地并整页刷新；选同一个项目不刷新', async () => {
    const reload = vi.fn()
    Object.defineProperty(window, 'location', {
      configurable: true,
      writable: true,
      value: { ...window.location, reload },
    })
    localStorage.setItem(CURRENT_PROJECT_STORAGE_KEY, '2')
    listProjects.mockResolvedValue([first, second])
    const store = useProjectStore()
    await store.ensureLoaded()

    // 已是当前项目：不做任何事，避免无意义刷新
    store.select(2)
    expect(reload).not.toHaveBeenCalled()

    // 切换：先落本地，再整页刷新（页面大量 keep-alive，不刷新会残留上一个项目的数据）
    store.select(1)
    expect(localStorage.getItem(CURRENT_PROJECT_STORAGE_KEY)).toBe('1')
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('clear 清空状态与本地记录', async () => {
    localStorage.setItem(CURRENT_PROJECT_STORAGE_KEY, '2')
    listProjects.mockResolvedValue([first, second])
    const store = useProjectStore()
    await store.ensureLoaded()
    store.clear()
    expect(store.projects).toEqual([])
    expect(store.currentProjectId).toBeNull()
    expect(store.loaded).toBe(false)
    expect(localStorage.getItem(CURRENT_PROJECT_STORAGE_KEY)).toBeNull()
  })
})
