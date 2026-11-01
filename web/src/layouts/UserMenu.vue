<script setup lang="ts">
import { computed, h, type Component as VueComponent } from 'vue'
import { useRouter } from 'vue-router'
import { NIcon, type MenuOption } from 'naive-ui'
import { LogOutOutline, PersonCircleOutline } from '@vicons/ionicons5'
import { useAuthStore } from '@/stores/auth'
import { useProjectStore } from '@/stores/project'
import { useThemeStore } from '@/stores/theme'
import { roleLabels } from '@/types/navigation'
import { buildThemeMenuSubmenu, isThemeModeKey } from '@/layouts/appearanceMenu'
import {
  buildProjectMenuSubmenu,
  isProjectMenuKey,
  projectIdFromMenuKey,
} from '@/layouts/projectMenu'

defineProps<{
  /** 侧栏折叠时只保留用户图标；移动端抽屉与展开态显示用户名与角色。 */
  collapsed?: boolean
  /**
   * 下拉浮层的 z-index。移动端抽屉内的菜单会 teleport 到 body，默认 z-index auto
   * 会被抽屉（Naive 从 2000 起）盖住，需要由调用方指定高于抽屉的值。
   */
  zIndex?: number
}>()

const router = useRouter()
const auth = useAuthStore()
const project = useProjectStore()
const theme = useThemeStore()

/** 统一用组件库图标（Naive UI 的 NIcon + @vicons/ionicons5），尺寸与居中由 n-menu 控制。 */
const renderIcon = (icon: VueComponent) => () => h(NIcon, null, { default: () => h(icon) })

const displayName = computed(() => auth.user?.display_name || auth.user?.username || '未登录')
const roleLabel = computed(() => (auth.user ? roleLabels[auth.user.role] : ''))

/* ============ 左下角用户下拉：项目（切换）+ 外观（自动 / 浅色 / 深色） ============
 * 入口在侧栏（移动端在抽屉）左下角，下拉向上展开，子菜单向右浮现。
 * 「项目」二级菜单列出所有启用项目（父项显示当前项目名称，子项也只显示名称），切换后布局
 * 会整页刷新（页面大量使用 keep-alive，不刷新会继续显示上一个项目的数据）；
 * 菜单结构在 projectMenu.ts（有单测）。
 * 「外观」一级同样是二级菜单：当前档位显示对勾，父项图标反映当前实际明暗；
 * 菜单结构在 appearanceMenu.ts（有单测）。 */
const userMenuOptions = computed<MenuOption[]>(() => [
  ...buildThemeMenuSubmenu(theme.mode, theme.isDark, renderIcon),
  ...buildProjectMenuSubmenu(
    project.enabledProjects,
    project.currentProject?.id ?? null,
    renderIcon,
  ),
  { type: 'divider', key: 'logout-divider' },
  { label: '退出登录', key: 'logout', icon: renderIcon(LogOutOutline) },
])

/** 用户菜单选择：退出登录 + 外观三档（key 与档位同名）+ 项目切换（key 为 project:<id>）。 */
function onUserMenuSelect(key: string) {
  if (key === 'logout') {
    logout()
    return
  }
  if (isThemeModeKey(key)) {
    theme.setMode(key)
    return
  }
  if (isProjectMenuKey(key)) {
    const id = projectIdFromMenuKey(key)
    if (id !== null) project.select(id)
  }
}

function logout() {
  auth.logout()
  // 退出登录同时清掉项目选择：同一标签页换账号登录后要重新解析当前项目
  project.clear()
  void router.push({ name: 'login' })
}
</script>

<template>
  <n-dropdown
    :options="userMenuOptions"
    :z-index="zIndex"
    placement="top-start"
    trigger="click"
    @select="onUserMenuSelect"
  >
    <button
      type="button"
      class="user-menu-trigger"
      :class="{ compact: collapsed }"
      aria-label="打开用户菜单"
    >
      <span class="user-menu-icon" aria-hidden="true">
        <n-icon :size="20"><PersonCircleOutline /></n-icon>
      </span>
      <span v-if="!collapsed" class="user-summary">
        <span class="user-name">{{ displayName }}</span>
        <span class="user-role">{{ roleLabel }}</span>
      </span>
      <span v-if="!collapsed" class="user-menu-caret" aria-hidden="true" />
    </button>
  </n-dropdown>
</template>

<style scoped>
/* 默认轻量，仅悬停与键盘聚焦时用主色浅背景 + 弱边框（与侧栏菜单项的交互一致） */
.user-menu-trigger {
  display: flex;
  width: 100%;
  min-height: 44px;
  align-items: center;
  gap: 10px;
  padding: 6px 10px;
  border: 1px solid transparent;
  border-radius: 10px;
  color: inherit;
  background: transparent;
  cursor: pointer;
  transition:
    background-color 0.2s ease,
    border-color 0.2s ease;
}
.user-menu-trigger:hover,
.user-menu-trigger:focus-visible {
  border-color: var(--color-primary-border);
  background: var(--color-primary-soft);
  outline: none;
}
.user-menu-trigger.compact {
  justify-content: center;
  padding: 6px 0;
}
.user-menu-icon {
  display: grid;
  flex: none;
  place-items: center;
  color: var(--color-text-muted);
}
.user-summary {
  display: grid;
  flex: 1 1 auto;
  min-width: 0;
  gap: 2px;
  text-align: left;
}
.user-name,
.user-role {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.user-name {
  color: var(--color-text-strong);
  font-size: 13px;
  font-weight: 600;
  line-height: 1.25;
}
.user-role {
  color: var(--color-text-muted);
  font-size: 12px;
  line-height: 1.25;
}
/* 下拉向上展开，箭头指向上方 */
.user-menu-caret {
  flex: none;
  width: 7px;
  height: 7px;
  margin-top: 3px;
  border-right: 1.5px solid var(--color-text-muted);
  border-bottom: 1.5px solid var(--color-text-muted);
  transform: rotate(-135deg);
}
</style>
