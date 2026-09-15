<script setup lang="ts">
/** 隐患台账：筛选 + 分页 + 列显隐，整行点击进入编辑弹窗，删除在弹窗内。 */
import { computed, h, onMounted, ref } from 'vue'
import {
  NButton,
  NCard,
  NDataTable,
  NDatePicker,
  NInput,
  NPagination,
  NSelect,
  NTag,
  type DataTableColumns,
  type SelectOption,
} from 'naive-ui'
import { hazardApi } from '@/api/hazards'
import type { Hazard, HazardLevel, HazardStatus, HazardType, HazardUnit } from '@/api/generated'
import FilterExpandButton from '@/components/FilterExpandButton.vue'
import HazardFormModal from '@/components/HazardFormModal.vue'
import HazardLevelTag from '@/components/HazardLevelTag.vue'
import HazardStatusTag from '@/components/HazardStatusTag.vue'
import ImageThumbnails from '@/components/ImageThumbnails.vue'
import ColumnVisibilityPicker from '@/components/ColumnVisibilityPicker.vue'
import {
  getTableScrollX,
  preventTableColumnCompression,
  tableColumnWidths,
} from '@/constants/table'
import { usePagedTable } from '@/composables/usePagedTable'
import { useAuthStore } from '@/stores/auth'
import { createTableRowClickGuard } from '@/utils/tableRowNavigation'
import { toShanghaiDate } from '@/utils/time'
import {
  hazardLevels,
  hazardQuery,
  hazardStatuses,
  initialHazardFilters,
  isHazardOverdue,
  type HazardFilters,
} from '@/utils/hazard'

const auth = useAuthStore()
const canWrite = computed(() => auth.can('hazard:write'))

const units = ref<HazardUnit[]>([])
const rectifyPersons = ref<string[]>([])
const types = ref<HazardType[]>([])
const showModal = ref(false)
const editingId = ref<number | null>(null)
/** 扩展筛选（除第一排常用条件外的字段）默认收起，与其它列表页一致 */
const filterExpanded = ref(false)
const rowClickGuard = createTableRowClickGuard()

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
} = usePagedTable<Hazard, HazardFilters>({
  fetch: (f: HazardFilters, pager) =>
    hazardApi.hazards({
      page: pager.page,
      page_size: pager.page_size,
      ...hazardQuery(f),
    }),
  initialFilters: initialHazardFilters,
  rollbackEmptyPage: true,
  urlSync: {
    routeName: 'hazard-records',
    // 从 URL 恢复时校验枚举，避免手改 URL 传进非法值
    fromQuery: (route) => {
      const status = String(route.query.status || '')
      const level = String(route.query.level || '')
      const typeId = Number(route.query.hazard_type_id)
      const unitId = Number(route.query.hazard_unit_id)
      return {
        status: hazardStatuses.includes(status as HazardStatus) ? (status as HazardStatus) : null,
        level: hazardLevels.includes(level as HazardLevel) ? (level as HazardLevel) : null,
        hazard_type_id: Number.isFinite(typeId) && typeId > 0 ? typeId : null,
        hazard_unit_id: Number.isFinite(unitId) && unitId > 0 ? unitId : null,
        rectify_person: String(route.query.rectify_person || '') || null,
        area: String(route.query.area || ''),
        keyword: String(route.query.keyword || ''),
        dateRange: null,
      }
    },
    toQuery: (f) => hazardQuery(f),
  },
})

const statusOptions: SelectOption[] = hazardStatuses.map((value) => ({ label: value, value }))
const levelOptions: SelectOption[] = hazardLevels.map((value) => ({ label: value, value }))
const unitOptions = computed<SelectOption[]>(() =>
  units.value.map((unit) => ({ label: unit.name, value: unit.id })),
)
/** 隐患类型按大类分组，方便按「大类」整体筛选。 */
const typeOptions = computed(() => {
  const groups = new Map<string, SelectOption[]>()
  for (const item of types.value) {
    const group = groups.get(item.major) ?? []
    group.push({ label: item.minor, value: item.id })
    groups.set(item.major, group)
  }
  return [...groups].map(([major, children]) => ({ type: 'group', label: major, children }))
})

