<script setup lang="ts">
import { h, ref, watch } from 'vue'
import { NTag, type DataTableColumns, useMessage } from 'naive-ui'
import type { PurchaseRecord } from '@/api/generated'
import { procurementApi } from '@/api/procurement'
import { createTableRowClickGuard } from '@/utils/tableRowNavigation'
import { renderTwoLineText } from '@/utils/tableText'
import { formatDate } from '@/utils/time'

const props = defineProps<{
  show: boolean
  initialName?: string
  initialMaterialCode?: string
  initialModelSpec?: string
  /** 详情弹窗保存后由父组件自增，触发当前列表刷新。 */
  reloadToken?: number
}>()
const emit = defineEmits<{
  'update:show': [value: boolean]
  select: [record: PurchaseRecord]
  search: [filters: { materialCode: string; name: string; modelSpec: string }]
}>()

const message = useMessage()
const rowClickGuard = createTableRowClickGuard()
const searchMaterialCode = ref('')
const searchName = ref('')
const searchModelSpec = ref('')
const defaultMaterialCode = ref('')
const defaultName = ref('')
const defaultModelSpec = ref('')
const items = ref<PurchaseRecord[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(10)
const loading = ref(false)

const columns: DataTableColumns<PurchaseRecord> = [
  {
    title: '需求日期',
    key: 'plan_date',
    width: 100,
    render: (row) => formatDate(row.plan_date),
  },
  {
    title: '申购日期',
    key: 'purchase_date',
    width: 100,
    render: (row) => formatDate(row.purchase_date ?? undefined),
  },
  {
    title: '物资',
    key: 'material_name',
    minWidth: 200,
    render: (row) =>
      h(
        'div',
        {
          class: 'table-material-summary',
          title: `${row.material_name}\n${row.material_code || '\\'}｜${row.model_spec}`,
        },
        [
          h('div', { class: 'table-material-summary__name' }, row.material_name),
          h(
            'div',
            { class: 'table-material-summary__meta' },
            `${row.material_code || '\\'}｜${row.model_spec}`,
          ),
        ],
      ),
  },
  {
    title: '申购数量',
    key: 'purchase_qty',
    width: 100,
    render: (row) => renderTwoLineText(`${row.purchase_qty} ${row.unit_name}`),
  },
  {
    title: '申购单号',
    key: 'purchase_order_no',
    width: 130,
    render: (row) => renderTwoLineText(row.purchase_order_no, '—'),
  },
  {
    title: '追溯号',
    key: 'trace_no',
    width: 120,
    render: (row) => renderTwoLineText(row.trace_no),
  },
  {
    title: '状态',
    key: 'status',
    width: 90,
    render: (row) => h(NTag, null, { default: () => row.status || '\\' }),
  },
  {
    title: '实际需求人',
    key: 'purchase_responsible',
    width: 110,
    render: (row) => renderTwoLineText(row.purchase_responsible),
  },
  {
    title: '提报员工',
    key: 'actual_demand_person',
    width: 110,
    render: (row) => renderTwoLineText(row.actual_demand_person),
  },
]

/** 整行可点击：交给父组件打开已有的申购记录详情弹窗。 */
function rowProps(row: PurchaseRecord) {
  return {
    style: 'cursor: pointer',
    onMousedown: rowClickGuard.onMouseDown,
    onClick: (event: MouseEvent) => {
      if (rowClickGuard.shouldIgnore(event)) return
      emit('select', row)
    },
  }
}

function currentSearch() {
  return {
    materialCode: searchMaterialCode.value.trim(),
    name: searchName.value.trim(),
    modelSpec: searchModelSpec.value.trim(),
  }
}

async function load() {
  loading.value = true
  try {
    const materialCode = searchMaterialCode.value.trim()
    const result = await procurementApi.records({
      name: searchName.value.trim() || undefined,
      model_spec: searchModelSpec.value.trim() || undefined,
      // 按物料编码查同编码的历史申购记录；后端 search_field / search_value 成对生效。
      search_field: materialCode ? 'material_code' : undefined,
      search_value: materialCode || undefined,
      page: page.value,
      page_size: pageSize.value,
    })
    items.value = result.items
    total.value = result.total
  } catch (error) {
    message.error(error instanceof Error ? error.message : '加载历史申购记录失败')
  } finally {
    loading.value = false
  }
}

function open() {
  defaultMaterialCode.value = props.initialMaterialCode?.trim() || ''
  defaultName.value = props.initialName?.trim() || ''
  defaultModelSpec.value = props.initialModelSpec?.trim() || ''
  restoreFilters()
  page.value = 1
  void load()
}

function restoreFilters() {
  searchMaterialCode.value = defaultMaterialCode.value
  searchName.value = defaultName.value
  searchModelSpec.value = defaultModelSpec.value
}

function search() {
  page.value = 1
  emit('search', currentSearch())
  void load()
}

function clearSearch() {
  searchMaterialCode.value = ''
  searchName.value = ''
  searchModelSpec.value = ''
  search()
}

function resetSearch() {
  restoreFilters()
  search()
}

function changePageSize(value: number) {
  pageSize.value = value
  page.value = 1
  void load()
}

watch(
  () => props.show,
  (visible) => {
    if (visible) open()
  },
  { immediate: true },
)

// 详情弹窗保存后父组件自增 reloadToken：当前列表保持页码与搜索条件重查一次。
watch(
  () => props.reloadToken,
  () => {
    if (props.show) void load()
  },
)
// 翻页只由分页器触发加载：原来的 watch(page) 会与 open / search / changePageSize 里
// 「page = 1 + load()」叠加，从第 2 页以后重新搜索时同一条件连发两次请求。
function changePage(value: number) {
  page.value = value
  void load()
}
</script>

<template>
  <n-modal
    :show="props.show"
    preset="card"
    draggable
    title="历史申购记录"
    class="purchase-record-history-modal"
    style="width: min(960px, 92vw)"
    :mask-closable="true"
    :bordered="false"
    @update:show="emit('update:show', $event)"
  >
    <div class="history-search">
      <label class="filter-field">
        <span>物料编码</span>
        <n-input
          v-model:value="searchMaterialCode"
          clearable
          maxlength="64"
          placeholder="输入物料编码"
          @keyup.enter="search"
        />
      </label>
      <label class="filter-field">
        <span>物资名称</span>
        <n-input
          v-model:value="searchName"
          clearable
          placeholder="输入物资名称"
          @keyup.enter="search"
        />
      </label>
      <label class="filter-field">
        <span>型号</span>
        <n-input
          v-model:value="searchModelSpec"
          clearable
          placeholder="输入型号"
          @keyup.enter="search"
        />
      </label>
      <div class="history-search-actions">
        <n-button @click="clearSearch">清空</n-button>
        <n-button @click="resetSearch">重置</n-button>
        <n-button type="primary" :loading="loading" @click="search">查询</n-button>
      </div>
    </div>
    <n-data-table
      remote
      size="small"
      :bordered="false"
      :single-line="false"
      :columns="columns"
      :data="items"
      :loading="loading"
      :row-key="(row: PurchaseRecord) => row.line_id"
      :row-props="rowProps"
      :scroll-x="1160"
    />
    <div class="pagination-bar">
      <n-pagination
        :page="page"
        :page-size="pageSize"
        :item-count="total"
        show-size-picker
        :page-sizes="[10, 20, 50]"
        @update:page="changePage"
        @update:page-size="changePageSize"
      />
    </div>
  </n-modal>
</template>

<style scoped>
.history-search {
  display: flex;
  align-items: flex-end;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 16px;
}

.filter-field {
  display: flex;
  min-width: 180px;
  flex: 1 1 180px;
  flex-direction: column;
  gap: 7px;
}

.filter-field > span {
  color: var(--color-text);
  font-size: 13px;
  font-weight: 500;
}

.filter-field :deep(.n-input) {
  width: 100%;
  background-color: var(--color-field-surface);
}

.history-search-actions {
  display: flex;
  gap: 10px;
  margin-left: auto;
}

.history-search-actions :deep(.n-button) {
  min-width: 88px;
}
</style>
