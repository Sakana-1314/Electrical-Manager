<script setup lang="ts">
import { computed, h, onMounted, ref } from 'vue'
import type { DataTableColumns } from 'naive-ui'
import { useDialog, useMessage } from 'naive-ui'
import type { HuaXingInventory } from '@/api/generated'
import { huaXingInventoryApi } from '@/api/huaXingInventory'
import { useAuthStore } from '@/stores/auth'
import {
  getTableScrollX,
  preventTableColumnCompression,
  tableColumnWidths,
} from '@/constants/table'
import { useImportConfirm } from '@/composables/useImportConfirm'
import { useImportJob } from '@/composables/useImportJob'
import { usePagedTable } from '@/composables/usePagedTable'
import { formatShanghaiTime, toShanghaiDate } from '@/utils/time'
import ColumnVisibilityPicker from '@/components/ColumnVisibilityPicker.vue'
import FilterExpandButton from '@/components/FilterExpandButton.vue'
import LoadingMask from '@/components/LoadingMask.vue'

const auth = useAuthStore()
const dialog = useDialog()
const message = useMessage()
const fileInput = ref<HTMLInputElement | null>(null)
const filterExpanded = ref(false)
type HuaXingFilters = {
  materialCode: string
  name: string
  modelSpec: string
  purchaseDepartment: string[]
  purchaser: string[]
  /** 首次入库日期区间：[起始时间戳, 结束时间戳]，未选为 null */
  inboundDateRange: [number, number] | null
}
const {
  items,
  total,
  page,
  pageSize,
  loading,
  filters,
  query,
  changePage,
  changePageSize,
  resetFilters,
} = usePagedTable<HuaXingInventory, HuaXingFilters>({
  fetch: (f, pager) =>
    huaXingInventoryApi.list({
      material_code: f.materialCode.trim() || undefined,
      name: f.name.trim() || undefined,
      model_spec: f.modelSpec.trim() || undefined,
      purchase_department: f.purchaseDepartment.length ? f.purchaseDepartment.join('|') : undefined,
      purchaser: f.purchaser.length ? f.purchaser.join('|') : undefined,
      // 日期选择器给的是时间戳，按上海时区折算成 YYYY-MM-DD 再交给后端做闭区间比较；
      // 区间只选了一端时（值为 [时间戳, null]）只传已选那一端。
      date_from:
        f.inboundDateRange?.[0] == null ? undefined : toShanghaiDate(f.inboundDateRange[0]),
      date_to: f.inboundDateRange?.[1] == null ? undefined : toShanghaiDate(f.inboundDateRange[1]),
      page: pager.page,
      page_size: pager.page_size,
    }),
  initialFilters: () => ({
    materialCode: '',
    name: '',
    modelSpec: '',
    purchaseDepartment: [],
    purchaser: [],
    inboundDateRange: null,
  }),
  onError: (error) => message.error(error instanceof Error ? error.message : '加载华星总库存失败'),
  pageSizeOptions: [20, 50, 100, 200],
})
const departmentOptions = ref<{ label: string; value: string }[]>([])
const purchaserOptions = ref<{ label: string; value: string }[]>([])
async function loadFilterOptions() {
  try {
    const options = await huaXingInventoryApi.filterOptions()
    departmentOptions.value = options.purchase_departments.map((value) => ({ label: value, value }))
    purchaserOptions.value = options.purchasers.map((value) => ({ label: value, value }))
  } catch {
    // 选项加载失败不影响列表；下拉为空时仍可正常查询
  }
}
const importJob = useImportJob({
  start: (file) => huaXingInventoryApi.import(file),
  poll: (jobId) => huaXingInventoryApi.importJob(jobId),
})
const importing = computed(() => importJob.running.value)
const confirmImport = useImportConfirm(dialog)
const lastImportAt = ref('')
async function loadLastImport() {
  try {
    const result = await huaXingInventoryApi.lastImport()
    lastImportAt.value = formatShanghaiTime(result.last_import_at ?? undefined)
  } catch {
    lastImportAt.value = '—'
  }
}
onMounted(() => {
  void loadLastImport()
  void loadFilterOptions()
})
const activeFilterCount = computed(
  () =>
    [
      filters.materialCode.trim(),
      filters.name.trim(),
      filters.modelSpec.trim(),
      ...filters.purchaseDepartment,
      ...filters.purchaser,
      filters.inboundDateRange ? '首次入库日期' : '',
    ].filter(Boolean).length,
)

