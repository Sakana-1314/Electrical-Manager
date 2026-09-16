<script setup lang="ts">
/**
 * 台账总览：台账记录列表（名称 / 型号 / 子项号 / 标签 / 数量 / 用途 / 备注 / 图片）。
 *
 * 单位跟随数量展示（如「12 台」），不单独占一列（与出入库明细、小程序列表同一口径）。
 *
 * 标签以多选筛选，命中「选中标签及其全部子孙标签」的记录（由服务端展开子孙）；
 * 整行点击进入编辑弹窗，写操作按 `ledger:write` 权限隐藏。
 */
import { computed, h, onMounted, ref } from 'vue'
import {
  NButton,
  NCard,
  NDataTable,
  NInput,
  NPagination,
  NTag,
  NTooltip,
  NTreeSelect,
  type DataTableColumns,
  type TreeSelectOption,
} from 'naive-ui'
import { ledgerApi } from '@/api/ledger'
import type { LedgerItem, LedgerTag } from '@/api/generated'
import ColumnVisibilityPicker from '@/components/ColumnVisibilityPicker.vue'
import ImageThumbnails from '@/components/ImageThumbnails.vue'
import LedgerItemFormModal from '@/components/LedgerItemFormModal.vue'
import {
  getTableScrollX,
  preventTableColumnCompression,
  tableColumnWidths,
} from '@/constants/table'
import { usePagedTable } from '@/composables/usePagedTable'
import { useAuthStore } from '@/stores/auth'
import {
  initialLedgerFilters,
  ledgerFiltersFromQuery,
  ledgerQuery,
  tagColumnDisplay,
  tagSelectOptions,
  type LedgerItemFilters,
} from '@/utils/ledger'
import { createTableRowClickGuard } from '@/utils/tableRowNavigation'

const auth = useAuthStore()
const canWrite = computed(() => auth.can('ledger:write'))

const tags = ref<LedgerTag[]>([])
const showModal = ref(false)
const editingId = ref<number | null>(null)
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
} = usePagedTable<LedgerItem, LedgerItemFilters>({
  fetch: (f: LedgerItemFilters, pager) =>
    ledgerApi.items({
      page: pager.page,
      page_size: pager.page_size,
      ...ledgerQuery(f),
    }),
  initialFilters: initialLedgerFilters,
  urlSync: {
    routeName: 'ledger-items',
    fromQuery: (route) => ledgerFiltersFromQuery(route.query as Record<string, unknown>),
    toQuery: (f) => ledgerQuery(f),
  },
})

/** 标签筛选/选择器共用同一棵标签树。 */
const tagOptions = computed<TreeSelectOption[]>(
  () => tagSelectOptions(tags.value) as unknown as TreeSelectOption[],
)

/** 已启用的筛选条件数量（筛选卡片标题右侧的徽标）。 */
const activeFilterCount = computed(
  () => [filters.keyword.trim() || null, filters.tag_ids.length || null].filter(Boolean).length,
)

const allColumns: { key: string; label: string; column: DataTableColumns<LedgerItem>[number] }[] = [
  {
    key: 'name',
    label: '名称',
    column: {
      title: '名称',
      key: 'name',
      width: tableColumnWidths.name,
      ellipsis: { tooltip: true },
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
    },
  },
  {
    key: 'subitem_no',
    label: '子项号',
    column: {
      title: '子项号',
      key: 'subitem_no',
      width: tableColumnWidths.code,
      ellipsis: { tooltip: true },
      render: (row) => row.subitem_no || '—',
    },
  },
  {
    key: 'tags',
    label: '标签',
    column: {
      title: '标签',
      key: 'tags',
      width: tableColumnWidths.model,
      render: (row) => {
        const { visible, extra } = tagColumnDisplay(row.tags)
        if (!visible.length) return '—'
        const chips = visible.map((tag) =>
          h(
            NTag,
            { size: 'small', bordered: false, type: 'info', title: tag.path },
            { default: () => tag.name },
          ),
        )
        if (extra) {
          chips.push(
            h(
              NTooltip,
              { trigger: 'hover' },
              {
                trigger: () =>
                  h(NTag, { size: 'small', bordered: false }, { default: () => `+${extra}` }),
                default: () => row.tags.map((tag) => tag.path).join('、'),
              },
            ),
          )
        }
        return h('div', { class: 'action-row' }, chips)
      },
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
      // 单位与数量一起展示，如「12 台」
      render: (row) => `${row.quantity} ${row.unit_name}`,
    },
  },
  {
    key: 'usage',
    label: '用途',
    column: {
      title: '用途',
      key: 'usage',
      minWidth: tableColumnWidths.text,
      ellipsis: { tooltip: true },
      render: (row) => row.usage || '—',
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

// 列显隐的本地键带版本号：新增列时版本 +1，让旧选择失效，新列默认可见（与申购各页一致）。
const visibleColumnKeys = ref<string[]>(allColumns.map((item) => item.key))
const fieldOptions = allColumns.map((item) => ({ label: item.label, value: item.key }))
const columns = computed(() =>
  preventTableColumnCompression<LedgerItem>(
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

function openEdit(row: LedgerItem): void {
  editingId.value = row.id
  showModal.value = true
}

/** 整行可点击进入编辑（忽略行内链接、图片预览与拖拽选字）。 */
function rowProps(row: LedgerItem) {
  return {
    style: 'cursor: pointer',
    onMousedown: rowClickGuard.onMouseDown,
    onClick: (event: MouseEvent) => {
      if (!rowClickGuard.shouldIgnore(event)) openEdit(row)
    },
  }
}

async function loadTags(): Promise<void> {
  try {
    tags.value = await ledgerApi.tags()
  } catch {
    // 标签下拉加载失败不阻塞列表（关键字与分页仍可用）
  }
}

onMounted(loadTags)
</script>

<template>
  <div class="page">
    <div class="page-header">
      <div>
        <h1 class="page-title">台账总览</h1>
      </div>
      <div class="page-actions">
        <n-button v-if="canWrite" type="primary" @click="openCreate">新增台账</n-button>
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
        <label class="filter-field">
          <span>名称 / 型号 / 备注</span>
          <n-input
            v-model:value="filters.keyword"
            placeholder="模糊搜索，可用 | 分隔多个关键词"
            clearable
            @keyup.enter="query"
          />
        </label>
        <label class="filter-field">
          <span>标签</span>
          <n-tree-select
            v-model:value="filters.tag_ids"
            :options="tagOptions"
            multiple
            clearable
            filterable
            placeholder="选父标签会一并包含子标签"
          />
        </label>
      </div>
      <div class="filter-actions">
        <ColumnVisibilityPicker
          :value="visibleColumnKeys"
          :options="fieldOptions"
          storage-key="ledger.items.visible-columns.v2"
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
        :row-key="(row: LedgerItem) => row.id"
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

    <LedgerItemFormModal v-model:show="showModal" :item-id="editingId" @saved="query" />
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
