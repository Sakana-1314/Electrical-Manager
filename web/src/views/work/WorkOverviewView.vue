<script setup lang="ts">
/**
 * 工作总览：每天每个活由哪几个人在干。
 *
 * 一行 = 日期 + 任务 + 时段（全天 / 上午 / 下午）：一条跨天记录会在这张表里展开成多行，
 * 展开与分页都在服务端完成（`GET /work-overview`），因此日期区间必填且最长 92 天。
 * 参与人员按「、」分隔的多人在库里是一列文本，接口返回姓名列表，这里渲染成小标签。
 *
 * 读取对所有登录用户开放；点行打开记录弹窗——有 `work:write` 时可直接编辑，否则只读展示。
 */
import { computed, h, onMounted, ref } from 'vue'
import {
  NButton,
  NCard,
  NDataTable,
  NInput,
  NPagination,
  NSelect,
  NTag,
  type DataTableColumns,
  type SelectOption,
} from 'naive-ui'
import { workApi } from '@/api/work'
import type { WorkOverviewRow, WorkTask } from '@/api/generated'
import ColumnVisibilityPicker from '@/components/ColumnVisibilityPicker.vue'
import WorkRangePicker from '@/components/WorkRangePicker.vue'
import WorkRecordFormModal from '@/components/WorkRecordFormModal.vue'
import {
  getTableScrollX,
  preventTableColumnCompression,
  tableColumnWidths,
} from '@/constants/table'
import { usePagedTable } from '@/composables/usePagedTable'
import { useAuthStore } from '@/stores/auth'
import { formatDate } from '@/utils/time'
import {
  initialWorkOverviewFilters,
  overviewRowKey,
  shanghaiToday,
  weekdayLabel,
  workOverviewFiltersFromQuery,
  workOverviewQuery,
  workTaskStatusTypes,
  type WorkOverviewFilters,
} from '@/utils/work'

const auth = useAuthStore()
const canWrite = computed(() => auth.can('work:write'))
const today = shanghaiToday()

const tasks = ref<WorkTask[]>([])
const participantNames = ref<string[]>([])
const showRecordModal = ref(false)
const editingRecordId = ref<number | null>(null)

const {
  items,
  total,
  page,
  pageSize,
  loading,
  filters,
  pageSizeOptions,
  query,
  changePage,
  changePageSize,
  resetFilters,
} = usePagedTable<WorkOverviewRow, WorkOverviewFilters>({
  fetch: (f, pager) =>
    workApi.overview({ ...workOverviewQuery(f), page: pager.page, page_size: pager.page_size }),
  initialFilters: () => initialWorkOverviewFilters(today),
  urlSync: {
    routeName: 'work-overview',
    fromQuery: (route) =>
      workOverviewFiltersFromQuery(route.query as Record<string, unknown>, today),
    toQuery: (f) => workOverviewQuery(f),
  },
})

const taskOptions = computed<SelectOption[]>(() =>
  tasks.value.map((task) => ({ label: task.name, value: task.id })),
)
const participantOptions = computed<SelectOption[]>(() =>
  participantNames.value.map((name) => ({ label: name, value: name })),
)

const activeFilterCount = computed(
  () =>
    [
      filters.task_ids.length || null,
      filters.participants.length || null,
      filters.keyword.trim() || null,
    ].filter(Boolean).length,
)

const allColumns: {
  key: string
  label: string
  column: DataTableColumns<WorkOverviewRow>[number]
}[] = [
  {
    key: 'date',
    label: '日期',
    column: {
      title: '日期',
      key: 'date',
      width: tableColumnWidths.date,
      render: (row) => formatDate(row.date),
    },
  },
  {
    key: 'weekday',
    label: '星期',
    column: {
      title: '星期',
      key: 'weekday',
      width: 72,
      render: (row) => weekdayLabel(row.date),
    },
  },
  {
    key: 'task',
    label: '任务',
    column: {
      title: '任务',
      key: 'task',
      width: tableColumnWidths.name,
      ellipsis: { tooltip: true },
      render: (row) => row.task_name,
    },
  },
  {
    key: 'status',
    label: '状态',
    column: {
      title: '状态',
      key: 'status',
      width: tableColumnWidths.status,
      render: (row) =>
        h(
          NTag,
          { size: 'small', bordered: false, type: workTaskStatusTypes[row.task_status] },
          {
            default: () => row.task_status,
          },
        ),
    },
  },
  {
    key: 'slot',
    label: '时段',
    column: {
      title: '时段',
      key: 'slot',
      width: 88,
    },
  },
  {
    key: 'participants',
    label: '参与人员',
    column: {
      title: '参与人员',
      key: 'participants',
      minWidth: tableColumnWidths.text,
      render: (row) =>
        h(
          'div',
          { class: 'action-row' },
          row.participants.map((name) =>
            h(NTag, { size: 'small', bordered: false, type: 'info' }, { default: () => name }),
          ),
        ),
    },
  },
  {
    key: 'remark',
    label: '备注',
    column: {
      title: '备注',
      key: 'remark',
      minWidth: tableColumnWidths.text,
      ellipsis: { tooltip: true },
      render: (row) => row.remark || '—',
    },
  },
]

