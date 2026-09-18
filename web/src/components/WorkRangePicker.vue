<script setup lang="ts">
/**
 * 工作管理的日期区间选择器：日期区间 + 快捷档（今天 / 本周 / 下周 / 本月 / 上月）。
 *
 * 三个视图（工作总览 / 任务视图 / 人员视图）共用。区间超过 `WORK_RANGE_MAX_DAYS` 天时
 * 就地收窄（保留结束日期）并提示——后端同样会拦（400 `WORK_RANGE_TOO_LONG`），
 * 这里先兜住，避免用户填完才发现查不了。
 */
import { computed } from 'vue'
import { NButton, NDatePicker, useMessage } from 'naive-ui'
import { dateToTimestamp, toShanghaiDate } from '@/utils/time'
import {
  clampWorkRange,
  shanghaiToday,
  workRangePresets,
  WORK_RANGE_MAX_DAYS,
  type WorkRange,
  type WorkRangePreset,
} from '@/utils/work'

const props = withDefaults(defineProps<{ modelValue: WorkRange; disabled?: boolean }>(), {
  disabled: false,
})

const emit = defineEmits<{ 'update:modelValue': [value: WorkRange] }>()

const message = useMessage()
const today = shanghaiToday()

/** 区间 → 日期选择器需要的东八区当日零点时间戳对。 */
const timestampRange = computed<[number, number] | null>(() => {
  const start = dateToTimestamp(props.modelValue.start)
  const end = dateToTimestamp(props.modelValue.end)
  return start !== null && end !== null ? [start, end] : null
})

function applyRange(range: WorkRange): void {
  const clamped = clampWorkRange(range)
  if (clamped.start !== range.start) {
    message.warning(`查询区间最长 ${WORK_RANGE_MAX_DAYS} 天，开始日期已收窄到 ${clamped.start}`)
  }
  emit('update:modelValue', clamped)
}

function onDateChange(value: [number, number] | null): void {
  if (!value) return
  applyRange({ start: toShanghaiDate(value[0]), end: toShanghaiDate(value[1]) })
}

function isActive(preset: WorkRangePreset): boolean {
  const range = preset.range(today)
  return range.start === props.modelValue.start && range.end === props.modelValue.end
}

function applyPreset(preset: WorkRangePreset): void {
  applyRange(preset.range(today))
}
</script>

<template>
  <div class="work-range-picker">
    <n-date-picker
      :value="timestampRange"
      type="daterange"
      :disabled="disabled"
      :clearable="false"
      update-value-on-close
      @update:value="onDateChange"
    />
    <div class="range-presets">
      <n-button
        v-for="preset in workRangePresets"
        :key="preset.label"
        size="small"
        :ghost="!isActive(preset)"
        :type="isActive(preset) ? 'primary' : 'default'"
        :disabled="disabled"
        @click="applyPreset(preset)"
      >
        {{ preset.label }}
      </n-button>
    </div>
  </div>
</template>

<style scoped>
.work-range-picker {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.range-presets {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
</style>
