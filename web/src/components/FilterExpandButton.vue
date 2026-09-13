<script setup lang="ts">
import { NButton } from 'naive-ui'

/**
 * 筛选区折叠开关（桌面端与移动端同一套行为）。
 * - 筛选区默认只展示第一排常用条件，其余扩展字段（`.filter-extras-fields`）收起；
 *   点击在「更多筛选 / 收起筛选」间切换。
 * - 页面没有任何扩展字段时不要渲染本按钮（没有可展开的内容）。
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
