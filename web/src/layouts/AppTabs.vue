<script setup lang="ts">
import { computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { CloseOutline, EllipsisHorizontal } from '@vicons/ionicons5'
import {
  activateTab,
  closeAllTabs,
  closeAppTab,
  closeOtherTabs,
  isTabRoute,
  trackRoute,
  useAppTabs,
} from '@/composables/useAppTabs'

/**
 * 顶部标签栏（就是导航条本身，不再单独显示页面名）。
 *
 * 每个打开过的页面一枚等宽标签（文字区 8 个中文字宽），标题超长省略；
 * 页面实例由 AppLayout 的 keep-alive 保留，切标签不重新请求数据。
 * 交互：点击切换、点「×」关闭（只剩一枚时不可关闭）、鼠标中键关闭。
 *
 * 当前页不是标签页（入库 / 出库这类单据页）时，在末尾补一枚不可关闭的当前页签，
 * 导航条才不会出现「没有任何标签是激活的」而看不出自己在哪。
 */
const route = useRoute()
const router = useRouter()
const { tabs, activeKey } = useAppTabs()

// 每次路由变化同步标签：打开 / 更新当前标签；离开到公共页时取消激活态
watch(
  () => route.fullPath,
  () => trackRoute(route),
  { immediate: true },
)

/** 当前页不是标签页时，它的页面名（作为不可关闭的临时签显示）。 */
const currentChip = computed(() => {
  if (isTabRoute(route)) return null
  const title = route.meta.title
  return typeof title === 'string' && title ? title : null
})

function onAuxClick(event: MouseEvent, key: string) {
  if (event.button !== 1) return
  event.preventDefault()
  closeAppTab(router, key)
}

/** 首个标签前的「⋯」菜单：批量关闭标签。 */
const menuOptions = computed(() => [
  { label: '关闭其他标签页', key: 'others', disabled: tabs.value.length <= 1 },
  { label: '关闭所有标签页', key: 'all', disabled: tabs.value.length === 0 },
])

function onMenuSelect(key: string) {
  if (key === 'others') closeOtherTabs()
  else if (key === 'all') closeAllTabs(router)
}
</script>

<template>
  <div class="app-tabs" role="tablist" aria-label="已打开的页面">
    <n-dropdown trigger="click" :options="menuOptions" @select="onMenuSelect">
      <button type="button" class="app-tabs-more" aria-label="标签页操作">
        <n-icon :size="16"><EllipsisHorizontal /></n-icon>
      </button>
    </n-dropdown>
    <div
      v-for="tab in tabs"
      :key="tab.key"
      class="app-tab"
      :class="{ 'is-active': tab.key === activeKey }"
      role="tab"
      :aria-selected="tab.key === activeKey"
      :title="tab.title"
      tabindex="0"
      @click="activateTab(router, tab.key)"
      @keydown.enter.prevent="activateTab(router, tab.key)"
      @keydown.space.prevent="activateTab(router, tab.key)"
      @auxclick="onAuxClick($event, tab.key)"
    >
      <span class="app-tab-label">{{ tab.title }}</span>
      <button
        v-if="tabs.length > 1"
        type="button"
        class="app-tab-close"
        :aria-label="`关闭 ${tab.title}`"
        @click.stop="closeAppTab(router, tab.key)"
      >
        <n-icon :size="12"><CloseOutline /></n-icon>
      </button>
    </div>
    <!-- 当前页不是标签页（单据页）：临时签，不可关闭、不参与标签列表 -->
    <div
      v-if="currentChip"
      class="app-tab app-tab--current is-active"
      :title="currentChip"
      :aria-current="'page'"
    >
      <span class="app-tab-label">{{ currentChip }}</span>
    </div>
  </div>
</template>

<style scoped>
/* 导航条本体即标签栏：不设背景、不在上下方向留内边距，标签撑满整条高度（扁平样式）。
   等宽：标签宽度押在「文字区正好放下 8 个中文字」上——1 个中文字 = 1em（= 标签字号 13px），
   所以文字区 8em = 104px，再加右侧关闭按钮 18px 与左右内边距，
   用固定 width 保证每枚完全一致；标题过长一律省略号，绝不被内容撑宽。
   字号变了只需改 --app-tab-font-size，宽度与文字区会一起跟着变。 */
.app-tabs {
  --app-tab-font-size: var(--list-body-size);
  /* 文字区：8 个中文字宽 */
  --app-tab-text-width: 8em;
  /* 左右装饰：左内边距 12px + 关闭按钮 18px + 右内边距 4px */
  --app-tab-decoration-width: 34px;
  /* 标签之间的横向间距 */
  --app-tab-gap: 4px;
  display: flex;
  flex: 1;
  min-width: 0;
  height: 100%;
  align-items: stretch;
  /* 标签之间留横向间距：相邻色块不相连，激活标签的「贴页」形状也看得清 */
  gap: var(--app-tab-gap);
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: none;
}
.app-tabs::-webkit-scrollbar {
  display: none;
}
/* 首个标签前的「⋯」批量操作入口：与标签同高同形（上圆下直），不参与标签列表 */
.app-tabs-more {
  display: grid;
  flex: none;
  width: 28px;
  place-items: center;
  padding: 0;
  border: 0;
  border-radius: 8px 8px 0 0;
  color: var(--color-text-muted);
  background: transparent;
  cursor: pointer;
  transition:
    background-color 0.16s ease,
    color 0.16s ease;
}
.app-tabs-more:hover,
.app-tabs-more:focus-visible {
  background: var(--color-panel);
  color: var(--color-text);
  outline: none;
}
/* 标签形状：上方两角圆、底部两角是直角——激活标签贴着页面，不是四角圆角块。
   激活态靠颜色区分：底色取页面背景（与下方内容区同色），文字用主题色。
   底部再用 1px 同色阴影盖住导航条的下边框，激活标签与页面背景无缝连成一片。 */
.app-tab {
  display: flex;
  flex: none;
  width: calc(var(--app-tab-text-width) + var(--app-tab-decoration-width));
  align-items: center;
  gap: 4px;
  padding: 0 4px 0 12px;
  border-radius: 8px 8px 0 0;
  color: var(--color-text-muted);
  font-size: var(--app-tab-font-size);
  line-height: 1;
  cursor: pointer;
  transition:
    background-color 0.16s ease,
    color 0.16s ease;
}
.app-tab:not(.is-active):hover {
  background: var(--color-panel);
  color: var(--color-text);
}
.app-tab:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: -2px;
}
.app-tab.is-active {
  background: var(--color-bg);
  box-shadow: 0 1px 0 var(--color-bg);
  color: var(--color-primary);
  font-weight: 600;
}
/* 单据页的临时签：与标签同宽同高，不可关闭、不参与标签列表 */
.app-tab--current {
  cursor: default;
}
.app-tab-label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.app-tab-close {
  display: grid;
  flex: none;
  width: 18px;
  height: 18px;
  place-items: center;
  padding: 0;
  border: 0;
  border-radius: 4px;
  color: inherit;
  background: transparent;
  cursor: pointer;
  opacity: 0.65;
}
.app-tab-close:hover {
  background: rgb(127 139 158 / 18%);
  opacity: 1;
}
</style>
