<script setup lang="ts">
import { NSelect, type SelectFilter, type SelectOption } from 'naive-ui'
import { pinyinSelectFilter } from '@/utils/pinyinFilter'

/**
 * 带拼音筛选的 n-select：其余属性与事件全部透传给 n-select。
 * filterable 时除原有文本匹配外，还支持输入全拼（luoshuan）或首字母（ls）。
 */
defineOptions({ inheritAttrs: false })

const props = defineProps<{
  /** 调用方自定义过滤（先执行），命中后再叠加拼音匹配 */
  filter?: SelectFilter | null
}>()

function mergedFilter(pattern: string, option: SelectOption): boolean {
  if (props.filter?.(pattern, option)) return true
  return pinyinSelectFilter(pattern, option)
}
</script>

<template>
  <n-select v-bind="$attrs" :filter="mergedFilter">
    <template v-for="(_, name) in $slots" #[name]="slotProps">
      <slot :name="name" v-bind="slotProps ?? {}" />
    </template>
  </n-select>
</template>
