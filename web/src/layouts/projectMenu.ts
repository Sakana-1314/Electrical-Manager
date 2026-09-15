import type { MenuOption } from 'naive-ui'
import { CheckmarkOutline, FolderOpenOutline } from '@vicons/ionicons5'
import type { Project } from '@/api/generated'
import type { IconRender } from './appearanceMenu'

/**
 * 顶栏用户菜单里的「当前项目」二级菜单（各启用项目）。
 *
 * 独立出来便于单测：菜单结构与「哪个 key 属于项目子项」都是纯逻辑，
 * 不需要挂载布局组件；图标渲染沿用 appearanceMenu 的约定（包装成 NIcon）。
 * 约定：父项只负责展开子菜单（key 不是项目），子项 key 是 `project:<id>`，
 * 选中项前面显示对勾，其余项目显示统一的文件夹图标（保持子项缩进一致）。
 * 项目列表为空时给一个禁用的占位子项，菜单仍可展开而不会空空一片。
 */
export const PROJECT_MENU_KEY = 'project-menu'

/** 父项标题前缀；当前项目不存在时补「未选择」。 */
export const PROJECT_MENU_LABEL_PREFIX = '当前项目：'

/** 子项 key 前缀：`project:<id>`。 */
export const PROJECT_ITEM_KEY_PREFIX = 'project:'

/** 无可用项目时的占位子项（禁用，仅展示）。 */
export const PROJECT_NONE_KEY = 'project:none'
export const PROJECT_NONE_LABEL = '暂无可用项目'

/** key 是否属于项目子项（父项 key 是 `project-menu`，不会被当成选择）。 */
export function isProjectMenuKey(key: string): boolean {
  return key.startsWith(PROJECT_ITEM_KEY_PREFIX)
}

/** 从子项 key 解析项目 id；占位项与非项目 key 一律返回 null。 */
export function projectIdFromMenuKey(key: string): number | null {
  if (!isProjectMenuKey(key)) return null
  const id = Number(key.slice(PROJECT_ITEM_KEY_PREFIX.length))
  return Number.isInteger(id) && id > 0 ? id : null
}

/**
 * 构造用户菜单里的「当前项目」二级菜单：父项显示当前项目编码，子项是传入的项目列表
 * （调用方只传启用项目）。当前项目前面显示对勾，切换后布局会整页刷新。
 */
export function buildProjectMenuSubmenu(
  projects: Project[],
  currentId: number | null,
  renderIcon: IconRender,
): MenuOption[] {
  const current = projects.find((project) => project.id === currentId) ?? null
  return [
    {
      label: `${PROJECT_MENU_LABEL_PREFIX}${current ? current.code : '未选择'}`,
      key: PROJECT_MENU_KEY,
      icon: renderIcon(FolderOpenOutline),
      children: projects.length
        ? projects.map((project) => ({
            key: `${PROJECT_ITEM_KEY_PREFIX}${project.id}`,
            label: `${project.code} ${project.name}`,
            icon: renderIcon(project.id === currentId ? CheckmarkOutline : FolderOpenOutline),
          }))
        : [{ key: PROJECT_NONE_KEY, label: PROJECT_NONE_LABEL, disabled: true }],
    },
  ]
}
