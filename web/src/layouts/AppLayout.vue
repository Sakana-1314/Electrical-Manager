<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, type RouteLocationNormalizedLoaded } from 'vue-router'
import { type MenuOption } from 'naive-ui'
import { MenuOutline } from '@vicons/ionicons5'
import { useMediaQuery } from '@vueuse/core'
import { useAuthStore } from '@/stores/auth'
import { buildMainMenu } from '@/layouts/mainMenu'
import AppTabs from '@/layouts/AppTabs.vue'
import UserMenu from '@/layouts/UserMenu.vue'
import { LOGO_MARK_URL } from '@/constants/branding'
import { isTabRoute, MAX_APP_TABS, useAppTabs } from '@/composables/useAppTabs'

const route = useRoute()
const auth = useAuthStore()
const collapsed = ref(false)
// 移动端断点：≤768px 时侧边栏切换为抽屉导航
const isMobile = useMediaQuery('(max-width: 768px)')
const drawerOpen = ref(false)
const closeDrawer = () => {
  drawerOpen.value = false
}

const { tabCacheKey, tabs } = useAppTabs()

/** 当前页是否作为标签页打开（决定走 keep-alive 还是每次重新挂载）。 */
function isTabPage(current: RouteLocationNormalizedLoaded): boolean {
  return isTabRoute(current) && typeof current.name === 'string'
}

/** 已经有标签（或当前页本身是标签页）就显示标签栏；登录 / 分享等公共页不显示。 */
const tabbed = computed(() => tabs.value.length > 0 || isTabPage(route))

/**
 * 导航项在 `layouts/mainMenu.ts` 里拼装（纯逻辑，有单测）：
 * 一级项按权限位过滤，系统管理按 system:admin 权限显示。
 */
const menuOptions = computed<MenuOption[]>(() =>
  buildMainMenu({
    can: (permission) => auth.can(permission),
    onNavigate: closeDrawer,
  }),
)

/**
 * 侧栏与移动抽屉都改成纵向弹性容器：品牌行、菜单、左下角用户菜单三段。
 * 覆盖 Naive UI 滚动容器自带的 `overflow: auto`，让滚动只发生在菜单区，
 * 用户菜单固定在左下角、不随菜单滚走。
 */
