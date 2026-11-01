<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import type { StockMaterial } from '@/api/generated'
import { inventoryApi } from '@/api/inventory'
import { fetchDefaultStockMaterials, fetchStockMaterial } from '@/utils/stockMaterialCache'

const props = defineProps<{
  value: number | null
  disabled?: boolean
  excludeIds?: number[]
  /** 已选物资（调用方手里已有时传入，省去按 id 反查） */
  selected?: StockMaterial | null
}>()
const emit = defineEmits<{
  'update:value': [value: number | null]
  select: [material?: StockMaterial]
}>()
const materials = ref<StockMaterial[]>([])
/** 当前值对应的物资：搜索结果里可能不含它，单独留一份，保证选择框始终显示名称而不是裸 id */
const resolved = ref<StockMaterial | null>(props.selected ?? null)
const loading = ref(false)
const keyword = ref('')
let seq = 0

const options = computed(() => {
  const list = [...materials.value]
  const current = resolved.value
  if (current && current.id === props.value && !list.some((x) => x.id === current.id)) {
    list.unshift(current)
  }
  return list
    .filter((x) => x.id === props.value || !props.excludeIds?.includes(x.id))
    .map((x) => ({
      label: `${x.name}｜${x.model_spec}`,
      value: x.id,
    }))
})

/**
 * 默认列表（无关键词）走模块级短时缓存：同一张单据里每行一个选择器，原来 10 行就是 10 个
 * 相同的 200 条请求；现在同一时段只发一次。带关键词的搜索按请求序号丢弃过期响应，
 * 避免先发后到的旧结果覆盖新输入。
 */
async function load(term = '') {
  const current = ++seq
  loading.value = true
  try {
    const items = term
      ? (await inventoryApi.materials({ page_size: 200, keyword: term })).items
      : await fetchDefaultStockMaterials()
    if (current === seq) materials.value = items
  } catch {
    if (current === seq) materials.value = []
  } finally {
    if (current === seq) loading.value = false
  }
}
const debouncedLoad = useDebounceFn((term: string) => load(term), 300)
function onSearch(term: string) {
  keyword.value = term
  void debouncedLoad(term)
}

async function resolveCurrent(value: number | null) {
  if (!value) {
    resolved.value = null
    return
  }
  if (resolved.value?.id === value) return
  const known =
    props.selected?.id === value ? props.selected : materials.value.find((x) => x.id === value)
  if (known) {
    resolved.value = known
    return
  }
  try {
    const material = await fetchStockMaterial(value)
    if (props.value === value) resolved.value = material
  } catch {
    // 物资已被删除等情况：保持原样，选择框会显示 id，提交时由服务端校验
  }
}
watch(
  () => [props.value, props.selected] as const,
  ([value]) => void resolveCurrent(value),
  { immediate: true },
)

function update(value: number | null) {
  const material =
    materials.value.find((x) => x.id === value) ??
    (resolved.value?.id === value ? resolved.value : undefined)
  resolved.value = material ?? null
  emit('update:value', value)
  emit('select', material)
}
/** 只读态不需要候选列表；可编辑时挂载即预取（共享缓存，不会每行各发一次） */
function ensureOptions() {
  if (!materials.value.length && !keyword.value) void load()
}
onMounted(() => {
  if (!props.disabled) ensureOptions()
})
</script>

<template>
  <n-select
    :value="value"
    :options="options"
    :loading="loading"
    :disabled="disabled"
    filterable
    remote
    clearable
    placeholder="选择二级库物资，可按名称 / 型号搜索"
    @focus="ensureOptions"
    @search="onSearch"
    @update:value="update"
  />
</template>
