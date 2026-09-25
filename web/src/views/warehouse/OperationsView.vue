<script setup lang="ts">
import { h, ref, watch } from 'vue'
import { NButton, NTag, useMessage } from 'naive-ui'
import { useRoute, useRouter } from 'vue-router'
import type { StockOperation } from '@/api/generated'
import { inventoryApi } from '@/api/inventory'
import {
  getTableScrollX,
  preventTableColumnCompression,
  tableColumnWidths,
} from '@/constants/table'
import { formatShanghaiTime } from '@/utils/time'
import { createTableRowClickGuard } from '@/utils/tableRowNavigation'
import { routeQueryString } from '@/utils/routeQuery'
import { usePagedTable } from '@/composables/usePagedTable'
import FilterExpandButton from '@/components/FilterExpandButton.vue'
import OperationDetailModal from '@/components/OperationDetailModal.vue'

const router = useRouter()
const route = useRoute()
const message = useMessage()
const rowClickGuard = createTableRowClickGuard()
const filterExpanded = ref(false)
type OperationFilters = {
  operation_no: string
  operation_type: string | null
  material_name: string
  dateRange: [number, number] | null
}
function emptyFilters(): OperationFilters {
  return { operation_no: '', operation_type: null, material_name: '', dateRange: null }
}
const {
  items,
  total,
  page,
  pageSize,
  loading,
  filters,
  load,
  query,
  changePage,
  changePageSize,
  resetFilters,
} = usePagedTable<StockOperation, OperationFilters>({
  fetch: (f, pager) =>
    inventoryApi.operations({
      page: pager.page,
      page_size: pager.page_size,
      operation_no: f.operation_no.trim() || undefined,
      operation_type: f.operation_type || undefined,
      material_name: f.material_name.trim() || undefined,
      start_at: f.dateRange ? new Date(f.dateRange[0]).toISOString() : undefined,
      end_at: f.dateRange ? new Date(f.dateRange[1]).toISOString() : undefined,
    }),
  initialFilters: emptyFilters,
  onError: (error) => message.error(error instanceof Error ? error.message : '操作记录查询失败'),
  urlSync: {
    routeName: 'operations',
    fromQuery: (route) => ({
      operation_no: String(route.query.operation_no || ''),
      operation_type: String(route.query.operation_type || '') || null,
      material_name: String(route.query.material_name || ''),
      dateRange: null,
    }),
    toQuery: (f) => ({
      operation_no: f.operation_no.trim() || undefined,
      operation_type: f.operation_type || undefined,
      material_name: f.material_name.trim() || undefined,
    }),
    // 详情弹窗的 id 不属于筛选状态，翻页/筛选时都必须留在 URL 里
    preservedQueryKeys: ['detail'],
  },
})

// 流水详情弹窗（原 /warehouse/operations/:id 详情页）
const showDetail = ref(false)
const detailId = ref<number | null>(null)

async function openDetail(id: number) {
  detailId.value = id
  showDetail.value = true
  if (routeQueryString(route.query.detail) !== String(id)) {
    await router.replace({ query: { ...route.query, detail: String(id) } })
  }
}

async function closeDetail() {
  showDetail.value = false
  detailId.value = null
  if (routeQueryString(route.query.detail)) {
    await router.replace({ query: { ...route.query, detail: undefined } })
  }
}

function onDetailShow(value: boolean) {
  showDetail.value = value
  if (!value) void closeDetail()
}

// 冲销成功：刷新列表，并把弹窗切到新生成的冲销流水（等价于原来跳转冲销流水详情）
async function onReversed(id: number) {
  await load()
  await openDetail(id)
}