type HuaXingColumnKey =
  | 'first_inbound_date'
  | 'warehouse'
  | 'material_code'
  | 'name'
  | 'model_spec'
  | 'quantity'
  | 'unit_name'
  | 'purchaser'
  | 'purchase_department'
  | 'subitem_no_name'

/** 可展示列：列顺序即字段选择的顺序，`key` 同时用于 localStorage 持久化。 */
const availableColumns: {
  key: HuaXingColumnKey
  label: string
  column: DataTableColumns<HuaXingInventory>[number]
}[] = [
  {
    key: 'first_inbound_date',
    label: '首次入库日期',
    column: {
      title: '首次入库日期',
      key: 'first_inbound_date',
      width: tableColumnWidths.date,
      render: (row) => row.first_inbound_date || '—',
    },
  },
  {
    key: 'warehouse',
    label: '仓库',
    column: { title: '仓库', key: 'warehouse', width: tableColumnWidths.person },
  },
  {
    key: 'material_code',
    label: '货品编码',
    column: {
      title: '货品编码',
      key: 'material_code',
      width: tableColumnWidths.code,
      render: (row) => h('strong', row.material_code ?? '—'),
    },
  },
  {
    key: 'name',
    label: '货品名称',
    column: {
      title: '货品名称',
      key: 'name',
      width: tableColumnWidths.name,
      ellipsis: { tooltip: true },
      render: (row) => row.name || '—',
    },
  },
  {
    key: 'model_spec',
    label: '型号',
    column: {
      title: '型号',
      key: 'model_spec',
      width: tableColumnWidths.model,
      ellipsis: { tooltip: true },
      render: (row) => row.model_spec || '—',
    },
  },
  {
    key: 'quantity',
    label: '数量',
    column: {
      title: '数量',
      key: 'quantity',
      width: tableColumnWidths.quantity,
      align: 'right',
    },
  },
  {
    key: 'unit_name',
    label: '单位',
    column: { title: '单位', key: 'unit_name', width: tableColumnWidths.unit },
  },
  {
    key: 'purchaser',
    label: '申购人',
    column: { title: '申购人', key: 'purchaser', width: tableColumnWidths.person },
  },
  {
    key: 'purchase_department',
    label: '申购部门',
    column: {
      title: '申购部门',
      key: 'purchase_department',
      width: tableColumnWidths.text,
      ellipsis: { tooltip: true },
      render: (row) => row.purchase_department || '—',
    },
  },
  {
    key: 'subitem_no_name',
    label: '子项号名称',
    column: {
      title: '子项号名称',
      key: 'subitem_no_name',
      width: tableColumnWidths.material,
      ellipsis: { tooltip: true },
      render: (row) => row.subitem_no_name || '—',
    },
  },
]
const visibleColumnKeys = ref<HuaXingColumnKey[]>(availableColumns.map((item) => item.key))
const fieldOptions = availableColumns.map((item) => ({ label: item.label, value: item.key }))
const columns = computed<DataTableColumns<HuaXingInventory>>(() =>
  preventTableColumnCompression(
    availableColumns
      .filter((item) => visibleColumnKeys.value.includes(item.key))
      .map((item) => item.column),
  ),
)
const tableScrollX = computed(() => getTableScrollX(columns.value))

function setVisibleColumnKeys(value: string[]) {
  visibleColumnKeys.value = value as HuaXingColumnKey[]
}

function openFilePicker() {
  fileInput.value?.click()
}

function showImportSummary(result: Record<string, unknown> | null) {
  const importedCount = Number(result?.imported_count ?? 0)
  dialog.success({
    draggable: true,
    title: '导入完成',
    content: `已全量更新 ${importedCount.toLocaleString()} 条华星总库存数据。`,
    positiveText: '知道了',
    positiveButtonProps: { type: 'primary' },
  })
}

async function importFile(file: File) {
  const result = await importJob.run(file)
  showImportSummary(result)
  filters.materialCode = ''
  filters.name = ''
  filters.modelSpec = ''
  filters.purchaseDepartment = []
  filters.purchaser = []
  filters.inboundDateRange = null
  page.value = 1
  await query()
}

function onFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  confirmImport({
    title: '全量更新华星总库存',
    content: `确认导入“${file.name}”吗？现有华星总库存将被全部删除，并由该文件完整替换。`,
    runningText: '正在导入并全量更新，请勿重复提交，完成后自动刷新列表…',
    run: () => importFile(file),
    onError: (error) => message.error(error instanceof Error ? error.message : '导入失败'),
  })
}
</script>

