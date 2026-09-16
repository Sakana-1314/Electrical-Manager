<script setup lang="ts">
import { computed, h, ref, type Component as VueComponent } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { NIcon, type MenuOption } from 'naive-ui'
import {
  BusinessOutline,
  CartOutline,
  CubeOutline,
  DocumentTextOutline,
  GridOutline,
  LibraryOutline,
  LogOutOutline,
  MenuOutline,
  SettingsOutline,
  WarningOutline,
} from '@vicons/ionicons5'
import { useMediaQuery } from '@vueuse/core'
import { useAuthStore } from '@/stores/auth'
import { useProjectStore } from '@/stores/project'
import { useSettingsStore } from '@/stores/settings'
import { useThemeStore } from '@/stores/theme'
import { roleLabels } from '@/types/navigation'
import { buildThemeMenuSubmenu, isThemeModeKey } from '@/layouts/appearanceMenu'
import {
  buildProjectMenuSubmenu,
  isProjectMenuKey,
  projectIdFromMenuKey,
} from '@/layouts/projectMenu'
import { LOGO_URL } from '@/constants/branding'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const project = useProjectStore()
const settings = useSettingsStore()
const theme = useThemeStore()
const collapsed = ref(false)
// 移动端断点：≤768px 时侧边栏切换为抽屉导航
const isMobile = useMediaQuery('(max-width: 768px)')
const drawerOpen = ref(false)
const closeDrawer = () => {
  drawerOpen.value = false
}
/** 统一用组件库图标（Naive UI 的 NIcon + @vicons/ionicons5），尺寸与居中由 n-menu 控制。 */
const renderIcon = (icon: VueComponent) => () => h(NIcon, null, { default: () => h(icon) })

/**
 * 导航项：一级项给 icon，二级项不给——侧栏折叠时只显示一级图标，
 * 二级项图标永远看不到，加了只是多余噪音（展开态也靠缩进区分层级）。
 */
const link = (label: string, name: string, icon?: VueComponent): MenuOption => ({
  label: () => h(RouterLink, { to: { name }, onClick: closeDrawer }, { default: () => label }),
  key: name,
  ...(icon ? { icon: renderIcon(icon) } : {}),
})

const menuOptions = computed<MenuOption[]>(() => {
  const items: MenuOption[] = [
    link('工作台', 'dashboard', GridOutline),
    link('备忘录', 'memos', DocumentTextOutline),
  ]
  if (settings.isLiteMode) {
    // 精简模式：二级库只有一级 tab（Excel 导入 + 只读查询），与华星总库存同层级。
    items.push(link('二级库', 'warehouse-lite', CubeOutline))
  } else {
    items.push({
      label: '二级库',
      key: 'warehouse-group',
      icon: renderIcon(CubeOutline),
      children: [
        link('库存查询', 'stock'),
        link('物资档案', 'stock-materials'),
        link('操作记录', 'operations'),
        ...(auth.can('warehouse:write') ? [link('入库', 'inbound'), link('出库', 'outbound')] : []),
      ],
    })
  }
  items.push(link('华星总库存', 'hua-xing-stock', BusinessOutline))
  items.push({
    label: '申购管理',
    key: 'procurement-group',
    icon: renderIcon(CartOutline),
    children: [
      link('申购计划', 'purchase-materials'),
      link('周期性计划', 'purchase-plan-templates'),
      link('未编码物资', 'uncoded-materials'),
      link('物料编码库', 'material-code-library'),
      link('申购记录', 'purchase-records'),
    ],
  })
  // 隐患管理：读取对所有登录用户开放，因此菜单不做权限过滤（写操作在页面内按权限隐藏）。
  items.push({
    label: '隐患管理',
    key: 'hazard-group',
    icon: renderIcon(WarningOutline),
    children: [
      link('隐患管理', 'hazard-records'),
      link('隐患类型', 'hazard-types'),
      link('责任单位', 'hazard-units'),
    ],
  })
  // 台账管理：同样读取开放，菜单不做权限过滤；第一个子 tab 是台账总览。
  items.push({
    label: '台账管理',
    key: 'ledger-group',
    icon: renderIcon(LibraryOutline),
    children: [link('台账总览', 'ledger-items'), link('标签管理', 'ledger-tags')],
  })
  if (auth.can('settings:write'))
    items.push({
      label: '系统管理',
      key: 'settings-group',
      icon: renderIcon(SettingsOutline),
      children: [
        link('管理端用户', 'users'),
        link('小程序用户', 'mini-program-users'),
        link('项目管理', 'projects'),
        link('附件管理', 'attachments'),
        link('高级设置', 'advanced-settings'),
        link('分享链接', 'share-links'),
        link('关于', 'about'),
      ],
    })
  return items
})

