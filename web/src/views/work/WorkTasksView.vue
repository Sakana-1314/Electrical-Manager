<script setup lang="ts">
/**
 * 任务视图：管理每个任务，看它的全周期时间线（哪一段时间哪些人在干这个活）。
 *
 * 主视图是半日格时间线——一行一个任务，行内色块 = 该任务在所选区间内的一段工作
 * （色块上写参与人员，悬停看完整信息）。点色块编辑记录；行尾可以直接给这个任务排活，
 * 也可以编辑任务本身（名称 / 状态 / 计划日期 / 工作内容 / 图片）。
 *
 * 点任务名选中它，下方「时间段明细」列出它在区间内的全部时间段，便于逐条核对与编辑。
 * 带工作记录的任务不允许直接删除（后端 409），要先删记录。
 */
import { computed, h, ref } from 'vue'
import {
  NButton,
  NCard,
  NDataTable,
  NIcon,
  NInput,
  NPagination,
  NSelect,
  NTag,
  NTooltip,
  type DataTableColumns,
} from 'naive-ui'
import { AddOutline, CreateOutline } from '@vicons/ionicons5'
import { workApi } from '@/api/work'
import type { WorkRecord, WorkTaskStatus, WorkTaskTimeline } from '@/api/generated'
import WorkRangePicker from '@/components/WorkRangePicker.vue'
import WorkRecordFormModal from '@/components/WorkRecordFormModal.vue'
import WorkTaskFormModal from '@/components/WorkTaskFormModal.vue'
import WorkTimelineGrid from '@/components/WorkTimelineGrid.vue'
import { usePagedTable } from '@/composables/usePagedTable'
import { useAuthStore } from '@/stores/auth'
import { formatDate } from '@/utils/time'
import {
  buildDaySlots,
  buildHalfColumns,
  buildTimelineRow,
  formatRecordRange,
  initialWorkTaskFilters,
  recordHalfKeys,
  shanghaiToday,
  workBarPaletteIndex,
  workTaskFiltersFromQuery,
  workTaskQuery,
  workTaskStatusOptions,
  workTaskStatusTypes,
  type WorkTaskFilters,
  type WorkTimelineRow,
} from '@/utils/work'

const auth = useAuthStore()
const canWrite = computed(() => auth.can('work:write'))
const today = shanghaiToday()

const selectedTaskId = ref<number | null>(null)
const showTaskModal = ref(false)
const editingTaskId = ref<number | null>(null)
const showRecordModal = ref(false)
const editingRecordId = ref<number | null>(null)
const presetTaskId = ref<number | null>(null)
const presetDate = ref<string | null>(null)
const presetParticipants = ref<string[]>([])

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
} = usePagedTable<WorkTaskTimeline, WorkTaskFilters>({
  fetch: (f, pager) =>
    workApi.taskTimeline({ ...workTaskQuery(f), page: pager.page, page_size: pager.page_size }),
  initialFilters: () => initialWorkTaskFilters(today),
  onLoaded: (data) => {
    // 翻页后选中的任务可能已不在本页：明细卡片随之隐藏
    if (!data.items.some((item) => item.task.id === selectedTaskId.value)) {
      selectedTaskId.value = null
    }
  },
  urlSync: {
    routeName: 'work-tasks',
    fromQuery: (route) => workTaskFiltersFromQuery(route.query as Record<string, unknown>, today),
    toQuery: (f) => workTaskQuery(f),
  },
})

const days = computed(() => buildDaySlots(filters.range, today))
const columns = computed(() => buildHalfColumns(days.value))

/** 时间线行的 key（`task:<id>`）→ 该行的任务数据，模板里用它取状态与图标操作。 */
const itemByKey = computed(() => new Map(items.value.map((item) => [`task:${item.task.id}`, item])))

function taskOf(key: string): WorkTaskTimeline | undefined {
  return itemByKey.value.get(key)
}

