<script setup lang="ts">
import PersistentDataTable from '@/components/PersistentDataTable.vue'
/**
 * 工作管理：一行一个任务，列与车间《任务详细计划》表一致
 * （工作任务 / 事项或步骤 / 开始时间 / 完成时间 / 责任人 / 完成度 / 备注），
 * 另加标签（英文逗号分隔）与图片；筛选按标签 / 完成状态 / 关键字，整行点击进入编辑。
 */
import { computed, h, onMounted, ref } from 'vue'
import {
  NButton,
  NCard,
  NInput,
  NPagination,
  NProgress,
  NSelect,
  NTag,
  type DataTableColumns,
  type SelectOption,
} from 'naive-ui'
import { workApi } from '@/api/work'
import type { WorkTask } from '@/api/generated'
import ColumnVisibilityPicker from '@/components/ColumnVisibilityPicker.vue'
import ImageThumbnails from '@/components/ImageThumbnails.vue'
import WorkTaskFormModal from '@/components/WorkTaskFormModal.vue'
import {
  getTableScrollX,
  preventTableColumnCompression,
  tableColumnWidths,
} from '@/constants/table'
import { usePagedTable } from '@/composables/usePagedTable'
import { useAuthStore } from '@/stores/auth'
import { createTableRowClickGuard } from '@/utils/tableRowNavigation'
import {
  initialWorkTaskFilters,
  splitWorkTags,
  workProgressText,
  workTaskFiltersFromQuery,
  workTaskQuery,
  workTaskStatusOptions,
  type WorkTaskFilters,
} from '@/utils/work'

const auth = useAuthStore()
const canWrite = computed(() => auth.can('work:write'))
const rowClickGuard = createTableRowClickGuard()

const showModal = ref(false)
const editingId = ref<number | null>(null)
const tagOptions = ref<SelectOption[]>([])

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
} = usePagedTable<WorkTask, WorkTaskFilters>({
  fetch: (f, pager) =>
    workApi.tasks({
      page: pager.page,
      page_size: pager.page_size,
      ...workTaskQuery(f),
    }),
  initialFilters: initialWorkTaskFilters,
  rollbackEmptyPage: true,
  urlSync: {
    routeName: 'work-tasks',
    fromQuery: (route) => workTaskFiltersFromQuery(route.query as Record<string, unknown>),
    toQuery: (f) => workTaskQuery(f),
  },
})

/** 已启用的筛选条件数量（筛选区徽标）。 */
const activeFilterCount = computed(
  () =>
    [
      filters.keyword.trim() || null,
      filters.tags.length > 0 ? 'tags' : null,
      filters.status,
    ].filter((value) => value !== null && value !== '').length,
)

const allColumns: { key: string; label: string; column: DataTableColumns<WorkTask>[number] }[] = [
  {
    key: 'index',
    label: '序号',
    column: {
      title: '序号',
      key: 'index',
      width: 64,
      render: (_row, index) => (page.value - 1) * pageSize.value + index + 1,
    },
  },
  {
    key: 'name',
    label: '工作任务',
    column: {
      title: '工作任务',
      key: 'name',
      minWidth: 220,
      ellipsis: { tooltip: true },
    },
  },
  {
    key: 'steps',
    label: '事项或步骤',
    column: {
      title: '事项或步骤',
      key: 'steps',
      minWidth: 200,
      ellipsis: { tooltip: true },
      render: (row) => row.steps || '—',
    },
  },
  {
    key: 'start_date',
    label: '开始时间',
    column: {
      title: '开始时间',
      key: 'start_date',
      width: tableColumnWidths.date,
      render: (row) => row.start_date || '—',
    },
  },
  {
    key: 'end_date',
    label: '完成时间',
    column: {
      title: '完成时间',
      key: 'end_date',
      width: tableColumnWidths.date,
      render: (row) => row.end_date || '—',
    },
  },
  {
    key: 'owner',
    label: '责任人',
    column: {
      title: '责任人',
      key: 'owner',
      width: tableColumnWidths.person,
      ellipsis: { tooltip: true },
      render: (row) => row.owner || '—',
    },
  },
  {
    key: 'progress',
    label: '完成度',
    column: {
      title: '完成度',
      key: 'progress',
      width: 150,
      render: (row) =>
        h('div', { class: 'progress-cell' }, [
          h(NProgress, {
            type: 'line',
            percentage: Math.min(100, Math.max(0, row.progress)),
            height: 6,
            showIndicator: false,
            status: row.progress >= 100 ? 'success' : 'default',
          }),
          h('span', { class: 'progress-text' }, workProgressText(row.progress)),
        ]),
    },
  },
  {
    key: 'remark',
    label: '备注',
    column: {
      title: '备注',
      key: 'remark',
      minWidth: 180,
      ellipsis: { tooltip: true },
      render: (row) => row.remark || '—',
    },
  },
  {
    key: 'tags',
    label: '标签',
    column: {
      title: '标签',
      key: 'tags',
      width: 180,
      render: (row) => {
        const tags = splitWorkTags(row.tags)
        if (tags.length === 0) return '—'
        return h(
          'div',
          { class: 'action-row' },
          tags.map((tag) =>
            h(NTag, { size: 'small', bordered: false, type: 'info' }, { default: () => tag }),
          ),
        )
      },
    },
  },
  {
    key: 'images',
    label: '图片',
    column: {
      title: '图片',
      key: 'images',
      width: 140,
      render: (row) => h(ImageThumbnails, { images: row.images }),
    },
  },
]