const visibleColumnKeys = ref<string[]>(allColumns.map((item) => item.key))
const fieldOptions = allColumns.map((item) => ({ label: item.label, value: item.key }))
const columns = computed(() =>
  preventTableColumnCompression<WorkOverviewRow>(
    allColumns
      .filter((item) => visibleColumnKeys.value.includes(item.key))
      .map((item) => item.column),
  ),
)
const tableScrollX = computed(() => getTableScrollX(columns.value))

function openRecord(row: WorkOverviewRow): void {
  editingRecordId.value = row.record_id
  showRecordModal.value = true
}

async function loadOptions(): Promise<void> {
  try {
    const [taskPage, names] = await Promise.all([
      workApi.tasks({ page_size: 200 }),
      workApi.participants(),
    ])
    tasks.value = taskPage.items
    participantNames.value = names
  } catch {
    // 下拉选项加载失败不阻塞列表（区间与分页仍可用）
  }
}

onMounted(loadOptions)
</script>

<template>
  <div class="page">
    <div class="page-header">
      <div>
        <h1 class="page-title">工作总览</h1>
      </div>
    </div>

    <n-card class="filter-card" :bordered="false">
      <div class="filter-heading">
        <div class="filter-title">筛选条件</div>
        <div class="filter-heading-actions">
          <n-tag v-if="activeFilterCount" :bordered="false" round type="success">
            已启用 {{ activeFilterCount }} 项
          </n-tag>
        </div>
      </div>
      <div class="filter-grid">
        <label class="filter-field filter-field-wide">
          <span>日期区间</span>
          <WorkRangePicker v-model="filters.range" />
        </label>
        <label class="filter-field">
          <span>任务</span>
          <n-select
            v-model:value="filters.task_ids"
            :options="taskOptions"
            multiple
            clearable
            filterable
            placeholder="可多选，清空即不限"
          />
        </label>
        <label class="filter-field">
          <span>参与人员</span>
          <n-select
            v-model:value="filters.participants"
            :options="participantOptions"
            multiple
            clearable
            filterable
            placeholder="按姓名精确匹配"
          />
        </label>
        <label class="filter-field">
          <span>关键字</span>
          <n-input
            v-model:value="filters.keyword"
            placeholder="任务名 / 参与人员 / 备注，可用 | 分隔多个关键词"
            clearable
            @keyup.enter="query"
          />
        </label>
      </div>
      <div class="filter-actions">
        <ColumnVisibilityPicker
          :value="visibleColumnKeys"
          :options="fieldOptions"
          storage-key="work.overview.visible-columns.v1"
          @update:value="visibleColumnKeys = $event"
        />
        <div class="filter-action-buttons">
          <n-button @click="resetFilters">重置</n-button>
          <n-button type="primary" @click="query">查询</n-button>
        </div>
      </div>
    </n-card>

    <n-card class="data-card" :bordered="false">
      <n-data-table
        remote
        :bordered="false"
        :columns="columns"
        :data="items"
        :loading="loading"
        :row-key="overviewRowKey"
        :row-props="
          (row: WorkOverviewRow) => ({
            style: 'cursor: pointer',
            onClick: () => openRecord(row),
          })
        "
        :scroll-x="tableScrollX"
      />
      <div class="pagination-bar">
        <n-pagination
          v-model:page="page"
          v-model:page-size="pageSize"
          :item-count="total"
          :page-sizes="pageSizeOptions"
          show-size-picker
          @update:page="changePage"
          @update:page-size="changePageSize"
        />
      </div>
    </n-card>

    <WorkRecordFormModal
      v-model:show="showRecordModal"
      :record-id="editingRecordId"
      :readonly="!canWrite"
      @saved="query"
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
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid var(--color-border-subtle);
}

.filter-action-buttons {
  display: flex;
  flex: none;
  gap: 10px;
}

.filter-action-buttons :deep(.n-button) {
  min-width: 88px;
}

@media (max-width: 900px) {
  .filter-actions {
    align-items: stretch;
    flex-direction: column;
  }

  .filter-action-buttons {
    justify-content: flex-end;
  }
}
</style>