function statusOf(key: string): WorkTaskStatus {
  return taskOf(key)?.task.status ?? '未开始'
}

/** 计划日期文案：两端都没填时给出明确说明，不用空串占位。 */
function planText(item: WorkTaskTimeline): string {
  const { plan_start_date: start, plan_end_date: end } = item.task
  if (start && end) return `计划 ${formatDate(start)} → ${formatDate(end)}`
  if (start) return `计划 ${formatDate(start)} 起`
  if (end) return `计划至 ${formatDate(end)}`
  return '未设计划日期'
}

const rows = computed<WorkTimelineRow<WorkRecord>[]>(() =>
  items.value.map((item) =>
    buildTimelineRow<WorkRecord>({
      key: `task:${item.task.id}`,
      label: item.task.name,
      meta: `${item.records.length} 段 · ${planText(item)}`,
      items: item.records,
      columns: columns.value,
      columnsOf: (record) => recordHalfKeys(record, filters.range),
    }),
  ),
)

const selectedRow = computed(
  () => items.value.find((item) => item.task.id === selectedTaskId.value) ?? null,
)

const detailColumns: DataTableColumns<WorkRecord> = [
  {
    title: '时间段',
    key: 'range',
    width: 260,
    render: (row) => formatRecordRange(row),
  },
  {
    title: '参与人员',
    key: 'participants',
    minWidth: 200,
    render: (row) =>
      h(
        'div',
        { class: 'action-row' },
        row.participants.map((name) =>
          h(NTag, { size: 'small', bordered: false, type: 'info' }, { default: () => name }),
        ),
      ),
  },
  {
    title: '备注',
    key: 'remark',
    minWidth: 180,
    ellipsis: { tooltip: true },
    render: (row) => row.remark || '—',
  },
  {
    title: '操作',
    key: 'actions',
    width: 96,
    render: (row) =>
      h(
        NButton,
        { size: 'small', quaternary: true, type: 'primary', onClick: () => openRecord(row) },
        { default: () => (canWrite.value ? '编辑' : '查看') },
      ),
  },
]

function openCreateTask(): void {
  editingTaskId.value = null
  showTaskModal.value = true
}

function openEditTask(key: string): void {
  const item = taskOf(key)
  if (!item) return
  editingTaskId.value = item.task.id
  showTaskModal.value = true
}

function openRecord(record: WorkRecord): void {
  editingRecordId.value = record.id
  presetTaskId.value = null
  presetDate.value = null
  presetParticipants.value = []
  showRecordModal.value = true
}

/** 从任务行直接排活：预填任务与开始日期（默认取查询区间的结束日，便于往前调）。 */
function openCreateRecord(key: string): void {
  const item = taskOf(key)
  if (!item) return
  editingRecordId.value = null
  presetTaskId.value = item.task.id
  presetDate.value = filters.range.end
  presetParticipants.value = []
  showRecordModal.value = true
}

function selectTask(key: string): void {
  selectedTaskId.value = taskOf(key)?.task.id ?? null
}
</script>

