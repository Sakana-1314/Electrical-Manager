<script setup lang="ts">
import { computed, h, ref, type Component as VueComponent } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { NIcon, type MenuOption } from 'naive-ui'
import {
  AlertCircleOutline,
  ArrowDownCircleOutline,
  ArrowUpCircleOutline,
  BarcodeOutline,
  BusinessOutline,
  CalendarOutline,
  CartOutline,
  ClipboardOutline,
  CubeOutline,
  DocumentTextOutline,
  FolderOpenOutline,
  GridOutline,
  InformationCircleOutline,
  LinkOutline,
  LogOutOutline,
  MenuOutline,
  MoonOutline,
  OptionsOutline,
  PeopleOutline,
  PhonePortraitOutline,
  ReceiptOutline,
  SearchOutline,
  SettingsOutline,
  SunnyOutline,
  SwapHorizontalOutline,
} from '@vicons/ionicons5'
import { useMediaQuery } from '@vueuse/core'
import { useAuthStore } from '@/stores/auth'
import { useSettingsStore } from '@/stores/settings'
import { useThemeStore } from '@/stores/theme'
import { roleLabels } from '@/types/navigation'
import {
  appearanceButtonLabel,
  buildThemeMenuGroup,
  isThemeModeKey,
} from '@/layouts/appearanceMenu'
import { LOGO_URL } from '@/constants/branding'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
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

const link = (label: string, name: string, icon: VueComponent) => ({
  label: () => h(RouterLink, { to: { name }, onClick: closeDrawer }, { default: () => label }),
  key: name,
  icon: renderIcon(icon),
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
        link('库存查询', 'stock', SearchOutline),
        link('物资档案', 'stock-materials', FolderOpenOutline),
        link('操作记录', 'operations', SwapHorizontalOutline),
        ...(auth.can('warehouse:write')
          ? [
              link('入库', 'inbound', ArrowDownCircleOutline),
              link('出库', 'outbound', ArrowUpCircleOutline),
            ]
          : []),
      ],
    })
  }
  items.push(link('华星总库存', 'hua-xing-stock', BusinessOutline))
  items.push({
    label: '申购管理',
    key: 'procurement-group',
    icon: renderIcon(CartOutline),
    children: [
      link('申购计划', 'purchase-materials', ClipboardOutline),
      link('周期性计划', 'purchase-plan-templates', CalendarOutline),
      link('未编码物资', 'uncoded-materials', AlertCircleOutline),
      link('物料编码库', 'material-code-library', BarcodeOutline),
      link('申购记录', 'purchase-records', ReceiptOutline),
    ],
  })
  if (auth.can('settings:write'))
    items.push({
      label: '系统管理',
      key: 'settings-group',
      icon: renderIcon(SettingsOutline),
      children: [
        link('管理端用户', 'users', PeopleOutline),
        link('小程序用户', 'mini-program-users', PhonePortraitOutline),
        link('高级设置', 'advanced-settings', OptionsOutline),
        link('分享链接', 'share-links', LinkOutline),
        link('关于', 'about', InformationCircleOutline),
      ],
    })
  return items
})

function logout() {
  auth.logout()
  void router.push({ name: 'login' })
}

/* ============ 顶栏用户下拉：外观（自动 / 浅色 / 深色） ============
 * 一级分组为「外观」，二级菜单是三个档位；当前档位显示对勾，
 * 顶栏按钮图标同步反映当前实际外观（跟随系统的深色也显示月亮）——
 * 这样不展开菜单也能一眼看出当前是深色还是浅色。菜单结构在 appearanceMenu.ts（有单测）。 */

const currentThemeIcon = computed(() => (theme.isDark ? MoonOutline : SunnyOutline))
const currentThemeLabel = computed(() => appearanceButtonLabel(theme.mode, theme.isDark))

/** 顶栏快捷切换：只切明暗——当前是深色就固定浅色，当前是浅色就固定深色（含「自动」档下的实际外观）。 */
function toggleAppearance() {
  theme.setMode(theme.isDark ? 'light' : 'dark')
}

const userMenuOptions = computed<MenuOption[]>(() => [
  ...buildThemeMenuGroup(theme.mode, renderIcon),
  { type: 'divider', key: 'logout-divider' },
  { label: '退出登录', key: 'logout', icon: renderIcon(LogOutOutline) },
])

/** 用户菜单选择：退出登录 + 外观三档（key 与档位同名）。 */
function onUserMenuSelect(key: string) {
  if (key === 'logout') {
    logout()
    return
  }
  if (isThemeModeKey(key)) theme.setMode(key)
}
</script>

<template>
  <n-layout :has-sider="!isMobile" class="app-shell">
    <n-layout-sider
      v-if="!isMobile"
      bordered
      collapse-mode="width"
      :collapsed-width="64"
      :width="220"
      :collapsed="collapsed"
      show-trigger
      @collapse="collapsed = true"
      @expand="collapsed = false"
    >
      <div class="brand" :class="{ compact: collapsed }">
        <img class="brand-mark" :src="LOGO_URL" alt="系统 Logo" />
        <span v-if="!collapsed">电气车间备件</span>
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
          <n-breadcrumb>
            <n-breadcrumb-item v-if="!isMobile">备件管理</n-breadcrumb-item>
            <n-breadcrumb-item>{{ route.meta.title }}</n-breadcrumb-item>
          </n-breadcrumb>
        </div>
        <div class="topbar-actions">
          <!-- 外观快捷切换：只做明暗切换，档位（自动 / 浅色 / 深色）在用户菜单的「外观」二级菜单里选 -->
          <n-tooltip :delay="300">
            <template #trigger>
              <button
                type="button"
                class="appearance-toggle"
                :aria-label="currentThemeLabel"
                @click="toggleAppearance"
              >
                <n-icon :size="20"><component :is="currentThemeIcon" /></n-icon>
              </button>
            </template>
            {{ currentThemeLabel }}
          </n-tooltip>
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
      <span>电气车间备件</span>
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
  padding: 0 16px;
  border-bottom: 1px solid var(--color-border-subtle);
  color: var(--color-text-strong);
  font-size: 17px;
  font-weight: 650;
  white-space: nowrap;
}
.brand.compact {
  justify-content: center;
  padding: 0;
}
.brand-mark {
  width: 34px;
  height: 34px;
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
.topbar-actions {
  display: flex;
  flex: none;
  align-items: center;
  gap: 8px;
}
/* 顶栏弱图标按钮（导航开关、外观切换）共用一套观感 */
.menu-toggle,
.appearance-toggle {
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
.menu-toggle:focus-visible,
.appearance-toggle:hover,
.appearance-toggle:focus-visible {
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
