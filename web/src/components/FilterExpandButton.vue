<script setup lang="ts">
import { NButton } from 'naive-ui'

/**
 * 筛选区折叠开关（桌面端与移动端同一套机制，可见数量由全局样式按断点决定）。
 * - 折叠态只展示前 N 个筛选项（桌面端 6 个、手机端 2 个，见 `styles.css` 的
 *   `.filter-grid.is-collapsed` 规则），点击在「更多筛选 / 收起筛选」间切换。
 * - 页面只负责把 `is-collapsed`（即 `!filterExpanded`）绑到 `.filter-grid` 上。
 * - 筛选项不超过该断点上限时页面仍可渲染本按钮，全局样式会自动隐藏它。
 */
defineProps<{ expanded: boolean }>()
const emit = defineEmits<{ 'update:expanded': [value: boolean] }>()
</script>

<template>
  <NButton
    size="small"
    quaternary
    class="filter-collapse-btn"
    :aria-expanded="expanded"
    @click="emit('update:expanded', !expanded)"
  >
    <template #icon>
      <svg
        class="filter-collapse-chevron"
        :class="{ 'is-expanded': expanded }"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <path d="M6 9l6 6 6-6" />
      </svg>
    </template>
    {{ expanded ? '收起筛选' : '更多筛选' }}
  </NButton>
</template>

<style scoped>
.filter-collapse-chevron {
  transition: transform 0.2s ease;
}
.filter-collapse-chevron.is-expanded {
  transform: rotate(180deg);
}
</style>