<template>
  <div class="page">
    <div class="page-header">
      <div>
        <h1 class="page-title">任务视图</h1>
      </div>
      <div class="page-actions">
        <n-button v-if="canWrite" type="primary" @click="openCreateTask">新增任务</n-button>
      </div>
    </div>

    <n-card class="filter-card" :bordered="false">
      <div class="filter-heading">
        <div class="filter-title">筛选条件</div>
      </div>
      <div class="filter-grid">
        <label class="filter-field filter-field-wide">
          <span>日期区间</span>
          <WorkRangePicker v-model="filters.range" />
        </label>
        <label class="filter-field">
          <span>状态</span>
          <n-select
            v-model:value="filters.statuses"
            :options="workTaskStatusOptions"
            multiple
            clearable
            placeholder="可多选，清空即不限"
          />
        </label>
        <label class="filter-field">
          <span>关键字</span>
          <n-input
            v-model:value="filters.keyword"
            placeholder="任务名 / 工作内容 / 备注，可用 | 分隔多个关键词"
            clearable
            @keyup.enter="query"
          />
        </label>
      </div>
      <div class="filter-actions">
        <span class="filter-hint">点色块编辑记录，点任务名查看该任务的时间段明细</span>
        <div class="filter-action-buttons">
          <n-button @click="resetFilters">重置</n-button>
          <n-button type="primary" @click="query">查询</n-button>
        </div>
      </div>
    </n-card>

    <n-card class="data-card" :bordered="false">
      <WorkTimelineGrid
        label-title="任务"
        :days="days"
        :columns="columns"
        :rows="rows"
        :loading="loading"
        empty-text="当前筛选条件下没有任务，可先新增任务再排活"
        :label-of="(record) => record.participants.join('、')"
        :title-of="
          (record) =>
            `${record.task_name}｜${formatRecordRange(record)}｜${record.participants.join('、')}`
        "
        :color-of="(record) => workBarPaletteIndex(record.task_id)"
        @select-interval="openRecord"
      >
        <template #label="{ row }">
          <button type="button" class="task-label" @click="selectTask(row.key)">
            {{ row.label }}
          </button>
          <n-tag size="small" :bordered="false" :type="workTaskStatusTypes[statusOf(row.key)]">
            {{ statusOf(row.key) }}
          </n-tag>
        </template>
        <template #actions="{ row }">
          <template v-if="canWrite">
            <n-tooltip trigger="hover">
              <template #trigger>
                <n-button size="tiny" quaternary @click="openEditTask(row.key)">
                  <template #icon>
                    <n-icon><CreateOutline /></n-icon>
                  </template>
                </n-button>
              </template>
              编辑任务
            </n-tooltip>
            <n-tooltip trigger="hover">
              <template #trigger>
                <n-button size="tiny" quaternary @click="openCreateRecord(row.key)">
                  <template #icon>
                    <n-icon><AddOutline /></n-icon>
                  </template>
                </n-button>
              </template>
              给这个任务排活
            </n-tooltip>
          </template>
        </template>
      </WorkTimelineGrid>

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

    <n-card v-if="selectedRow" class="data-card" :bordered="false">
      <div class="filter-heading">
        <div class="filter-title">
          {{ selectedRow.task.name }} · 时间段明细（{{ selectedRow.records.length }} 段）
        </div>
        <div class="filter-heading-actions">
          <n-button
            v-if="canWrite"
            size="small"
            @click="openCreateRecord(`task:${selectedRow.task.id}`)"
          >
            新增时间段
          </n-button>
          <n-button size="small" quaternary @click="selectedTaskId = null">收起</n-button>
        </div>
      </div>
      <n-data-table
        :bordered="false"
        :columns="detailColumns"
        :data="selectedRow.records"
        :row-key="(row: WorkRecord) => row.id"
      />
    </n-card>

    <WorkTaskFormModal v-model:show="showTaskModal" :task-id="editingTaskId" @saved="query" />
    <WorkRecordFormModal
      v-model:show="showRecordModal"
      :record-id="editingRecordId"
      :preset-task-id="presetTaskId"
      :preset-date="presetDate"
      :preset-participants="presetParticipants"
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

.filter-hint {
  color: var(--color-text-muted);
  font-size: 13px;
}

.filter-action-buttons {
  display: flex;
  flex: none;
  gap: 10px;
}

.filter-action-buttons :deep(.n-button) {
  min-width: 88px;
}

/* 任务名是选中入口：样式像正文，悬停才显示可点 */
.task-label {
  padding: 0;
  border: none;
  color: inherit;
  background: transparent;
  font: inherit;
  cursor: pointer;
}

.task-label:hover,
.task-label:focus-visible {
  color: var(--color-primary-strong-text);
  text-decoration: underline;
  outline: none;
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