<template>
  <div class="page">
    <div class="page-header">
      <h1 class="page-title">华星总库存</h1>
      <div class="page-actions">
        <n-button
          v-if="auth.can('warehouse:write')"
          type="primary"
          :loading="importing"
          :disabled="importing"
          @click="openFilePicker"
        >
          导入表格全量更新
        </n-button>
      </div>
      <input
        ref="fileInput"
        class="hidden-file-input"
        type="file"
        accept=".xls,.xlsx,.xlsm,.csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
        @change="onFileChange"
      />
    </div>

    <n-card class="filter-card" :bordered="false">
      <div class="filter-heading">
        <div class="filter-title">筛选条件</div>
        <div class="filter-heading-actions">
          <n-tag v-if="activeFilterCount" :bordered="false" round type="success">
            已启用 {{ activeFilterCount }} 项
          </n-tag>
          <FilterExpandButton v-model:expanded="filterExpanded" />
        </div>
      </div>
      <div class="filter-grid">
        <label class="filter-field">
          <span>货品名称</span>
          <n-input
            v-model:value="filters.name"
            clearable
            placeholder="输入货品名称"
            @keyup.enter="query"
          />
        </label>
        <label class="filter-field">
          <span>型号</span>
          <n-input
            v-model:value="filters.modelSpec"
            clearable
            placeholder="输入型号"
            @keyup.enter="query"
          />
        </label>
        <div class="filter-extras-fields" :class="{ 'filter-extras-open': filterExpanded }">
          <label class="filter-field">
            <span>货品编码</span>
            <n-input
              v-model:value="filters.materialCode"
              clearable
              placeholder="输入货品编码"
              @keyup.enter="query"
            />
          </label>
          <label class="filter-field">
            <span>申购部门</span>
            <n-select
              v-model:value="filters.purchaseDepartment"
              :options="departmentOptions"
              multiple
              filterable
              clearable
              placeholder="选择申购部门（可多选）"
            />
          </label>
          <label class="filter-field">
            <span>申购人</span>
            <n-select
              v-model:value="filters.purchaser"
              :options="purchaserOptions"
              multiple
              filterable
              clearable
              placeholder="选择申购人（可多选）"
            />
          </label>
          <label class="filter-field filter-field-wide">
            <span>首次入库日期</span>
            <n-date-picker
              v-model:value="filters.inboundDateRange"
              type="daterange"
              clearable
              class="full-width"
            />
          </label>
        </div>
      </div>
      <div class="filter-extras-actions">
        <div class="filter-actions">
          <span class="muted"
            >共 {{ total.toLocaleString() }} 条 · 上次导入：{{ lastImportAt || '—' }}</span
          >
          <div class="filter-action-buttons">
            <ColumnVisibilityPicker
              :value="visibleColumnKeys"
              :options="fieldOptions"
              storage-key="warehouse.hua-xing-stock.visible-columns.v1"
              @update:value="setVisibleColumnKeys"
            />
            <n-button @click="resetFilters">重置</n-button>
            <n-button type="primary" :loading="loading" @click="query">查询</n-button>
          </div>
        </div>
      </div>
    </n-card>

    <n-card class="data-card">
      <LoadingMask :show="importing" text="正在导入并全量更新，请勿重复提交…" />
      <n-data-table
        remote
        :columns="columns"
        :data="items"
        :loading="loading"
        :row-key="(row: HuaXingInventory) => row.id"
        :scroll-x="tableScrollX"
      />
      <div class="pagination-bar">
        <n-pagination
          v-model:page="page"
          v-model:page-size="pageSize"
          :item-count="total"
          show-size-picker
          :page-sizes="[20, 50, 100, 200]"
          @update:page="changePage"
          @update:page-size="changePageSize"
        />
      </div>
    </n-card>
  </div>
</template>

<style scoped>
.hidden-file-input {
  display: none;
}

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
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid var(--color-border-subtle);
}

.filter-action-buttons {
  display: flex;
  flex: none;
  /* 字段选择与查询/重置同组，窄屏放不下时换行，避免挤出卡片 */
  flex-wrap: wrap;
  gap: 10px;
}

.filter-action-buttons :deep(.n-button) {
  min-width: 88px;
}

@media (max-width: 760px) {
  .filter-actions {
    align-items: stretch;
    flex-direction: column;
  }

  .filter-action-buttons {
    justify-content: flex-end;
  }
}
</style>