/** 整改员工是自由文本：选项来自库中已有值去重，可搜索可清除。 */
const rectifyPersonOptions = computed<SelectOption[]>(() =>
  rectifyPersons.value.map((person) => ({ label: person, value: person })),
)

const todayText = computed(() => toShanghaiDate(Date.now()))

/** 已启用的筛选条件数量（页头徽标）。 */
const activeFilterCount = computed(
  () =>
    [
      filters.status,
      filters.level,
      filters.hazard_type_id,
      filters.hazard_unit_id,
      filters.rectify_person,
      filters.area.trim() || null,
      filters.keyword.trim() || null,
      filters.dateRange,
    ].filter((value) => value !== null && value !== '').length,
)

const allColumns: { key: string; label: string; column: DataTableColumns<Hazard>[number] }[] = [
  {
    key: 'inspection_date',
    label: '检查日期',
    column: { title: '检查日期', key: 'inspection_date', width: tableColumnWidths.date },
  },
  {
    key: 'inspection_area',
    label: '检查区域',
    column: {
      title: '检查区域',
      key: 'inspection_area',
      width: 150,
      ellipsis: { tooltip: true },
    },
  },
  {
    key: 'description',
    label: '隐患描述',
    column: {
      title: '隐患描述',
      key: 'description',
      minWidth: tableColumnWidths.material,
      ellipsis: { tooltip: true },
    },
  },
  {
    key: 'type',
    label: '隐患类型',
    column: {
      title: '隐患类型',
      key: 'type',
      width: 180,
      render: (row) => `${row.major} / ${row.minor}`,
    },
  },
  {
    key: 'hazard_unit_name',
    label: '责任单位',
    column: {
      title: '责任单位',
      key: 'hazard_unit_name',
      width: tableColumnWidths.name,
      ellipsis: { tooltip: true },
    },
  },
  {
    key: 'person',
    label: '责任人',
    column: { title: '责任人', key: 'person', width: tableColumnWidths.person },
  },
  {
    key: 'rectify_person',
    label: '整改员工',
    column: {
      title: '整改员工',
      key: 'rectify_person',
      width: tableColumnWidths.person,
      render: (row) => row.rectify_person || '—',
    },
  },
  {
    key: 'due_date',
    label: '要求完成',
    column: { title: '要求完成', key: 'due_date', width: tableColumnWidths.date },
  },
  {
    key: 'status',
    label: '整改状态',
    column: {
      title: '整改状态',
      key: 'status',
      width: 160,
      render: (row) =>
        h('div', { class: 'action-row' }, [
          h(HazardStatusTag, { status: row.status }),
          isHazardOverdue(row.due_date, row.status, todayText.value)
            ? h(NTag, { size: 'small', type: 'error', bordered: false }, { default: () => '逾期' })
            : null,
        ]),
    },
  },
  {
    key: 'level',
    label: '隐患等级',
    column: {
      title: '隐患等级',
      key: 'level',
      width: tableColumnWidths.status,
      render: (row) => h(HazardLevelTag, { level: row.level }),
    },
  },
  {
    key: 'before_images',
    label: '整改前图片',
    column: {
      title: '整改前图片',
      key: 'before_images',
      width: 140,
      render: (row) => h(ImageThumbnails, { images: row.before_images }),
    },
  },
  {
    key: 'after_images',
    label: '整改后图片',
    column: {
      title: '整改后图片',
      key: 'after_images',
      width: 140,
      render: (row) => h(ImageThumbnails, { images: row.after_images }),
    },
  },
]