function logout() {
  auth.logout()
  // 退出登录同时清掉项目选择：同一标签页换账号登录后要重新解析当前项目
  project.clear()
  void router.push({ name: 'login' })
}

/* ============ 顶栏用户下拉：项目（切换）+ 外观（自动 / 浅色 / 深色） ============
 * 「项目」二级菜单列出所有启用项目（父项显示当前项目名称，子项也只显示名称），切换后布局
 * 会整页刷新（页面大量使用 keep-alive，不刷新会继续显示上一个项目的数据）；
 * 菜单结构在 projectMenu.ts（有单测）。
 * 「外观」一级同样是二级菜单：鼠标悬浮向左展开三个档位（顶栏在最右上角，
 * Naive UI 子菜单空间不足时自动向左翻转）。父项图标反映当前实际明暗，
 * 当前档位显示对勾；顶栏不再放独立的明暗切换图标，外观只从菜单里切换。
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
</script>

<template>
  <n-layout :has-sider="!isMobile" class="app-shell">
    <!-- 侧栏几何：展开 180px / 折叠 64px；菜单字号 13px 在 theme.ts 的 Menu 覆盖里（见 UI 设计规范「侧栏导航」） -->
    <n-layout-sider
      v-if="!isMobile"
      bordered
      collapse-mode="width"
      :collapsed-width="64"
      :width="180"
      :collapsed="collapsed"
      show-trigger
      @collapse="collapsed = true"
      @expand="collapsed = false"
    >
      <div class="brand" :class="{ compact: collapsed }">
        <img class="brand-mark" :src="LOGO_URL" alt="系统 Logo" />
        <span v-if="!collapsed">HXNI 电气无忧</span>
      </div>
      <n-menu
        :collapsed="collapsed"
        :collapsed-width="64"
        :collapsed-icon-size="22"
        :options="menuOptions"
        :value="String(route.name || '')"
      />
    </n-layout-sider>
    <n-layout>
      <n-layout-header bordered class="topbar">
        <div class="topbar-left">
          <button
            v-if="isMobile"
            type="button"
            class="menu-toggle"
            aria-label="打开导航菜单"
            @click="drawerOpen = true"
          >
            <n-icon :size="20"><MenuOutline /></n-icon>
          </button>
          <!-- 顶栏标题：桌面端「上级 / 当前」，顶级页面只有当前标题；移动端只保留当前标题（宽度不够） -->
          <div class="topbar-title">
            <n-breadcrumb>
              <n-breadcrumb-item v-if="!isMobile && route.meta.parent">
                {{ route.meta.parent }}
              </n-breadcrumb-item>
              <n-breadcrumb-item>{{ route.meta.title }}</n-breadcrumb-item>
            </n-breadcrumb>
          </div>
        </div>
        <div class="topbar-actions">
          <!-- 顶栏不放当前项目标记：项目只在用户菜单里显示与切换，避免顶栏噪音 -->
          <!-- 外观只从用户菜单的「外观」二级菜单切换，顶栏不再放独立的明暗切换图标 -->
          <n-dropdown :options="userMenuOptions" @select="onUserMenuSelect">
            <button type="button" class="user-menu-trigger" aria-label="打开用户菜单">
              <span class="user-summary">
                <span class="user-name">{{ auth.user?.display_name || auth.user?.username }}</span>
                <span v-if="!isMobile" class="user-role">{{
                  auth.user ? roleLabels[auth.user.role] : ''
                }}</span>
              </span>
              <span class="user-menu-caret" aria-hidden="true" />
            </button>
          </n-dropdown>
        </div>
      </n-layout-header>
      <n-layout-content class="app-content" :native-scrollbar="false">
        <router-view v-slot="{ Component, route: currentRoute }">
          <keep-alive>
            <component
              :is="Component"
              v-if="currentRoute.meta.keepAlive"
              :key="String(currentRoute.name)"
            />
          </keep-alive>
          <component :is="Component" v-if="!currentRoute.meta.keepAlive" />
        </router-view>
      </n-layout-content>
    </n-layout>
  </n-layout>

  <!-- 移动端抽屉导航 -->
  <n-drawer v-model:show="drawerOpen" placement="left" :width="250" aria-label="导航菜单">
    <div class="drawer-brand">
      <img class="brand-mark" :src="LOGO_URL" alt="系统 Logo" />
      <span>HXNI 电气无忧</span>
    </div>
    <n-menu
      class="drawer-menu"
      :options="menuOptions"
      :value="String(route.name || '')"
      @update:value="closeDrawer"
    />
  </n-drawer>
</template>

<style scoped>
.app-shell {
  height: 100vh;
  background: var(--color-bg);
}
.brand {
  height: 68px;
  display: flex;
  align-items: center;
  gap: 10px;
  /* 200 → 180px 时品牌名放不下，字号与左右内边距同步收一档（Logo 尺寸见 .brand-mark） */
  padding: 0 13px;
  border-bottom: 1px solid var(--color-border-subtle);
  color: var(--color-text-strong);
  font-size: 15px;
  font-weight: 650;
  white-space: nowrap;
}
/* 品牌名比折叠阈值长，极窄侧栏 / 大字号系统设置下省略而不换行挤压 */
.brand > span,
.drawer-brand > span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}
.brand.compact {
  justify-content: center;
  padding: 0;
}
.brand-mark {
  width: 30px;
  height: 30px;
  object-fit: contain;
  flex: none;
}
.topbar {
  height: 68px;
  padding: 0 28px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--color-surface-translucent);
  backdrop-filter: blur(12px);
}
.topbar-left {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 10px;
}
/* 标题区可压缩：窄屏时省略，不把右侧操作挤出屏幕 */
.topbar-title {
  min-width: 0;
  overflow: hidden;
}
.topbar-title .n-breadcrumb {
  white-space: nowrap;
}
.topbar-actions {
  display: flex;
  flex: none;
  align-items: center;
  gap: 8px;
}
/* 顶栏弱图标按钮（移动端导航开关） */
.menu-toggle {
  display: grid;
  flex: none;
  width: 40px;
  height: 40px;
  place-items: center;
  border: 1px solid transparent;
  border-radius: 10px;
  color: var(--color-text);
  background: transparent;
  cursor: pointer;
  transition:
    background-color 0.2s ease,
    border-color 0.2s ease;
}
.menu-toggle:hover,
.menu-toggle:focus-visible {
  border-color: var(--color-primary-border);
  background: var(--color-primary-soft);
  outline: none;
}
.user-menu-trigger {
  min-height: 44px;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 6px 13px 6px 15px;
  border: 1px solid transparent;
  border-radius: 12px;
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
.user-summary {
  display: grid;
  gap: 2px;
  min-width: 96px;
  text-align: left;
}
.user-name {
  color: var(--color-text-strong);
  font-size: 14px;
  font-weight: 600;
  line-height: 1.25;
}
.user-role {
  color: var(--color-text-muted);
  font-size: 12px;
  line-height: 1.25;
}
.user-menu-caret {
  width: 7px;
  height: 7px;
  margin-top: -3px;
  border-right: 1.5px solid var(--color-text-muted);
  border-bottom: 1.5px solid var(--color-text-muted);
  transform: rotate(45deg);
}
.app-content {
  padding: 24px 28px 32px;
  background: var(--page-glow), var(--color-bg);
}
/* 抽屉内导航 */
.drawer-brand {
  display: flex;
  height: 68px;
  align-items: center;
  gap: 10px;
  padding: 0 18px;
  border-bottom: 1px solid var(--color-border-subtle);
  color: var(--color-text-strong);
  font-size: 17px;
  font-weight: 650;
  white-space: nowrap;
}
.drawer-menu {
  padding-top: 8px;
}
/* 移动端（≤768px）顶栏与内容区适配 */
@media (max-width: 768px) {
  .topbar {
    height: 56px;
    padding: 0 12px;
  }
  .user-summary {
    min-width: 0;
  }
  .app-content {
    padding: 16px 14px 24px;
  }
}
</style>
