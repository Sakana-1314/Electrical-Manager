<script setup lang="ts">
import { h, ref, watch } from 'vue'
import { NButton, NTag, useDialog, useMessage } from 'naive-ui'
import { useRoute, useRouter } from 'vue-router'
import { inventoryApi } from '@/api/inventory'
import type { StockMaterial } from '@/api/generated'
import { useAuthStore } from '@/stores/auth'
import StockMaterialFormModal from '@/components/StockMaterialFormModal.vue'
import { createTableRowClickGuard } from '@/utils/tableRowNavigation'
import { usePagedTable } from '@/composables/usePagedTable'
import { routeQueryString } from '@/utils/routeQuery'
import {
  getTableScrollX,
  preventTableColumnCompression,
  tableColumnWidths,
} from '@/constants/table'

const router = useRouter()
const route = useRoute()
const message = useMessage()
const dialog = useDialog()
const auth = useAuthStore()
const rowClickGuard = createTableRowClickGuard()
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
} = usePagedTable<StockMaterial, { keyword: string }>({
  fetch: (f, pager) =>
    inventoryApi.materials({
      page: pager.page,
      page_size: pager.page_size,
      keyword: f.keyword.trim() || undefined,
    }),
  initialFilters: () => ({ keyword: '' }),
  onError: (error) => message.error(error instanceof Error ? error.message : '物资档案加载失败'),
  rollbackEmptyPage: true,
  urlSync: {
    routeName: 'stock-materials',
    fromQuery: (route) => ({ keyword: String(route.query.keyword || '') }),
    toQuery: (f) => ({ keyword: f.keyword.trim() || undefined }),
    // 详情弹窗的 id 不属于筛选状态，翻页/筛选/重新激活时都必须留在 URL 里
    preservedQueryKeys: ['detail'],
  },
})

// 详情弹窗：materialId 为 null 即新建
const showModal = ref(false)
const materialId = ref<number | null>(null)
const deletingId = ref<number | null>(null)

function confirmDelete(row: StockMaterial) {
  dialog.warning({
    draggable: true,
    title: '确认删除物资档案',
    content: `确定删除“${row.name}（${row.model_spec}）”吗？删除后无法恢复。`,
    positiveText: '确认删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      deletingId.value = row.id
      try {
        await inventoryApi.deleteMaterial(row.id, row.version)
        message.success('物资档案已删除')
        // 防空页回退由 usePagedTable 的 rollbackEmptyPage 处理（删掉末页最后一条后自动退页）
        await load()
      } catch (error) {
        message.error(error instanceof Error ? error.message : '删除失败')
        return false
      } finally {
        deletingId.value = null
      }
      return true
    },
  })
}

/** 打开详情并把它写进 URL，刷新 / 新标签页 / 收藏都能回到同一条记录。 */
async function openDetail(id: number) {
  materialId.value = id
  showModal.value = true
  if (routeQueryString(route.query.detail) !== String(id)) {
    await router.replace({ query: { ...route.query, detail: String(id) } })
  }
}

async function closeDetail() {
  showModal.value = false
  materialId.value = null
  if (routeQueryString(route.query.detail)) {
    await router.replace({ query: { ...route.query, detail: undefined } })
  }
}

function openCreate() {
  materialId.value = null
  showModal.value = true
  // 新建不是「打开某条详情」：清掉可能残留的 ?detail=，避免刷新后又弹回上一条
  void router.replace({ query: { ...route.query, detail: undefined } })
}

function toggled(value: boolean) {
  showModal.value = value
  if (!value) void closeDetail()
}

// URL → 弹窗的唯一入口：用 watch 而不是 onMounted，keepAlive / 同页导航都能生效
watch(
  () => routeQueryString(route.query.detail),
  (raw) => {
    const id = Number(raw)
    if (!Number.isInteger(id) || id <= 0) return
    if (showModal.value && materialId.value === id) return
    void openDetail(id)
  },
  { immediate: true },
)

const columns = preventTableColumnCompression<StockMaterial>([
  {
    title: '物资名称',
    key: 'name',
    width: tableColumnWidths.name,
    render: (row) => (row.alias ? `${row.name}（${row.alias}）` : row.name),
  },
  {
    title: '型号规格',
    key: 'model_spec',
    width: tableColumnWidths.model,
    ellipsis: { tooltip: true },
  },
  { title: '计量单位', key: 'unit_name', width: tableColumnWidths.unit },
  { title: '当前库存', key: 'current_qty', width: tableColumnWidths.quantity },
  {
    title: '最低库存',
    key: 'minimum_qty',
    width: tableColumnWidths.quantity,
    render: (row) => row.replenishment_policy?.minimum_qty ?? '未配置',
  },
  {
    title: '档案状态',
    key: 'record_status',
    width: tableColumnWidths.status,
    render: (row) =>
      row.has_operation_records
        ? h(NTag, { size: 'small' }, { default: () => '已有操作记录' })
        : h(NTag, { size: 'small', type: 'success' }, { default: () => '可删除' }),
  },
  {
    title: '操作',
    key: 'actions',
    width: 170,
    render: (row) => {
      if (!auth.can('warehouse:write')) {
        return h(
          NButton,
          { size: 'small', onClick: () => void openDetail(row.id) },
          { default: () => '详情' },
        )
      }
      const actions = [
        h(
          NButton,
          { size: 'small', onClick: () => void openDetail(row.id) },
          { default: () => '编辑' },
        ),
      ]
      if (!row.has_operation_records) {
        actions.push(
          h(
            NButton,
            {
              size: 'small',
              type: 'error',
              secondary: true,
              loading: deletingId.value === row.id,
              onClick: () => confirmDelete(row),
            },
            { default: () => '删除' },
          ),
        )
      }
      return h('div', { class: 'action-row' }, actions)
    },
  },
])
const tableScrollX = getTableScrollX(columns)

function rowProps(row: StockMaterial) {
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
        <h1 class="page-title">物资档案</h1>
      </div>
      <div class="page-actions">
        <n-button v-if="auth.can('warehouse:write')" type="primary" @click="openCreate">
          新建物资
        </n-button>
      </div>
    </div>

    <n-card class="filter-card" :bordered="false">
      <div class="filter-heading">
        <div>
          <div class="filter-title">筛选条件</div>
        </div>
      </div>
      <div class="filter-grid">
        <label class="filter-field">
          <span>名称、别名或型号规格</span>
          <n-input
            v-model:value="filters.keyword"
            clearable
            placeholder="输入物资名称、别名或型号规格"
            @keyup.enter="query"
          />
        </label>
      </div>
      <div class="filter-actions">
        <n-button @click="resetFilters">重置</n-button>
        <n-button type="primary" :loading="loading" @click="query">查询</n-button>
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
        :row-key="(row: StockMaterial) => row.id"
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

    <StockMaterialFormModal
      :show="showModal"
      :material-id="materialId"
      @update:show="toggled"
      @saved="load"
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
