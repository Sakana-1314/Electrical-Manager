<script setup lang="ts">
/**
 * 人员视图：每个人的时间线——每天在干什么活。
 *
 * 人员不是名册实体：这里的人员清单由工作记录的参与人员派生（项目内出现过的姓名，
 * 去重后按中文排序），所以新姓名第一次出现就会自动成为一行。一行一个人的时间线，
 * 行内色块 = 他在所选区间内参与的一段工作（色块上写任务名，按任务固定配色）。
 *
 * 人员数量是车间量级（几十人），因此一次取回全部姓名再在前端按拼音排序，不做翻页；
 * 行尾可以直接给这个人排活（预填姓名的新增记录弹窗）。
 */
import { computed, ref } from 'vue'
import { NButton, NCard, NIcon, NInput, NTag, NTooltip } from 'naive-ui'
import { AddOutline } from '@vicons/ionicons5'
import { workApi } from '@/api/work'
import type { WorkRecord, WorkWorkerTimeline } from '@/api/generated'
import WorkRangePicker from '@/components/WorkRangePicker.vue'
import WorkRecordFormModal from '@/components/WorkRecordFormModal.vue'
import WorkTimelineGrid from '@/components/WorkTimelineGrid.vue'
import { usePagedTable } from '@/composables/usePagedTable'
import { useAuthStore } from '@/stores/auth'
import {
  buildDaySlots,
  buildHalfColumns,
  buildTimelineRow,
  formatRecordRange,
  initialWorkWorkerFilters,
  recordHalfKeys,
  shanghaiToday,
  workBarHash,
  workBarPaletteIndex,
  workWorkerFiltersFromQuery,
  workWorkerQuery,
  type WorkTimelineRow,
  type WorkWorkerFilters,
} from '@/utils/work'

const auth = useAuthStore()
const canWrite = computed(() => auth.can('work:write'))
const today = shanghaiToday()

const showRecordModal = ref(false)
const editingRecordId = ref<number | null>(null)
const presetDate = ref<string | null>(null)
const presetParticipants = ref<string[]>([])

const { items, total, loading, filters, query, resetFilters } = usePagedTable<
  WorkWorkerTimeline,
  WorkWorkerFilters
>({
  fetch: (f, pager) => workApi.workerTimeline({ ...workWorkerQuery(f), ...pager }),
  initialFilters: () => initialWorkWorkerFilters(today),
  // 人员一行一个人、车间量级：一次取回后在前端按拼音排序，不做翻页（后端按码位排序只作稳定顺序）
  paginated: false,
  defaultPageSize: 200,
  urlSync: {
    routeName: 'work-workers',
    fromQuery: (route) => workWorkerFiltersFromQuery(route.query as Record<string, unknown>, today),
    toQuery: (f) => workWorkerQuery(f),
  },
})

/** 姓名按中文（拼音）排序后的行数据。 */
const sortedItems = computed(() =>
  [...items.value].sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN')),
)

const days = computed(() => buildDaySlots(filters.range, today))
const columns = computed(() => buildHalfColumns(days.value))

const rows = computed<WorkTimelineRow<WorkRecord>[]>(() =>
  sortedItems.value.map((item) =>
    buildTimelineRow<WorkRecord>({
      key: `worker:${item.name}`,
      label: item.name,
      meta: `区间内 ${item.record_count} 条记录`,
      items: item.records,
      columns: columns.value,
      columnsOf: (record) => recordHalfKeys(record, filters.range),
    }),
  ),
)

function openRecord(record: WorkRecord): void {
  editingRecordId.value = record.id
  presetDate.value = null
  presetParticipants.value = []
  showRecordModal.value = true
}

/** 给某人排活：预填姓名与开始日期（默认取查询区间结束日）。 */
function openCreateRecord(name: string): void {
  editingRecordId.value = null
  presetDate.value = filters.range.end
  presetParticipants.value = [name]
  showRecordModal.value = true
}
</script>

<template>
  <div class="page">
    <div class="page-header">
      <div>
        <h1 class="page-title">人员视图</h1>
      </div>
    </div>

    <n-card class="filter-card" :bordered="false">
      <div class="filter-heading">
        <div class="filter-title">筛选条件</div>
        <div class="filter-heading-actions">
          <n-tag :bordered="false" round>区间内 {{ total }} 人</n-tag>
        </div>
      </div>
      <div class="filter-grid">
        <label class="filter-field filter-field-wide">
          <span>日期区间</span>
          <WorkRangePicker v-model="filters.range" />
        </label>
        <label class="filter-field">
          <span>人员</span>
          <n-input
            v-model:value="filters.keyword"
            placeholder="按姓名筛选，可用 | 分隔多个姓名"
            clearable
            @keyup.enter="query"
          />
        </label>
      </div>
      <div class="filter-actions">
        <span class="filter-hint">人员来自工作记录里填过的姓名；点色块编辑那条记录</span>
        <div class="filter-action-buttons">
          <n-button @click="resetFilters">重置</n-button>
          <n-button type="primary" @click="query">查询</n-button>
        </div>
      </div>
    </n-card>

    <n-card class="data-card" :bordered="false">
      <WorkTimelineGrid
        label-title="人员"
        :days="days"
        :columns="columns"
        :rows="rows"
        :loading="loading"
        empty-text="所选区间内还没有工作记录，可到任务视图排活"
        :label-of="(record) => record.task_name"
        :title-of="
          (record) =>
            `${record.task_name}｜${formatRecordRange(record)}｜${record.participants.join('、')}`
        "
        :color-of="(record) => workBarPaletteIndex(workBarHash(record.task_name))"
        @select-interval="openRecord"
      >
        <template #actions="{ row }">
          <n-tooltip v-if="canWrite" trigger="hover">
            <template #trigger>
              <n-button size="tiny" quaternary @click="openCreateRecord(row.label)">
                <template #icon>
                  <n-icon><AddOutline /></n-icon>
                </template>
              </n-button>
            </template>
            给「{{ row.label }}」排活
          </n-tooltip>
        </template>
      </WorkTimelineGrid>
    </n-card>

    <WorkRecordFormModal
      v-model:show="showRecordModal"
      :record-id="editingRecordId"
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
