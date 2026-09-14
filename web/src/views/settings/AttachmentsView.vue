<script setup lang="ts">
import { h, ref, computed } from 'vue'
import { NButton, NImage, NTag, useDialog, useMessage } from 'naive-ui'
import type { Attachment } from '@/api/generated'
import { fileApi } from '@/api/files'
import {
  getTableScrollX,
  preventTableColumnCompression,
  tableColumnWidths,
} from '@/constants/table'
import { usePagedTable } from '@/composables/usePagedTable'
import { formatShanghaiTime } from '@/utils/time'
import { imagePreviewUrl } from '@/utils/image'

const message = useMessage()
const dialog = useDialog()

type AttachmentStatus = 'active' | 'deleted'
type ReferencedFilter = 'used' | 'free'
type AttachmentFilters = {
  keyword: string
  // 下拉不提供「全部」选项：未选择即为不限，因此空值用 null 表达而不是 'all'。
  status: AttachmentStatus | null
  referenced: ReferencedFilter | null
}

const deletingId = ref<string | null>(null)
const restoringId = ref<string | null>(null)
const deletingUnreferenced = ref(false)

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
  load,
} = usePagedTable<Attachment, AttachmentFilters>({
  fetch: (f, pager) =>
    fileApi.listAttachments({
      keyword: f.keyword.trim() || undefined,
      status: f.status ?? 'all',
      referenced: f.referenced === null ? undefined : f.referenced === 'used',
      page: pager.page,
      page_size: pager.page_size,
    }),
  initialFilters: () => ({ keyword: '', status: null, referenced: null }),
  onError: (error) => message.error(error instanceof Error ? error.message : '加载附件列表失败'),
  pageSizeOptions: [20, 50, 100, 200],
})

// 不含「全部」：清空选择就代表不限（两个下拉都可 clearable 清回不限）。
const statusOptions = [
  { label: '在用', value: 'active' },
  { label: '待删除', value: 'deleted' },
]
const referencedOptions = [
  { label: '已被引用', value: 'used' },
  { label: '未被引用', value: 'free' },
]

/** 只有「在用且未被任何业务引用」的图片才允许删除。 */
function canDelete(row: Attachment): boolean {
  return row.deleted_at == null && row.reference_count === 0
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

function confirmDelete(row: Attachment) {
  dialog.warning({
    draggable: true,
    title: '删除附件',
    content:
      `「${row.original_name}」当前被引用 0 次，可以删除。` +
      '删除后立即从业务中隐藏，但数据和文件会保留到次日凌晨 2 点：' +
      '系统扫描全库确认仍无新增引用，才真正删除数据库记录与磁盘文件（期间可撤销删除）。',
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      deletingId.value = row.id
      try {
        const result = await fileApi.removeImage(row.id)
        message.success(
          result.purge_after
            ? `已提交删除，将于 ${formatShanghaiTime(result.purge_after)} 复查后清除`
            : '已提交删除，等待凌晨 2 点复查后清除',
        )
        await load()
      } catch (error) {
        message.error(error instanceof Error ? error.message : '删除失败')
        return false
      } finally {
        deletingId.value = null
      }
    },
  })
}

async function restore(row: Attachment) {
  restoringId.value = row.id
  try {
    await fileApi.restoreAttachment(row.id)
    message.success('已撤销删除，图片恢复在用')
    await load()
  } catch (error) {
    message.error(error instanceof Error ? error.message : '撤销删除失败')
  } finally {
    restoringId.value = null
  }
}

function deleteUnreferenced() {
  dialog.warning({
    draggable: true,
    title: '删除未引用附件',
    content:
      '将把所有「被引用次数为 0」的图片一次性标记为待删除，被业务引用的图片不受影响。' +
      '这只是软删除：图片会立即从业务中隐藏，但数据库记录与磁盘文件会保留到次日凌晨 2 点——' +
      '系统复查全库确认仍无新增引用，才真正删除（期间可撤销删除）。',
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      deletingUnreferenced.value = true
      try {
        const result = await fileApi.deleteUnreferenced()
        message.success(
          result.deleted_count > 0
            ? `已提交 ${result.deleted_count} 张未引用图片的删除，将于 ` +
                `${formatShanghaiTime(result.purge_after)} 复查后清除`
            : '当前没有被引用的图片需要删除',
        )
        await load()
      } catch (error) {
        message.error(error instanceof Error ? error.message : '删除未引用失败')
        return false
      } finally {
        deletingUnreferenced.value = false
      }
    },
  })
}

