<script setup lang="ts">
import { computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { CloseOutline } from '@vicons/ionicons5'
import {
  activateTab,
  closeAppTab,
  isTabRoute,
  trackRoute,
  useAppTabs,
} from '@/composables/useAppTabs'

/**
 * 顶部标签页栏：每个打开过的页面一枚标签，宽度完全一致（8 个中文字宽），
 * 标题超长省略。页面实例由 AppLayout 的 keep-alive 保留，切标签不重新请求数据。
 * 交互：点击切换、点「×」关闭（只剩一枚时不可关闭）、鼠标中键关闭。
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

/** 有标签、或当前页本身是标签页时才显示标签栏（登录 / 分享页不显示）。 */
const visible = computed(() => tabs.value.length > 0 || isTabRoute(route))

function onAuxClick(event: MouseEvent, key: string) {
  if (event.button !== 1) return
  event.preventDefault()
  closeAppTab(router, key)
}
</script>

<template>
  <div v-if="visible" class="app-tabs" role="tablist" aria-label="已打开的页面">
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
  </div>
</template>

<style scoped>
/* 标签栏紧贴顶部导航条下方，左右内边距与内容区对齐。
   等宽：标签宽度押在「文字区正好放下 8 个中文字」上——1 个中文字 = 1em（= 标签字号 13px），
   所以文字区 8em = 104px，再加左侧 10px、右侧关闭按钮 18px 与其内边距，
   用固定 width 保证每枚完全一致；标题过长一律省略号，绝不被内容撑宽。
   字号变了只需改 --app-tab-font-size，宽度与文字区会一起跟着变。 */
.app-tabs {
  --app-tab-font-size: var(--list-body-size);
  /* 文字区：8 个中文字宽 */
  --app-tab-text-width: 8em;
  /* 左右装饰：左内边距 10px + 关闭按钮 18px + 左右内边距 5px */
  --app-tab-decoration-width: 33px;
  display: flex;
  flex: none;
  gap: 4px;
  padding: 0 28px 8px;
  overflow-x: auto;
  overflow-y: hidden;
  background: var(--color-surface-translucent);
  backdrop-filter: blur(12px);
  scrollbar-width: none;
}
.app-tabs::-webkit-scrollbar {
  display: none;
}
.app-tab {
  display: flex;
  flex: none;
  width: calc(var(--app-tab-text-width) + var(--app-tab-decoration-width));
  align-items: center;
  gap: 4px;
  padding: 0 5px 0 10px;
  border: 1px solid transparent;
  border-radius: 7px;
  color: var(--color-text-muted);
  font-size: var(--app-tab-font-size);
  line-height: 26px;
  cursor: pointer;
  transition:
    background-color 0.16s ease,
    border-color 0.16s ease,
    color 0.16s ease;
}
.app-tab:hover {
  border-color: var(--color-border-subtle);
  background: var(--color-panel);
  color: var(--color-text);
}
.app-tab:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 1px;
}
.app-tab.is-active {
  border-color: var(--color-primary-border);
  background: var(--color-primary-soft);
  color: var(--color-text-strong);
  font-weight: 600;
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
  opacity: 0.7;
}
.app-tab-close:hover {
  background: rgb(127 139 158 / 18%);
  opacity: 1;
}
@media (max-width: 768px) {
  .app-tabs {
    padding: 0 12px 6px;
  }
}
</style>
