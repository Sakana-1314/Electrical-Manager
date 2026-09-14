<script setup lang="ts">
import { computed } from 'vue'
import { NTag } from 'naive-ui'
import type { HazardStatus } from '@/api/generated'
import { hazardStatusTypes } from '@/utils/hazard'

const props = defineProps<{ status: HazardStatus }>()

const type = computed(() => hazardStatusTypes[props.status] ?? 'default')
</script>

<template>
  <n-tag size="small" round :bordered="false" :type="type">{{ status }}</n-tag>
</template>
