import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { projectApi } from '@/api/projects'
import type { Project } from '@/api/generated'

/** 当前项目的本地键；与 api/client.ts 请求拦截器读写的键必须完全一致。 */
export const CURRENT_PROJECT_STORAGE_KEY = 'current_project_id'

/** 读取本地保存的当前项目 id（缺失或非法一律视为未选择）。 */
function readStoredProjectId(): number | null {
  const raw = localStorage.getItem(CURRENT_PROJECT_STORAGE_KEY)
  if (!raw) return null
  const id = Number(raw)
  return Number.isInteger(id) && id > 0 ? id : null
}

/** 写回本地：未选择时直接删键，避免留下 "null" / "NaN" 这类脏值。 */
function writeStoredProjectId(id: number | null) {
  if (id === null) localStorage.removeItem(CURRENT_PROJECT_STORAGE_KEY)
  else localStorage.setItem(CURRENT_PROJECT_STORAGE_KEY, String(id))
}

/**
 * 当前项目（项目）：所有业务数据按项目隔离，用户始终处在唯一一个项目里。
 *
 * 约定：
 * - 项目列表由路由守卫在首次进入受保护页面前拉取（`ensureLoaded`），之后一直复用；
 *   切换项目走 `select`，本地记录后**整页刷新**——页面大量使用 keep-alive，
 *   不刷新会继续显示上一个项目的数据。
 * - 当前项目解析顺序：本地已选且仍是启用项目 → 默认项目 → 第一个启用项目；
 *   解析结果写回本地，供 api/client.ts 的拦截器给每个业务请求带 `X-Project-Id`。
 * - 拉取失败不抛错（否则首次导航整页白屏）：保持「未加载」，下次导航自动重试。
 */
export const useProjectStore = defineStore('project', () => {
  const projects = ref<Project[]>([])
  const currentProjectId = ref<number | null>(readStoredProjectId())
  const loaded = ref(false)
  /** 进行中的拉取：并发调用共用同一个 Promise，避免重复请求。 */
  let pending: Promise<void> | null = null

  const enabledProjects = computed(() => projects.value.filter((item) => item.enabled))
  const currentProject = computed(
    () => projects.value.find((item) => item.id === currentProjectId.value) ?? null,
  )

  /** 按「本地已选 → 默认项目 → 第一个启用项目」解析当前项目（停用的项目一律跳过）。 */
  function resolveCurrentId(list: Project[]): number | null {
    const enabled = list.filter((item) => item.enabled)
    const stored = currentProjectId.value
    if (stored !== null && enabled.some((item) => item.id === stored)) return stored
    const fallback = enabled.find((item) => item.is_default) ?? enabled[0]
    return fallback ? fallback.id : null
  }

  async function fetchProjects() {
    try {
      const list = await projectApi.list()
      projects.value = list
      currentProjectId.value = resolveCurrentId(list)
      writeStoredProjectId(currentProjectId.value)
      loaded.value = true
    } catch {
      // 失败保持未加载：下次导航会重试；不抛错，避免守卫把整页导航拦下来。
      projects.value = []
      loaded.value = false
    }
  }

  /** 确保项目列表已加载（幂等且并发安全：两个导航同时触发只会发一次请求）。 */
  function ensureLoaded(): Promise<void> {
    if (loaded.value) return Promise.resolve()
    pending ??= fetchProjects().finally(() => {
      pending = null
    })
    return pending
  }

  /** 切换当前项目：本地记录后整页刷新，保证不会残留上一个项目的数据。 */
  function select(id: number) {
    if (id === currentProjectId.value) return
    writeStoredProjectId(id)
    window.location.reload()
  }

  /** 清空（退出登录等场景）：连同本地记录一起清掉。 */
  function clear() {
    projects.value = []
    currentProjectId.value = null
    loaded.value = false
    writeStoredProjectId(null)
  }

  return {
    projects,
    currentProjectId,
    loaded,
    enabledProjects,
    currentProject,
    ensureLoaded,
    select,
    clear,
  }
})