const visibleColumnKeys = ref<string[]>(allColumns.map((item) => item.key))
const fieldOptions = allColumns.map((item) => ({ label: item.label, value: item.key }))
const columns = computed(() =>
  preventTableColumnCompression<Hazard>(
    allColumns
      .filter((item) => visibleColumnKeys.value.includes(item.key))
      .map((item) => item.column),
  ),
)
const tableScrollX = computed(() => getTableScrollX(columns.value))

function openCreate(): void {
  editingId.value = null
  showModal.value = true
}

function openEdit(row: Hazard): void {
  editingId.value = row.id
  showModal.value = true
}

/** 整行可点击进入编辑（忽略行内按钮/图片预览/拖拽选字）。 */
function rowProps(row: Hazard) {
  return {
    style: 'cursor: pointer',
    onMousedown: rowClickGuard.onMouseDown,
    onClick: (event: MouseEvent) => {
      if (!rowClickGuard.shouldIgnore(event)) openEdit(row)
    },
  }
}

onMounted(async () => {
  try {
    const [unitList, typeList, options] = await Promise.all([
      hazardApi.units(),
      hazardApi.types(),
      hazardApi.filterOptions(),
    ])
    units.value = unitList
    types.value = typeList
    rectifyPersons.value = options.rectify_persons
  } catch {
    // 下拉数据加载失败不阻塞列表（筛选仍可用关键字与状态）
  }
})
</script>

<template>
  <div class="page">
    <div class="page-header">
      <div>
        <h1 class="page-title">隐患管理</h1>
      </div>
      <div class="page-actions">
        <n-button v-if="canWrite" type="primary" @click="openCreate">登记隐患</n-button>
      </div>
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
      <div class="filter-grid" :class="{ 'is-collapsed': !filterExpanded }">
        <label class="filter-field">
          <span>整改状态</span>
          <n-select
            v-model:value="filters.status"
            :options="statusOptions"
            placeholder="不限"
            clearable
          />
        </label>
        <label class="filter-field">
          <span>隐患类型</span>
          <n-select
            v-model:value="filters.hazard_type_id"
            :options="typeOptions"
            placeholder="按大类选择"
            clearable
            filterable
          />
        </label>
        <label class="filter-field">
          <span>隐患等级</span>
          <n-select
            v-model:value="filters.level"
            :options="levelOptions"
            placeholder="不限"
            clearable
          />
        </label>
        <label class="filter-field">
          <span>责任单位</span>
          <n-select
            v-model:value="filters.hazard_unit_id"
            :options="unitOptions"
            placeholder="不限"
            clearable
            filterable
          />
        </label>
        <label class="filter-field">
          <span>整改员工</span>
          <n-select
            v-model:value="filters.rectify_person"
            :options="rectifyPersonOptions"
            placeholder="不限"
            clearable
            filterable
          />
        </label>
        <label class="filter-field">
          <span>检查区域</span>
          <n-input
            v-model:value="filters.area"
            placeholder="如：201-冶炼主厂房"
            clearable
            @keyup.enter="query"
          />
        </label>
        <label class="filter-field">
          <span>描述 / 人员 / 单位关键字</span>
          <n-input
            v-model:value="filters.keyword"
            placeholder="模糊搜索"
            clearable
            @keyup.enter="query"
          />
        </label>
        <label class="filter-field filter-field-wide">
          <span>检查日期范围</span>
          <n-date-picker
            v-model:value="filters.dateRange"
            type="daterange"
            clearable
            class="full-width"
          />
        </label>
      </div>
      <div class="filter-actions">
        <ColumnVisibilityPicker
          :value="visibleColumnKeys"
          :options="fieldOptions"
          storage-key="hazard.records.visible-columns.v1"
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
        :row-props="rowProps"
        :row-key="(row: Hazard) => row.id"
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

    <HazardFormModal v-model:show="showModal" :hazard-id="editingId" @saved="query" />
  </div>
</template>

<style scoped>
/* 筛选区标题与操作行：与其它列表页同一套页面级样式（全局 styles.css 不提供这两条）。 */
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