const panelColumnStyle = { display: 'flex', flexDirection: 'column', overflow: 'hidden' }
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
      :content-style="panelColumnStyle"
      show-trigger
      @collapse="collapsed = true"
      @expand="collapsed = false"
    >
      <div class="brand" :class="{ compact: collapsed }">
        <img class="brand-mark" :src="LOGO_MARK_URL" alt="系统 Logo" />
        <span v-if="!collapsed">HXNI 电气无忧</span>
      </div>
      <n-menu
        class="sider-menu"
        :collapsed="collapsed"
        :collapsed-width="64"
        :icon-size="16"
        :collapsed-icon-size="18"
        :options="menuOptions"
        :value="String(route.name || '')"
      />
      <!-- 用户菜单固定在侧栏左下角：外观（自动 / 浅色 / 深色）+ 项目切换 + 退出登录 -->
      <div class="sider-user">
        <UserMenu :collapsed="collapsed" />
      </div>
    </n-layout-sider>
    <n-layout>
      <!-- 顶部导航条：所有视口共用一条很矮的标题条（桌面 40px / 移动端 48px），
           页面名只在这里出现，各视图不再渲染大标题；移动端没有侧栏，
           导航条左侧额外提供抽屉入口。 -->
      <n-layout-header bordered class="app-topbar" :class="{ 'is-mobile': isMobile }">
        <button
          v-if="isMobile"
          type="button"
          class="menu-toggle"
          aria-label="打开导航菜单"
          @click="drawerOpen = true"
        >
          <n-icon :size="18"><MenuOutline /></n-icon>
        </button>
        <div class="topbar-title">{{ route.meta.title }}</div>
      </n-layout-header>
      <!-- 顶部标签页：每个打开过的页面一枚等宽标签，切标签走 keep-alive 不重新加载数据 -->
      <AppTabs v-if="tabbed" />
      <n-layout-content class="app-content" :native-scrollbar="false">
        <!-- 标签页里的页面全部 keep-alive（上限与标签数一致，均为 8）：
             切标签只做激活 / 停用，不重新挂载、不重新请求数据；
             关闭标签或超限淘汰时把实例代号 +1，下次打开是干净的新实例。
             非标签页（登录、分享、入库 / 出库单据）不进缓存，保持原有每次进入重新初始化。
             缓存键按「页面名 + 实例代号」：入库 / 出库共用 OperationEditorView 时也不会互相串数据。 -->
        <router-view v-slot="{ Component, route: currentRoute }">
          <keep-alive :max="MAX_APP_TABS">
            <component
              :is="Component"
              v-if="isTabPage(currentRoute)"
              :key="tabCacheKey(String(currentRoute.name))"
            />
          </keep-alive>
          <component
            :is="Component"
            v-if="!isTabPage(currentRoute)"
            :key="String(currentRoute.name)"
          />
        </router-view>
      </n-layout-content>
    </n-layout>
  </n-layout>

  <!-- 移动端抽屉导航：底部同样固定用户菜单（与桌面侧栏同一组件） -->
  <n-drawer
    v-model:show="drawerOpen"
    placement="left"
    :width="250"
    :z-index="2000"
    :content-style="panelColumnStyle"
    aria-label="导航菜单"
  >
    <div class="drawer-brand">
      <img class="brand-mark" :src="LOGO_MARK_URL" alt="系统 Logo" />
      <span>HXNI 电气无忧</span>
    </div>
    <n-menu
      class="drawer-menu"
      :icon-size="16"
      :options="menuOptions"
      :value="String(route.name || '')"
      @update:value="closeDrawer"
    />
    <div class="drawer-user">
      <!-- 抽屉内的下拉浮层挂在 body 上，必须显式高于抽屉（2000），否则会被抽屉与遮罩压住 -->
      <UserMenu :z-index="2001" />
    </div>
  </n-drawer>
</template>

<style scoped>
.app-shell {
  height: 100vh;
  background: var(--color-bg);
}
.brand {
  flex: none;
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
/* 菜单区独占剩余高度并自行滚动：用户菜单始终贴在左下角 */
.sider-menu {
  flex: 1 1 auto;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  padding-bottom: 8px;
}
.sider-user {
  flex: none;
  padding: 8px 10px 12px;
  border-top: 1px solid var(--color-border-subtle);
}
.app-content {
  padding: 16px 28px 32px;
  background: var(--page-glow), var(--color-bg);
}
/* 抽屉内导航 */
.drawer-brand {
  display: flex;
  flex: none;
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
  flex: 1 1 auto;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  padding: 8px 0;
}
.drawer-user {
  flex: none;
  padding: 10px 12px calc(12px + env(safe-area-inset-bottom));
  border-top: 1px solid var(--color-border-subtle);
}
/* 顶部导航条：很矮的一条，只展示当前页标题；桌面端与内容区左右内边距对齐。
   内容区在导航条下方独立滚动，因此标题始终可见。 */
.app-topbar {
  display: flex;
  height: 40px;
  align-items: center;
  gap: 8px;
  padding: 0 28px;
  background: var(--color-surface-translucent);
  backdrop-filter: blur(12px);
}
.menu-toggle {
  display: grid;
  flex: none;
  width: 36px;
  height: 36px;
  place-items: center;
  border: 1px solid transparent;
  border-radius: 9px;
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
.topbar-title {
  min-width: 0;
  overflow: hidden;
  color: var(--color-text-strong);
  font-size: 13px;
  font-weight: 600;
  line-height: 1.25;
  text-overflow: ellipsis;
  white-space: nowrap;
}
/* 移动端（≤768px）内容区适配 */
@media (max-width: 768px) {
  /* 触摸目标留 40px，导航条只比桌面高 8px */
  .app-topbar.is-mobile {
    height: 48px;
    padding: 0 12px;
  }
  .menu-toggle {
    width: 40px;
    height: 40px;
  }
  .topbar-title {
    font-size: 15px;
  }
  .app-content {
    padding: 12px 14px 24px;
  }
}
</style>
