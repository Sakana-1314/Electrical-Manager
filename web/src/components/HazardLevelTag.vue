<script setup lang="ts">
import { computed } from 'vue'
import { NTag } from 'naive-ui'
import type { HazardLevel } from '@/api/generated'
import { hazardLevelTypes } from '@/utils/hazard'

const props = defineProps<{ level: HazardLevel }>()

const type = computed(() => hazardLevelTypes[props.level] ?? 'info')
</script>

<template>
  <n-tag size="small" :bordered="false" :type="type">{{ level }}</n-tag>
</template>
