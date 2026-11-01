<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import { type MenuOption } from 'naive-ui'
import { MenuOutline } from '@vicons/ionicons5'
import { useMediaQuery } from '@vueuse/core'
import { useAuthStore } from '@/stores/auth'
import { useSettingsStore } from '@/stores/settings'
import { buildMainMenu } from '@/layouts/mainMenu'
import UserMenu from '@/layouts/UserMenu.vue'
import { LOGO_MARK_URL } from '@/constants/branding'

const route = useRoute()
const auth = useAuthStore()
const settings = useSettingsStore()
const collapsed = ref(false)
// 移动端断点：≤768px 时侧边栏切换为抽屉导航
const isMobile = useMediaQuery('(max-width: 768px)')
const drawerOpen = ref(false)
const closeDrawer = () => {
  drawerOpen.value = false
}

/**
 * 导航项在 `layouts/mainMenu.ts` 里拼装（纯逻辑，有单测）：
 * 一级项按权限、二级库模式与「后台可见功能」开关过滤，系统管理始终显示。
 */
const menuOptions = computed<MenuOption[]>(() =>
  buildMainMenu({
    isLiteMode: settings.isLiteMode,
    can: (permission) => auth.can(permission),
    isFeatureVisible: (key) => settings.isFeatureVisible(key),
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
        :collapsed-icon-size="22"
        :options="menuOptions"
        :value="String(route.name || '')"
      />
      <!-- 用户菜单固定在侧栏左下角：外观（自动 / 浅色 / 深色）+ 项目切换 + 退出登录 -->
      <div class="sider-user">
        <UserMenu :collapsed="collapsed" />
      </div>
    </n-layout-sider>
    <n-layout>
      <!-- 桌面端无顶栏：内容区直接从页面标题开始，页面标题由各视图的 .page-header 承担。
           移动端没有侧栏，抽屉需要一个入口，因此只保留一条窄导航条（菜单按钮 + 当前页标题），
           不再放用户信息——账号入口统一在抽屉左下角。 -->
      <n-layout-header v-if="isMobile" bordered class="mobile-topbar">
        <button
          type="button"
          class="menu-toggle"
          aria-label="打开导航菜单"
          @click="drawerOpen = true"
        >
          <n-icon :size="20"><MenuOutline /></n-icon>
        </button>
        <div class="mobile-title">{{ route.meta.title }}</div>
      </n-layout-header>
      <n-layout-content class="app-content" :native-scrollbar="false">
        <!-- keepAlive 列表页最多缓存 6 个（两个申购列表页各约 2000 行、表格数据量大），超出按最久未用淘汰；
             筛选与页码都在 URL 里，被淘汰的页重新进入时可完整恢复。
             非缓存页同样按路由名加 key：入库 / 出库共用 OperationEditorView，不加 key 时侧栏从入库切到出库
             会复用同一实例，入库草稿（明细、用途、时间）原样带进出库表单。 -->
        <router-view v-slot="{ Component, route: currentRoute }">
          <keep-alive :max="6">
            <component
              :is="Component"
              v-if="currentRoute.meta.keepAlive"
              :key="String(currentRoute.name)"
            />
          </keep-alive>
          <component
            :is="Component"
            v-if="!currentRoute.meta.keepAlive"
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
  padding: 24px 28px 32px;
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
/* 移动端窄导航条：唯一作用是给抽屉一个入口，并显示当前页标题（内容区不再重复标题） */
.mobile-topbar {
  display: flex;
  height: 56px;
  align-items: center;
  gap: 8px;
  padding: 0 12px;
  background: var(--color-surface-translucent);
  backdrop-filter: blur(12px);
}
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
.mobile-title {
  min-width: 0;
  overflow: hidden;
  color: var(--color-text-strong);
  font-size: 16px;
  font-weight: 600;
  line-height: 1.25;
  text-overflow: ellipsis;
  white-space: nowrap;
}
/* 移动端（≤768px）内容区适配 */
@media (max-width: 768px) {
  .app-content {
    padding: 16px 14px 24px;
  }
}
</style>