// URL → 弹窗的唯一入口：用 watch 而不是 onMounted，同页导航（入库/出库提交后跳转）也能生效
watch(
  () => routeQueryString(route.query.detail),
  (raw) => {
    const id = Number(raw)
    if (!Number.isInteger(id) || id <= 0) return
    if (showDetail.value && detailId.value === id) return
    void openDetail(id)
  },
  { immediate: true },
)
const columns = preventTableColumnCompression<StockOperation>([
  {
    title: '流水号',
    key: 'operation_no',
    width: tableColumnWidths.identifier,
    render: (row) =>
      h(
        NButton,
        {
          text: true,
          type: 'primary',
          onClick: () => void openDetail(row.id),
        },
        { default: () => row.operation_no },
      ),
  },
  {
    title: '类型',
    key: 'operation_type',
    width: 90,
    render: (row) =>
      h(
        NTag,
        { type: row.operation_type === 'INBOUND' ? 'success' : 'warning' },
        { default: () => (row.operation_type === 'INBOUND' ? '入库' : '出库') },
      ),
  },
  {
    title: '发生时间',
    key: 'occurred_at',
    width: tableColumnWidths.datetime,
    render: (row) => formatShanghaiTime(row.occurred_at),
  },
  {
    title: '物资',
    key: 'lines',
    width: tableColumnWidths.material,
    ellipsis: { tooltip: true },
    render: (row) => row.lines.map((line) => `${line.material_name} × ${line.quantity}`).join('；'),
  },
  {
    title: '用途',
    key: 'business_reason',
    width: tableColumnWidths.text,
    ellipsis: { tooltip: true },
  },
  {
    title: '操作',
    key: 'action',
    width: 80,
    render: (row) =>
      h(
        NButton,
        {
          size: 'small',
          onClick: () => void openDetail(row.id),
        },
        { default: () => '详情' },
      ),
  },
])
const tableScrollX = getTableScrollX(columns)

function rowProps(row: StockOperation) {
  return {
    style: 'cursor: pointer',
    onMousedown: rowClickGuard.onMouseDown,
    onClick: (event: MouseEvent) => {
      if (!rowClickGuard.shouldIgnore(event)) void openDetail(row.id)
    },
  }
}
</script>

<template>
  <div class="page">
    <div class="page-header">
      <div>
        <h1 class="page-title">操作记录</h1>
      </div>
    </div>

    <n-card class="filter-card" :bordered="false">
      <div class="filter-heading">
        <div class="filter-title">筛选条件</div>
        <div class="filter-heading-actions">
          <FilterExpandButton v-model:expanded="filterExpanded" />
        </div>
      </div>
      <div class="filter-grid" :class="{ 'is-collapsed': !filterExpanded }">
        <label class="filter-field">
          <span>物资名称或型号规格</span>
          <n-input
            v-model:value="filters.material_name"
            clearable
            placeholder="输入物资名称或型号规格"
            @keyup.enter="query"
          />
        </label>
        <label class="filter-field">
          <span>流水号</span>
          <n-input
            v-model:value="filters.operation_no"
            clearable
            placeholder="输入流水号"
            @keyup.enter="query"
          />
        </label>
        <label class="filter-field">
          <span>操作类型</span>
          <n-select
            v-model:value="filters.operation_type"
            clearable
            :options="[
              { label: '入库', value: 'INBOUND' },
              { label: '出库', value: 'OUTBOUND' },
            ]"
            placeholder="选择操作类型"
          />
        </label>
        <label class="filter-field">
          <span>发生时间</span>
          <n-date-picker
            v-model:value="filters.dateRange"
            type="datetimerange"
            clearable
            class="full-width"
          />
        </label>
      </div>
      <div class="filter-extras-actions">
        <div class="filter-actions">
          <n-button @click="resetFilters">重置</n-button>
          <n-button type="primary" :loading="loading" @click="query">查询</n-button>
        </div>
      </div>
    </n-card>

    <n-card class="data-card" :bordered="false">
      <n-data-table
        :bordered="false"
        :columns="columns"
        :data="items"
        :loading="loading"
        :row-props="rowProps"
        :scroll-x="tableScrollX"
        :row-key="(row: StockOperation) => row.id"
      />
      <div class="pagination-bar">
        <n-pagination
          v-model:page="page"
          v-model:page-size="pageSize"
          :item-count="total"
          :page-sizes="[10, 20, 50, 100, 200]"
          show-size-picker
          @update:page="changePage"
          @update:page-size="changePageSize"
        />
      </div>
    </n-card>

    <OperationDetailModal
      :show="showDetail"
      :operation-id="detailId"
      @update:show="onDetailShow"
      @saved="load"
      @reversed="onReversed"
    />
  </div>
</template>

<style scoped>
.filter-heading,
.filter-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.filter-heading {
  margin-bottom: 18px;
}

.filter-actions {
  justify-content: flex-end;
  margin-top: 20px;
}
</style>