const columns = preventTableColumnCompression<Attachment>([
  {
    title: '预览',
    key: 'preview',
    width: 84,
    render: (row) => {
      if (row.deleted_at != null) {
        return h('span', { class: 'muted' }, '待删除')
      }
      if (!row.file_exists) {
        return h('span', { class: 'warning-text' }, '文件缺失')
      }
      return h(NImage, {
        src: imagePreviewUrl(row.id, 96),
        alt: row.original_name,
        objectFit: 'cover',
        width: 56,
        height: 56,
        style: 'border-radius:8px;overflow:hidden',
      })
    },
  },
  {
    title: '文件名',
    key: 'original_name',
    width: tableColumnWidths.name,
    ellipsis: { tooltip: true },
  },
  {
    title: '尺寸',
    key: 'size',
    width: 116,
    render: (row) => `${row.width} × ${row.height}`,
  },
  {
    title: '大小',
    key: 'size_bytes',
    width: tableColumnWidths.unit,
    render: (row) => formatSize(row.size_bytes),
  },
  {
    title: '被引用次数',
    key: 'reference_count',
    width: 120,
    render: (row) =>
      h(
        NTag,
        {
          size: 'small',
          bordered: false,
          round: true,
          type: row.reference_count > 0 ? 'primary' : 'default',
        },
        { default: () => String(row.reference_count) },
      ),
  },
  {
    title: '状态',
    key: 'deleted_at',
    width: tableColumnWidths.status,
    render: (row) =>
      row.deleted_at == null
        ? h(
            NTag,
            { size: 'small', bordered: false, round: true, type: 'success' },
            { default: () => '在用' },
          )
        : h(
            NTag,
            { size: 'small', bordered: false, round: true, type: 'warning' },
            { default: () => '待删除' },
          ),
  },
  {
    title: '上传时间',
    key: 'created_at',
    width: tableColumnWidths.datetime,
    render: (row) => formatShanghaiTime(row.created_at),
  },
  {
    title: '操作',
    key: 'action',
    width: 120,
    render: (row) => {
      if (row.deleted_at != null) {
        return h(
          NButton,
          {
            size: 'small',
            secondary: true,
            loading: restoringId.value === row.id,
            onClick: () => void restore(row),
          },
          { default: () => '撤销删除' },
        )
      }
      return h(
        NButton,
        {
          size: 'small',
          type: 'error',
          secondary: true,
          disabled: !canDelete(row) || deletingId.value === row.id,
          loading: deletingId.value === row.id,
          title: canDelete(row) ? '删除附件' : '被引用次数不为 0，不能删除',
          onClick: () => confirmDelete(row),
        },
        { default: () => '删除' },
      )
    },
  },
])
const tableScrollX = getTableScrollX(columns)
const activeFilterCount = computed(
  () =>
    [filters.keyword.trim()].filter(Boolean).length +
    (filters.status === null ? 0 : 1) +
    (filters.referenced === null ? 0 : 1),
)
</script>

<template>
  <div class="page">
    <div class="page-header">
      <div>
        <h1 class="page-title">附件管理</h1>
      </div>
      <div class="page-actions">
        <n-space>
          <n-button secondary :loading="deletingUnreferenced" @click="deleteUnreferenced">
            删除未引用
          </n-button>
        </n-space>
      </div>
    </div>

    <n-card class="filter-card" title="筛选条件" :bordered="false">
      <template #header-extra>
        <span v-if="activeFilterCount" class="muted">已启用 {{ activeFilterCount }} 项</span>
      </template>
      <div class="filter-bar">
        <n-input
          v-model:value="filters.keyword"
          placeholder="文件名"
          clearable
          style="width: 220px"
          @keyup.enter="query"
        />
        <!-- 不设「全部」选项：清空选择即为不限 -->
        <n-select
          v-model:value="filters.status"
          :options="statusOptions"
          placeholder="删除状态"
          clearable
          style="width: 150px"
          aria-label="删除状态"
        />
        <n-select
          v-model:value="filters.referenced"
          :options="referencedOptions"
          placeholder="引用情况"
          clearable
          style="width: 150px"
          aria-label="引用情况"
        />
        <n-button type="primary" @click="query">查询</n-button>
        <n-button secondary @click="resetFilters">重置</n-button>
      </div>
    </n-card>

    <n-card class="data-card" :bordered="false">
      <n-data-table
        :bordered="false"
        :columns="columns"
        :data="items"
        :loading="loading"
        :scroll-x="tableScrollX"
        :row-key="(row: Attachment) => row.id"
      />
      <div class="pagination-bar">
        <n-pagination
          v-model:page="page"
          v-model:page-size="pageSize"
          :item-count="total"
          :page-sizes="[20, 50, 100, 200]"
          show-size-picker
          @update:page="changePage"
          @update:page-size="changePageSize"
        />
      </div>
    </n-card>
  </div>
</template>