const visibleColumnKeys = ref<string[]>(allColumns.map((item) => item.key))
const fieldOptions = allColumns.map((item) => ({ label: item.label, value: item.key }))
const columns = computed(() =>
  preventTableColumnCompression<WorkTask>(
    allColumns
      .filter((item) => visibleColumnKeys.value.includes(item.key))
      .map((item) => item.column),
  ),
)
const tableScrollX = computed(() => getTableScrollX(columns.value))

async function refreshTags(): Promise<void> {
  try {
    tagOptions.value = (await workApi.taskTags()).map((tag) => ({ label: tag, value: tag }))
  } catch {
    // 标签候选项加载失败不阻塞列表（筛选仍可用关键字与状态）
  }
}

function openCreate(): void {
  editingId.value = null
  showModal.value = true
}

function openEdit(row: WorkTask): void {
  editingId.value = row.id
  showModal.value = true
}

/** 整行可点击进入编辑 / 查看（忽略行内图片预览、拖拽选字）。 */
function rowProps(row: WorkTask) {
  return {
    style: 'cursor: pointer',
    onMousedown: rowClickGuard.onMouseDown,
    onClick: (event: MouseEvent) => {
      if (!rowClickGuard.shouldIgnore(event)) openEdit(row)
    },
  }
}

async function afterSaved(): Promise<void> {
  await query()
  await refreshTags()
}

onMounted(refreshTags)
</script>

<template>
  <div class="page">
    <n-card class="filter-card" :bordered="false">
      <div class="filter-panel">
        <div class="filter-grid">
          <label class="filter-field">
            <span>标签</span>
            <n-select
              v-model:value="filters.tags"
              :options="tagOptions"
              multiple
              filterable
              clearable
              :max-tag-count="3"
              placeholder="可多选，命中任意一个即可"
            />
          </label>
          <label class="filter-field">
            <span>完成状态</span>
            <n-select
              v-model:value="filters.status"
              :options="workTaskStatusOptions"
              placeholder="不限"
              clearable
            />
          </label>
          <label class="filter-field">
            <span>关键字</span>
            <n-input
              v-model:value="filters.keyword"
              placeholder="工作任务 / 事项或步骤 / 责任人 / 备注 / 标签，可用 | 分隔"
              clearable
              @keyup.enter="query"
            />
          </label>
        </div>
        <div class="filter-actions">
          <span v-if="activeFilterCount" class="filter-count"
            >已启用 {{ activeFilterCount }} 项</span
          >
          <span class="filter-hint">点行编辑任务，图片在行内可直接预览</span>
          <ColumnVisibilityPicker
            :value="visibleColumnKeys"
            :options="fieldOptions"
            storage-key="work.work-tasks.visible-columns.v1"
            @update:value="visibleColumnKeys = $event"
          />
          <div class="filter-action-buttons">
            <n-button v-if="canWrite" type="primary" @click="openCreate">新增任务</n-button>

            <n-button @click="resetFilters">重置</n-button>
            <n-button type="primary" @click="query">查询</n-button>
          </div>
        </div>
      </div>
    </n-card>

    <n-card class="data-card" :bordered="false">
      <PersistentDataTable
        storage-key="work/work-tasks"
        remote
        :bordered="false"
        :columns="columns"
        :data="items"
        :loading="loading"
        :row-props="rowProps"
        :row-key="(row: WorkTask) => row.id"
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

    <WorkTaskFormModal
      v-model:show="showModal"
      :task-id="editingId"
      :readonly="!canWrite"
      @saved="afterSaved"
    />
  </div>
</template>

<style scoped>
/* 完成度：进度条 + 百分比，一行内对齐 */
.progress-cell {
  display: flex;
  align-items: center;
  gap: var(--list-inline-gap);
}

.progress-cell :deep(.n-progress) {
  flex: 1;
}

.progress-text {
  flex: none;
  color: var(--color-text-muted);
  font-size: var(--list-caption-size);
  font-variant-numeric: tabular-nums;
}
</style>
