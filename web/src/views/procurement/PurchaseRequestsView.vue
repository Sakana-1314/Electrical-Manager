<script setup lang="ts">
import { computed, h, onMounted, reactive, ref, watch } from 'vue'
import {
  NTag,
  useDialog,
  useMessage,
  type DataTableBaseColumn,
  type DataTableColumns,
} from 'naive-ui'
import { useRoute, useRouter } from 'vue-router'
import type {
  FileObject,
  PurchaseRecord,
  PurchaseRecordBatchUpdate,
  PurchaseRecordFilterOptions,
  PurchaseRecordResultExportRequest,
  PurchaseRecordWrite,
} from '@/api/generated'
import { procurementApi } from '@/api/procurement'
import { AppError } from '@/api/client'
import { aiSearchApi } from '@/api/aiSearch'
import ColumnVisibilityPicker from '@/components/ColumnVisibilityPicker.vue'
import ExportLoadingOverlay from '@/components/ExportLoadingOverlay.vue'
import ExportButton from '@/components/ExportButton.vue'
import FilterExpandButton from '@/components/FilterExpandButton.vue'
import ShareLinkDialog from '@/components/ShareLinkDialog.vue'
import ImageThumbnails from '@/components/ImageThumbnails.vue'
import ImageUploader from '@/components/ImageUploader.vue'
import MaterialSelector from '@/components/MaterialSelector.vue'
import QuantityInput from '@/components/QuantityInput.vue'
import SortableHeader, { type SortOptionKey } from '@/components/SortableHeader.vue'
import type { ExportOption } from '@/types/export'
import {
  getTableScrollX,
  preventTableColumnCompression,
  tableColumnWidths,
} from '@/constants/table'
import { createTableRowClickGuard } from '@/utils/tableRowNavigation'
import { dateToTimestamp, formatDate, formatShanghaiTime, toShanghaiDate } from '@/utils/time'
import { downloadFromUrl, exportDownloadUrl } from '@/utils/download'
import { routeQueryString } from '@/utils/routeQuery'
import { useExportJob } from '@/composables/useExportJob'
import { useImplicitAiSearch } from '@/composables/useImplicitAiSearch'
import { useMaskCloseGuard } from '@/composables/useMaskCloseGuard'
import { usePagedTable } from '@/composables/usePagedTable'
import { useShiftWheelHorizontalScroll } from '@/composables/useShiftWheelHorizontalScroll'
import { renderMaterialCode, renderTwoLineText } from '@/utils/tableText'
import { useAuthStore } from '@/stores/auth'
import { purchaseCategoryOptions } from '@/constants/purchase'

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()
const message = useMessage()
const dialog = useDialog()
const rowClickGuard = createTableRowClickGuard()
/** 详情弹窗的写权限：无写权限时字段禁用、页脚只留「取消」（与原详情页一致）。 */
const canWrite = computed(() => auth.can('purchase:write'))
const filterExpanded = ref(false)
const EMPTY_STATUS_FILTER = '__empty_status__'
const EMPTY_SUBITEM_FILTER = '__empty_subitem_no__'
type RecordFilters = {
  name: string
  model_spec: string
  usage: string
  trace_no: string
  purchase_order_no: string
  actual_demand_person: string | null
  purchase_responsible: string | null
  salesperson: string | null
  status: string | null
  subitem_no: string | null
  sort_by: RecordColumnKey | null
  sort_order: 'asc' | 'desc' | null
}
// fromQuery 在 usePagedTable setup 期同步执行，早于 availableColumns 定义，
// 需在 hook 调用前声明运行时值用于校验 URL 恢复的 sort_by 合法性。
const RECORD_SORTABLE_KEYS: readonly RecordColumnKey[] = [
  'plan_date',
  'purchase_date',
  'purchase_order_no',
  'trace_no',
  'contract_no',
  'vessel_no',
  'consolidation_date',
  'consolidation_port',
  'sailing_date',
  'contract_sign_date',
  'category',
  'demand_department',
  'material_name',
  'purchase_qty',
  'usage',
  'actual_demand_person',
  'purchase_responsible',
  'salesperson',
  'status',
  'subitem_no',
]
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
  syncRoute,
} = usePagedTable<PurchaseRecord, RecordFilters>({
  fetch: (f, pager) =>
    procurementApi.records({
      page: pager.page,
      page_size: pager.page_size,
      name: searchName.value,
      model_spec: f.model_spec.trim() || undefined,
      usage: f.usage.trim() || undefined,
      trace_no: f.trace_no.trim() || undefined,
      purchase_order_no: f.purchase_order_no.trim() || undefined,
      actual_demand_person: f.actual_demand_person?.trim() || undefined,
      purchase_responsible: f.purchase_responsible?.trim() || undefined,
      salesperson: f.salesperson?.trim() || undefined,
      status: f.status && f.status !== EMPTY_STATUS_FILTER ? f.status : undefined,
      empty_status: f.status === EMPTY_STATUS_FILTER || undefined,
      subitem_no: f.subitem_no && f.subitem_no !== EMPTY_SUBITEM_FILTER ? f.subitem_no : undefined,
      empty_subitem_no: f.subitem_no === EMPTY_SUBITEM_FILTER || undefined,
      sort_by: f.sort_by || undefined,
      sort_order: f.sort_order || undefined,
    }),
  initialFilters: () => ({
    name: '',
    model_spec: '',
    usage: '',
    trace_no: '',
    purchase_order_no: '',
    actual_demand_person: null,
    purchase_responsible: null,
    salesperson: null,
    status: null,
    subitem_no: null,
    sort_by: null,
    sort_order: null,
  }),
  onLoaded: () => {
    checkedRowKeys.value = []
  },
  beforeQuery: () => clearExpandedName(),
  urlSync: {
    routeName: 'purchase-records',
    fromQuery: (route) => {
      const sortBy = routeQueryString(route.query.sort_by)
      const sortOrder = routeQueryString(route.query.sort_order)
      return {
        name: routeQueryString(route.query.name),
        model_spec: routeQueryString(route.query.model_spec),
        usage: routeQueryString(route.query.usage),
        trace_no: routeQueryString(route.query.trace_no),
        purchase_order_no: routeQueryString(route.query.purchase_order_no),
        actual_demand_person: routeQueryString(route.query.actual_demand_person) || null,
        purchase_responsible: routeQueryString(route.query.purchase_responsible) || null,
        salesperson: routeQueryString(route.query.salesperson) || null,
        status: routeQueryString(route.query.status) || null,
        subitem_no: routeQueryString(route.query.subitem_no) || null,
        sort_by: RECORD_SORTABLE_KEYS.includes(sortBy as RecordColumnKey)
          ? (sortBy as RecordColumnKey)
          : null,
        sort_order: sortOrder === 'asc' || sortOrder === 'desc' ? sortOrder : null,
      }
    },
    toQuery: (f) => ({
      name: f.name,
      model_spec: f.model_spec,
      usage: f.usage,
      trace_no: f.trace_no,
      purchase_order_no: f.purchase_order_no,
      actual_demand_person: f.actual_demand_person || undefined,
      purchase_responsible: f.purchase_responsible || undefined,
      salesperson: f.salesperson || undefined,
      status: f.status || undefined,
      subitem_no: f.subitem_no || undefined,
      sort_by: f.sort_by || undefined,
      sort_order: f.sort_order || undefined,
    }),
    // 详情弹窗的 id 不属于筛选状态，翻页/筛选/keepAlive 重新激活时都必须留在 URL 里
    preservedQueryKeys: ['detail'],
  },
})
const { searchName, applyExpandedName, clearExpandedName } = useImplicitAiSearch(() => filters.name)
const aiAvailable = ref(false)
const aiSearching = ref(false)
const batchUpdating = ref(false)
const showBatchEdit = ref(false)
const checkedRowKeys = ref<Array<string | number>>([])
const tableAreaRef = ref<HTMLElement | null>(null)
const exportOptions = computed<ExportOption[]>(() => [
  { label: `导出查询结果（共 ${total.value} 条）`, key: 'results' },
  {
    label: `链接分享（已选 ${selectedRecords.value.length} 条）`,
    key: 'share',
    disabled: !selectedRecords.value.length,
  },
])
const showShare = ref(false)
// 异步导出（含图片渲染耗时较长）：提交 202 秒回 → 轮询 → 下载
const { running: resultExporting, run: runResultExport } =
  useExportJob<PurchaseRecordResultExportRequest>({
    start: procurementApi.exportRecordResults,
    poll: procurementApi.excelExportJob,
  })
// 单条详情弹窗（点击行打开，与申购计划一致）；详情 id 写成 URL 的 ?detail=
const showEdit = ref(false)
const editing = ref<PurchaseRecord | null>(null)
const detailId = ref<number | null>(null)
const editSaving = ref(false)
const editAdvancedSections = ref<string[]>([])
const editPlanDate = ref<number | null>(null)
const editPurchaseDate = ref<number | null>(null)
const editConsolidationDate = ref<number | null>(null)
const editSailingDate = ref<number | null>(null)
const editContractSignDate = ref<number | null>(null)
const editImages = ref<FileObject[]>([])
/** 图片附件是否还有在途上传：有则禁用保存，避免 `image_ids` 漏掉还没传完的图。 */
const editImagesUploading = ref(false)
const editForm = reactive<PurchaseRecordWrite>({
  plan_date: '',
  material_code: '',
  category: '',
  demand_department: '',
  material_name: '',
  model_spec: '',
  unit_name: '',
  actual_demand_person: '',
  purchase_responsible: '',
  purchase_qty: '',
  usage: '',
  subitem_no: '',
  plan_remark: '',
  stock_material_id: undefined,
  image_ids: [],
  purchase_order_no: '',
  trace_no: '',
  contract_no: '',
  vessel_no: '',
  consolidation_date: undefined,
  consolidation_port: '',
  sailing_date: undefined,
  contract_sign_date: undefined,
  purchase_date: '',
  salesperson: '',
  status: '',
  record_remark: '',
  version: 1,
})
// 「转为申购计划」
const restoring = ref(false)
// 「再次申购」：以记录快照预填新申购计划
const showReapply = ref(false)
const reapplySaving = ref(false)
const reapplyPlanDate = ref<number | null>(null)
const reapplyForm = reactive({
  material_code: '',
  category: null as string | null,
  name: '',
  model_spec: '',
  unit_name: '',
  planned_qty: '',
  actual_demand_person: '',
  purchase_responsible: '',
  demand_department: '',
  usage: '',
  subitem_no: '',
  plan_remark: '',
})
const filterOptions = ref<PurchaseRecordFilterOptions>({
  actual_demand_persons: [],
  purchase_responsibles: [],
  subitem_nos: [],
  categories: [],
  salespersons: [],
  statuses: [],
})
const actualDemandPersonOptions = computed(() =>
  filterOptions.value.actual_demand_persons.map((value) => ({ label: value, value })),
)
const purchaseResponsibleOptions = computed(() =>
  filterOptions.value.purchase_responsibles.map((value) => ({ label: value, value })),
)
const salespersonOptions = computed(() =>
  filterOptions.value.salespersons.map((value) => ({ label: value, value })),
)
const statusOptions = computed(() => [
  { label: '空状态', value: EMPTY_STATUS_FILTER },
  ...filterOptions.value.statuses.map((value) => ({ label: value, value })),
])
const subitemOptions = computed(() => [
  { label: '空子项号', value: EMPTY_SUBITEM_FILTER },
  ...filterOptions.value.subitem_nos.map((value) => ({ label: value, value })),
])
const selectedRecords = computed(() => {
  const selected = new Set(checkedRowKeys.value.map(Number))
  return items.value.filter((item) => selected.has(item.line_id))
})
const batchEditForm = reactive({
  update_plan_date: false,
  plan_date: null as number | null,
  update_purchase_order_no: false,
  purchase_order_no: '',
  update_trace_no: false,
  trace_no: '',
  update_contract_no: false,
  contract_no: '',
  update_vessel_no: false,
  vessel_no: '',
  update_consolidation_date: false,
  consolidation_date: null as number | null,
  update_consolidation_port: false,
  consolidation_port: '',
  update_sailing_date: false,
  sailing_date: null as number | null,
  update_contract_sign_date: false,
  contract_sign_date: null as number | null,
  update_purchase_date: false,
  purchase_date: null as number | null,
  update_actual_demand_person: false,
  actual_demand_person: '',
  update_purchase_responsible: false,
  purchase_responsible: '',
  update_salesperson: false,
  salesperson: '',
  update_status: false,
  status: '',
  update_record_remark: false,
  record_remark: '',
})
const activeFilterCount = computed(
  () =>
    Object.entries(filters)
      // 排序字段不视为启用筛选
      .filter(([key]) => key !== 'sort_by' && key !== 'sort_order')
      .filter(([, value]) => value?.trim()).length,
)
type RecordColumnKey =
  | 'plan_date'
  | 'purchase_order_no'
  | 'trace_no'
  | 'contract_no'
  | 'vessel_no'
  | 'consolidation_date'
  | 'consolidation_port'
  | 'sailing_date'
  | 'contract_sign_date'
  | 'category'
  | 'demand_department'
  | 'material_name'
  | 'model_spec'
  | 'material_code'
  | 'purchase_qty'
  | 'usage'
  | 'actual_demand_person'
  | 'purchase_responsible'
  | 'salesperson'
  | 'status'
  | 'purchase_date'
  | 'images'
  | 'subitem_no'

const availableColumns: Array<{
  key: RecordColumnKey
  label: string
  column: DataTableBaseColumn<PurchaseRecord>
}> = [
  {
    key: 'plan_date',
    label: '需求日期',
    column: {
      title: '需求日期',
      key: 'plan_date',
      width: tableColumnWidths.date,
      render: (row) => formatDate(row.plan_date),
    },
  },
  {
    key: 'purchase_date',
    label: '申购日期',
    column: {
      title: '申购日期',
      key: 'purchase_date',
      width: tableColumnWidths.date,
      render: (row) => (row.purchase_date ? formatDate(row.purchase_date) : '\\'),
    },
  },
  {
    key: 'purchase_order_no',
    label: '申购单号',
    column: {
      title: '申购单号',
      key: 'purchase_order_no',
      width: tableColumnWidths.identifier,
      render: (row) => renderTwoLineText(row.purchase_order_no),
    },
  },
  {
    key: 'trace_no',
    label: '追溯号',
    column: {
      title: '追溯号',
      key: 'trace_no',
      width: tableColumnWidths.identifier,
      render: (row) => renderTwoLineText(row.trace_no),
    },
  },
  {
    key: 'contract_no',
    label: '合同号',
    column: {
      title: '合同号',
      key: 'contract_no',
      width: tableColumnWidths.identifier,
      render: (row) => renderTwoLineText(row.contract_no),
    },
  },
  {
    key: 'vessel_no',
    label: '船号',
    column: {
      title: '船号',
      key: 'vessel_no',
      width: tableColumnWidths.identifier,
      render: (row) => renderTwoLineText(row.vessel_no),
    },
  },
  {
    key: 'consolidation_date',
    label: '集港日期',
    column: {
      title: '集港日期',
      key: 'consolidation_date',
      width: tableColumnWidths.date,
      render: (row) => (row.consolidation_date ? formatDate(row.consolidation_date) : '\\'),
    },
  },
  {
    key: 'consolidation_port',
    label: '集港港口',
    column: {
      title: '集港港口',
      key: 'consolidation_port',
      width: tableColumnWidths.identifier,
      render: (row) => renderTwoLineText(row.consolidation_port),
    },
  },
  {
    key: 'sailing_date',
    label: '发船日期',
    column: {
      title: '发船日期',
      key: 'sailing_date',
      width: tableColumnWidths.date,
      render: (row) => (row.sailing_date ? formatDate(row.sailing_date) : '\\'),
    },
  },
  {
    key: 'contract_sign_date',
    label: '合同签订日期',
    column: {
      title: '合同签订日期',
      key: 'contract_sign_date',
      width: tableColumnWidths.date,
      render: (row) => (row.contract_sign_date ? formatDate(row.contract_sign_date) : '\\'),
    },
  },
  {
    key: 'category',
    label: '类别',
    column: {
      title: '类别',
      key: 'category',
      width: tableColumnWidths.person,
      render: (row) => renderTwoLineText(row.category),
    },
  },
  {
    key: 'demand_department',
    label: '需求部门',
    column: {
      title: '需求部门',
      key: 'demand_department',
      width: tableColumnWidths.person,
      render: (row) => renderTwoLineText(row.demand_department),
    },
  },
  {
    key: 'material_name',
    label: '物资',
    column: {
      title: '物资',
      key: 'material_name',
      width: tableColumnWidths.material,
      // 只显示名称 + 型号：物料编码是独立列（默认隐藏），需要时在「列」下拉里勾选
      render: (row) =>
        h(
          'div',
          {
            class: 'table-material-summary',
            title: `${row.material_name}\n${row.model_spec}`,
          },
          [
            h('div', { class: 'table-material-summary__name' }, row.material_name),
            h('div', { class: 'table-material-summary__meta' }, row.model_spec),
          ],
        ),
    },
  },
  {
    key: 'material_code',
    label: '物料编码',
    column: {
      title: '物料编码',
      key: 'material_code',
      width: tableColumnWidths.code,
      // 与申购计划 / 周期性计划同一渲染：缺编码时统一显示黄色「暂无编码」
      render: (row) => renderMaterialCode(row.material_code),
    },
  },
  {
    key: 'purchase_qty',
    label: '申购数量',
    column: {
      title: '申购数量',
      key: 'purchase_qty',
      width: tableColumnWidths.quantity,
      render: (row) => renderTwoLineText(`${row.purchase_qty} ${row.unit_name}`),
    },
  },
  {
    key: 'usage',
    label: '用途',
    column: {
      title: '用途',
      key: 'usage',
      width: tableColumnWidths.text,
      render: (row) => renderTwoLineText(row.usage),
    },
  },
  {
    key: 'subitem_no',
    label: '子项号',
    column: {
      title: '子项号',
      key: 'subitem_no',
      width: tableColumnWidths.person,
      render: (row) => renderTwoLineText(row.subitem_no),
    },
  },
  {
    key: 'actual_demand_person',
    label: '提报员工',
    column: {
      title: '提报员工',
      key: 'actual_demand_person',
      width: tableColumnWidths.person,
      render: (row) => renderTwoLineText(row.actual_demand_person),
    },
  },
  {
    key: 'purchase_responsible',
    label: '实际需求人',
    column: {
      title: '实际需求人',
      key: 'purchase_responsible',
      width: tableColumnWidths.person,
      render: (row) => renderTwoLineText(row.purchase_responsible),
    },
  },
  {
    key: 'salesperson',
    label: '业务员',
    column: {
      title: '业务员',
      key: 'salesperson',
      width: tableColumnWidths.person,
      render: (row) => renderTwoLineText(row.salesperson),
    },
  },
  {
    key: 'status',
    label: '状态',
    column: {
      title: '状态',
      key: 'status',
      width: tableColumnWidths.status,
      render: (row) => h(NTag, null, { default: () => row.status || '\\' }),
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
const optionalShippingColumnKeys = new Set<RecordColumnKey>([
  'contract_no',
  'vessel_no',
  'consolidation_date',
  'consolidation_port',
  'sailing_date',
  'contract_sign_date',
])
// 默认隐藏的列：运输信息（按需勾选）与物料编码（物资列已给出名称与型号，编码默认收起）
const defaultHiddenColumnKeys = new Set<RecordColumnKey>([
  ...optionalShippingColumnKeys,
  'material_code',
])
const visibleColumnKeys = ref<RecordColumnKey[]>(
  availableColumns.filter((item) => !defaultHiddenColumnKeys.has(item.key)).map((item) => item.key),
)
const fieldOptions = availableColumns.map((item) => ({ label: item.label, value: item.key }))
const columns = computed<DataTableColumns<PurchaseRecord>>(() => {
  const sortBy = filters.sort_by
  const sortOrder = filters.sort_order
  return preventTableColumnCompression([
    {
      type: 'selection',
      disabled: () => !auth.can('purchase:write'),
    },
    ...availableColumns
      .filter((item) => visibleColumnKeys.value.includes(item.key))
      .map((item) => ({
        ...item.column,
        // 列头改为下拉菜单（默认/升序/降序），不再用 Naive UI 的内置点击循环
        title: () =>
          h(SortableHeader, {
            label: item.label,
            sortByKey: item.key,
            sortBy,
            sortOrder,
            onSelect: (order) => handleSortSelect(item.key, order),
          }),
      })),
  ])
})
function handleSortSelect(key: RecordColumnKey, order: SortOptionKey) {
  if (order === 'default') {
    filters.sort_by = null
    filters.sort_order = null
  } else {
    filters.sort_by = key
    filters.sort_order = order
  }
  void query()
}
const tableScrollX = computed(() => getTableScrollX(columns.value))
useShiftWheelHorizontalScroll(tableAreaRef)
function setVisibleColumnKeys(value: string[]) {
  visibleColumnKeys.value = value as RecordColumnKey[]
}
function rowProps(row: PurchaseRecord) {
  return {
    style: 'cursor: pointer',
    onMousedown: rowClickGuard.onMouseDown,
    onClick: (event: MouseEvent) => {
      if (rowClickGuard.shouldIgnore(event)) return
      // Ctrl/Meta+点击在新标签页打开详情（列表页 + ?detail=）
      if (event.ctrlKey || event.metaKey) {
        const href = router.resolve({
          name: 'purchase-records',
          query: { detail: String(row.line_id) },
        }).href
        window.open(href, '_blank')
        return
      }
      // 点击行直接打开详情弹窗（与申购计划一致）
      openEditRecord(row)
    },
  }
}

async function loadFilterOptions() {
  filterOptions.value = await procurementApi.recordFilterOptions()
}

async function loadAiStatus() {
  try {
    aiAvailable.value = (await aiSearchApi.status()).available
  } catch {
    aiAvailable.value = false
  }
}

async function aiQuery() {
  const value = filters.name.trim()
  if (!value) {
    message.warning('请先输入物资名称')
    return
  }
  aiSearching.value = true
  try {
    const data = await aiSearchApi.expand(value)
    applyExpandedName(data.expanded)
    // 走原语而非 query()，避免 beforeQuery 清掉刚 apply 的扩展名
    page.value = 1
    await syncRoute()
    await load()
  } catch (error) {
    message.error(error instanceof Error ? error.message : '智能查询失败')
  } finally {
    aiSearching.value = false
  }
}
async function exportResults() {
  // 物资列在导出时展开成「名称 / 型号 / 编码」三列（Excel 一直如此），
  // 若用户又勾选了独立的「物料编码」列，这里用 Set 去重，避免导出两列编码。
  const exportColumns = [
    ...new Set(
      availableColumns
        .filter((item) => visibleColumnKeys.value.includes(item.key))
        .flatMap((item): RecordColumnKey[] => {
          if (item.key === 'material_name') return ['material_name', 'model_spec', 'material_code']
          return [item.key]
        }),
    ),
  ]
  if (!exportColumns.length) {
    message.warning('请至少显示一个字段')
    return
  }
  try {
    const job = await runResultExport({
      columns: exportColumns,
      name: searchName.value,
      model_spec: filters.model_spec.trim() || undefined,
      usage: filters.usage.trim() || undefined,
      trace_no: filters.trace_no.trim() || undefined,
      purchase_order_no: filters.purchase_order_no.trim() || undefined,
      actual_demand_person: filters.actual_demand_person?.trim() || undefined,
      purchase_responsible: filters.purchase_responsible?.trim() || undefined,
      salesperson: filters.salesperson?.trim() || undefined,
      status: filters.status && filters.status !== EMPTY_STATUS_FILTER ? filters.status : undefined,
      empty_status: filters.status === EMPTY_STATUS_FILTER,
      subitem_no:
        filters.subitem_no && filters.subitem_no !== EMPTY_SUBITEM_FILTER
          ? filters.subitem_no
          : undefined,
      empty_subitem_no: filters.subitem_no === EMPTY_SUBITEM_FILTER,
      sort_by: filters.sort_by || undefined,
      sort_order: filters.sort_order || 'asc',
    })
    if (!job.file_uuid) {
      throw new AppError({
        code: 'EXPORT_FILE_EXPIRED',
        message: '导出文件不存在，请重新导出；若仍失败请确认后端服务已更新到最新版本',
        request_id: '',
      })
    }
    const date = toShanghaiDate(Date.now()).replace(/-/g, '')
    const rows = job.result?.rows
    // 下载链接不鉴权：直接以浏览器原生下载方式保存文件（凭接口返回的 file_uuid）。
    downloadFromUrl(
      exportDownloadUrl(job.file_uuid),
      job.download_filename ?? `申购记录导出_${date}.xlsx`,
    )
    message.success(rows != null ? `查询结果已导出（共${rows}条）` : '查询结果已导出')
  } catch (error) {
    message.error(error instanceof Error ? error.message : '导出失败')
  }
}

function handleExport(key: string) {
  if (key === 'results') void exportResults()
  if (key === 'share') showShare.value = true
}

function syncEditForm(value: PurchaseRecord) {
  Object.assign(editForm, {
    plan_date: value.plan_date,
    material_code: value.material_code || '',
    category: value.category || '',
    demand_department: value.demand_department,
    material_name: value.material_name,
    model_spec: value.model_spec,
    unit_name: value.unit_name,
    actual_demand_person: value.actual_demand_person,
    purchase_responsible: value.purchase_responsible,
    purchase_qty: value.purchase_qty,
    usage: value.usage,
    subitem_no: value.subitem_no || '',
    plan_remark: value.plan_remark || '',
    stock_material_id: value.stock_material_id,
    image_ids: value.images.map((image) => image.id),
    purchase_order_no: value.purchase_order_no || '',
    trace_no: value.trace_no || '',
    contract_no: value.contract_no || '',
    vessel_no: value.vessel_no || '',
    consolidation_date: value.consolidation_date,
    consolidation_port: value.consolidation_port || '',
    sailing_date: value.sailing_date,
    contract_sign_date: value.contract_sign_date,
    purchase_date: value.purchase_date || '',
    salesperson: value.salesperson || '',
    status: value.status,
    record_remark: value.record_remark || '',
    version: value.version,
  })
  editPlanDate.value = dateToTimestamp(value.plan_date)
  editPurchaseDate.value = dateToTimestamp(value.purchase_date)
  editConsolidationDate.value = dateToTimestamp(value.consolidation_date)
  editSailingDate.value = dateToTimestamp(value.sailing_date)
  editContractSignDate.value = dateToTimestamp(value.contract_sign_date)
  editImages.value = [...value.images]
}

function openEditRecord(row: PurchaseRecord) {
  editing.value = row
  detailId.value = row.line_id
  void syncDetailQuery(row.line_id)
  syncEditForm(row)
  editAdvancedSections.value = []
  editBaseline.value = editSnapshot()
  showEdit.value = true
}

/** 把当前打开的详情 id 写进 URL（`?detail=`），刷新 / 新标签页 / 收藏都能回到同一条记录。 */
async function syncDetailQuery(id: number | null) {
  const current = routeQueryString(route.query.detail)
  const next = id === null ? undefined : String(id)
  if (current === (next ?? '')) return
  await router.replace({ query: { ...route.query, detail: next } })
}

/**
 * 未保存修改的脏判定：与打开时的快照比对（`watch(deep)` 会被 `syncEditForm` 回填的
 * 刷新时序误判成用户改动）。
 */
const editBaseline = ref('')
function editSnapshot(): string {
  return JSON.stringify({
    form: { ...editForm },
    plan_date: editPlanDate.value,
    purchase_date: editPurchaseDate.value,
    consolidation_date: editConsolidationDate.value,
    sailing_date: editSailingDate.value,
    contract_sign_date: editContractSignDate.value,
    image_ids: editImages.value.map((image) => image.id),
  })
}
function isEditDirty(): boolean {
  return editBaseline.value !== '' && editSnapshot() !== editBaseline.value
}

function closeDetail() {
  showEdit.value = false
  editing.value = null
  detailId.value = null
  void syncDetailQuery(null)
}

const { requestClose: requestCloseDetail } = useMaskCloseGuard({
  isDirty: () => isEditDirty(),
  close: () => closeDetail(),
})

/** `@close` 必须返回 false，否则 naive-ui 自己会把 show 置 false，拦不住「继续编辑」。 */
function handleCloseClick(): false {
  requestCloseDetail()
  return false
}

/** 按 id 打开详情弹窗（旧详情页链接、转为计划/再次申购跳转等都用它）。 */
async function openDetailById(lineId: number) {
  detailId.value = lineId
  try {
    const record = await procurementApi.record(lineId)
    openEditRecord(record)
  } catch (error) {
    message.error(error instanceof Error ? error.message : '申购记录加载失败')
    closeDetail()
  }
}

// URL → 弹窗的唯一入口：用 watch 而不是 onMounted，keepAlive / 同页导航都能生效
watch(
  () => routeQueryString(route.query.detail),
  (raw) => {
    // 本页是 keepAlive 页：跳去申购计划（「转为申购计划」成功后）时本页只是被停用，watcher 仍会
    // 跑。必须只认自己这条路由，否则会拿计划的 id 去查申购记录（两个 id 空间独立、极易命中别人），
    // 并把计划列表刚写进的 `?detail=` 改写成记录 id。
    if (route.name !== 'purchase-records') return
    const id = Number(raw)
    if (!Number.isInteger(id) || id <= 0) return
    if (showEdit.value && detailId.value === id) return
    void openDetailById(id)
  },
  { immediate: true },
)

function openRecordInNewPage() {
  const target = editing.value
  if (!target) return
  // 详情页已移除：新标签页打开列表页并由 ?detail= 自动弹开同一条记录的详情弹窗
  const href = router.resolve({
    name: 'purchase-records',
    query: { detail: String(target.line_id) },
  }).href
  window.open(href, '_blank')
}

function confirmRestorePlan() {
  const target = editing.value
  if (!target) return
  dialog.warning({
    title: '转为申购计划',
    content: '确定将该申购记录转为申购计划吗？转为计划后记录将消失，部分记录专属字段会丢失。',
    positiveText: '确定',
    negativeText: '取消',
    onPositiveClick: () => restoreToPlan(),
  })
}

async function restoreToPlan() {
  const target = editing.value
  if (!target) return
  restoring.value = true
  try {
    const plan = await procurementApi.restoreRecordToPlan(target.line_id, target.version)
    message.success('已转为申购计划')
    closeDetail()
    await load()
    // 计划详情同样已是弹窗：跳到计划列表并由 ?detail= 打开新计划
    void router.push({ name: 'purchase-materials', query: { detail: String(plan.id) } })
  } catch (error) {
    message.error(error instanceof Error ? error.message : '转为申购计划失败')
  } finally {
    restoring.value = false
  }
}

function openReapply() {
  const target = editing.value
  if (!target) return
  reapplyPlanDate.value = target.plan_date ? dateToTimestamp(target.plan_date) : Date.now()
  Object.assign(reapplyForm, {
    material_code: '',
    category: target.category || null,
    name: target.material_name,
    model_spec: target.model_spec,
    unit_name: target.unit_name,
    planned_qty: '',
    actual_demand_person: target.actual_demand_person,
    purchase_responsible: target.purchase_responsible,
    demand_department: target.demand_department,
    usage: target.usage,
    subitem_no: target.subitem_no || '',
    plan_remark: target.plan_remark || '',
  })
  showReapply.value = true
}

async function submitReapply() {
  const target = editing.value
  if (!target || !reapplyPlanDate.value) {
    message.error('请选择需求日期')
    return
  }
  if (
    !reapplyForm.name.trim() ||
    !reapplyForm.model_spec.trim() ||
    !reapplyForm.unit_name.trim() ||
    !reapplyForm.planned_qty ||
    !reapplyForm.usage.trim()
  ) {
    message.error('请完整填写名称、型号、单位、申购数量和用途')
    return
  }
  reapplySaving.value = true
  try {
    const created = await procurementApi.createMaterial({
      plan_date: toShanghaiDate(reapplyPlanDate.value),
      material_code: reapplyForm.material_code.trim() || undefined,
      category: reapplyForm.category || undefined,
      name: reapplyForm.name.trim(),
      model_spec: reapplyForm.model_spec.trim(),
      unit_name: reapplyForm.unit_name.trim(),
      planned_qty: reapplyForm.planned_qty,
      actual_demand_person: reapplyForm.actual_demand_person.trim(),
      purchase_responsible: reapplyForm.purchase_responsible.trim(),
      demand_department: reapplyForm.demand_department.trim(),
      usage: reapplyForm.usage.trim(),
      subitem_no: reapplyForm.subitem_no.trim() || undefined,
      remark: reapplyForm.plan_remark.trim() || undefined,
      image_ids: target.images.map((image) => image.id),
    })
    message.success('已创建新的申购计划')
    showReapply.value = false
    // 记录列表是 keepAlive 页：离开前先把详情弹窗关掉，回来时不会停在旧记录上
    closeDetail()
    // 计划详情同样已是弹窗：跳到计划列表并由 ?detail= 打开新计划
    void router.push({ name: 'purchase-materials', query: { detail: String(created.id) } })
  } catch (error) {
    message.error(error instanceof Error ? error.message : '再次申购失败')
  } finally {
    reapplySaving.value = false
  }
}

async function saveEditRecord() {
  if (
    !editing.value ||
    !editPlanDate.value ||
    !editPurchaseDate.value ||
    !editForm.material_name.trim() ||
    !editForm.model_spec.trim() ||
    !editForm.unit_name.trim() ||
    !editForm.actual_demand_person.trim() ||
    !editForm.purchase_responsible.trim() ||
    !editForm.purchase_qty ||
    !editForm.usage.trim() ||
    !editForm.status.trim()
  ) {
    message.error('请完整填写日期、物资、申购数量、用途、人员和状态')
    return
  }
  editSaving.value = true
  try {
    await procurementApi.updateRecord(editing.value.line_id, {
      ...editForm,
      plan_date: toShanghaiDate(editPlanDate.value),
      purchase_date: toShanghaiDate(editPurchaseDate.value),
      consolidation_date: editConsolidationDate.value
        ? toShanghaiDate(editConsolidationDate.value)
        : undefined,
      sailing_date: editSailingDate.value ? toShanghaiDate(editSailingDate.value) : undefined,
      contract_sign_date: editContractSignDate.value
        ? toShanghaiDate(editContractSignDate.value)
        : undefined,
      material_code: editForm.material_code?.trim() || undefined,
      category: editForm.category?.trim() || undefined,
      subitem_no: editForm.subitem_no?.trim() || undefined,
      plan_remark: editForm.plan_remark?.trim() || undefined,
      record_remark: editForm.record_remark?.trim() || undefined,
      purchase_order_no: editForm.purchase_order_no?.trim() || null,
      trace_no: editForm.trace_no?.trim() || null,
      contract_no: editForm.contract_no?.trim() || null,
      vessel_no: editForm.vessel_no?.trim() || null,
      consolidation_port: editForm.consolidation_port?.trim() || null,
      salesperson: editForm.salesperson?.trim() || undefined,
      image_ids: editImages.value.map((image) => image.id),
    })
    message.success('申购记录已保存')
    closeDetail()
    await load()
  } catch (error) {
    message.error(error instanceof Error ? error.message : '保存失败')
  } finally {
    editSaving.value = false
  }
}

function openBatchEdit() {
  if (!selectedRecords.value.length) {
    message.warning('请先选择至少一条申购记录')
    return
  }
  Object.assign(batchEditForm, {
    update_plan_date: false,
    plan_date: null,
    update_purchase_order_no: false,
    purchase_order_no: '',
    update_trace_no: false,
    trace_no: '',
    update_contract_no: false,
    contract_no: '',
    update_vessel_no: false,
    vessel_no: '',
    update_consolidation_date: false,
    consolidation_date: null,
    update_consolidation_port: false,
    consolidation_port: '',
    update_sailing_date: false,
    sailing_date: null,
    update_contract_sign_date: false,
    contract_sign_date: null,
    update_purchase_date: false,
    purchase_date: null,
    update_actual_demand_person: false,
    actual_demand_person: '',
    update_purchase_responsible: false,
    purchase_responsible: '',
    update_salesperson: false,
    salesperson: '',
    update_status: false,
    status: '',
    update_record_remark: false,
    record_remark: '',
  })
  showBatchEdit.value = true
}

async function batchUpdate() {
  const payload: PurchaseRecordBatchUpdate = {
    records: selectedRecords.value.map((item) => ({
      line_id: item.line_id,
      version: item.version,
    })),
  }
  if (batchEditForm.update_plan_date) {
    if (!batchEditForm.plan_date) {
      message.error('请选择需求日期')
      return
    }
    payload.plan_date = toShanghaiDate(batchEditForm.plan_date)
  }
  if (batchEditForm.update_purchase_order_no) {
    payload.purchase_order_no = batchEditForm.purchase_order_no.trim() || null
  }
  if (batchEditForm.update_trace_no) {
    payload.trace_no = batchEditForm.trace_no.trim() || null
  }
  if (batchEditForm.update_contract_no) {
    payload.contract_no = batchEditForm.contract_no.trim() || null
  }
  if (batchEditForm.update_vessel_no) {
    payload.vessel_no = batchEditForm.vessel_no.trim() || null
  }
  if (batchEditForm.update_consolidation_date) {
    payload.consolidation_date = batchEditForm.consolidation_date
      ? toShanghaiDate(batchEditForm.consolidation_date)
      : null
  }
  if (batchEditForm.update_consolidation_port) {
    payload.consolidation_port = batchEditForm.consolidation_port.trim() || null
  }
  if (batchEditForm.update_sailing_date) {
    payload.sailing_date = batchEditForm.sailing_date
      ? toShanghaiDate(batchEditForm.sailing_date)
      : null
  }
  if (batchEditForm.update_contract_sign_date) {
    payload.contract_sign_date = batchEditForm.contract_sign_date
      ? toShanghaiDate(batchEditForm.contract_sign_date)
      : null
  }
  if (batchEditForm.update_purchase_date) {
    payload.purchase_date = batchEditForm.purchase_date
      ? toShanghaiDate(batchEditForm.purchase_date)
      : null
  }
  if (batchEditForm.update_actual_demand_person) {
    const value = batchEditForm.actual_demand_person.trim()
    if (!value) {
      message.error('请选择或输入提报员工')
      return
    }
    payload.actual_demand_person = value
  }
  if (batchEditForm.update_purchase_responsible) {
    const value = batchEditForm.purchase_responsible.trim()
    if (!value) {
      message.error('请选择或输入实际需求人')
      return
    }
    payload.purchase_responsible = value
  }
  if (batchEditForm.update_salesperson) {
    payload.salesperson = batchEditForm.salesperson.trim() || null
  }
  if (batchEditForm.update_status) {
    const value = batchEditForm.status.trim()
    if (!value) {
      message.error('请输入申购状态')
      return
    }
    payload.status = value
  }
  if (batchEditForm.update_record_remark) {
    payload.record_remark = batchEditForm.record_remark.trim() || null
  }
  if (Object.keys(payload).length === 1) {
    message.warning('请至少勾选一个需要修改的字段')
    return
  }

  const updatedCount = selectedRecords.value.length
  batchUpdating.value = true
  try {
    await procurementApi.batchUpdateRecords(payload)
    message.success(`已批量修改 ${updatedCount} 条申购记录`)
    showBatchEdit.value = false
    checkedRowKeys.value = []
    await Promise.all([load(), loadFilterOptions()])
  } catch (error) {
    message.error(error instanceof Error ? error.message : '批量修改失败')
  } finally {
    batchUpdating.value = false
  }
}

onMounted(() => {
  void loadFilterOptions()
  void loadAiStatus()
  // 列表首载由 usePagedTable（immediate）触发
})
</script>

<template>
  <div class="page purchase-records-page">
    <ExportLoadingOverlay :show="resultExporting" />
    <div class="page-header">
      <div>
        <h1 class="page-title">申购记录</h1>
      </div>
      <div class="page-actions">
        <n-space align="center">
          <n-button v-if="canWrite" :disabled="!selectedRecords.length" @click="openBatchEdit">
            批量修改（{{ selectedRecords.length }}）
          </n-button>
          <n-tag :bordered="false" round type="info">共 {{ total }} 条记录</n-tag>
          <ExportButton
            :options="exportOptions"
            :loading="resultExporting"
            @select="handleExport"
          />
        </n-space>
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
          <span>物资名称</span>
          <n-input
            v-model:value="filters.name"
            placeholder="输入物资名称"
            clearable
            @keyup.enter="query"
          />
        </label>
        <label class="filter-field">
          <span>型号规格</span>
          <n-input
            v-model:value="filters.model_spec"
            placeholder="输入型号规格"
            clearable
            @keyup.enter="query"
          />
        </label>
        <label class="filter-field">
          <span>追溯号</span>
          <n-input
            v-model:value="filters.trace_no"
            placeholder="输入追溯号"
            clearable
            @keyup.enter="query"
          />
        </label>
        <label class="filter-field">
          <span>申购单号</span>
          <n-input
            v-model:value="filters.purchase_order_no"
            placeholder="输入申购单号"
            clearable
            @keyup.enter="query"
          />
        </label>
        <label class="filter-field">
          <span>提报员工</span>
          <n-select
            v-model:value="filters.actual_demand_person"
            :options="actualDemandPersonOptions"
            placeholder="选择或搜索提报员工"
            filterable
            clearable
          />
        </label>
        <label class="filter-field">
          <span>实际需求人</span>
          <n-select
            v-model:value="filters.purchase_responsible"
            :options="purchaseResponsibleOptions"
            placeholder="选择或搜索实际需求人"
            filterable
            clearable
          />
        </label>
        <label class="filter-field">
          <span>业务员</span>
          <n-select
            v-model:value="filters.salesperson"
            :options="salespersonOptions"
            placeholder="选择或搜索业务员"
            filterable
            clearable
          />
        </label>
        <label class="filter-field">
          <span>申购状态</span>
          <n-select
            v-model:value="filters.status"
            :options="statusOptions"
            clearable
            filterable
            placeholder="选择或搜索状态"
          />
        </label>
        <label class="filter-field">
          <span>子项号</span>
          <n-select
            v-model:value="filters.subitem_no"
            :options="subitemOptions"
            clearable
            filterable
            placeholder="选择或搜索子项号"
          />
        </label>
        <label class="filter-field">
          <span>用途</span>
          <n-input
            v-model:value="filters.usage"
            placeholder="输入用途关键字"
            clearable
            @keyup.enter="query"
          />
        </label>
      </div>
      <div class="filter-extras-actions">
        <div class="filter-actions">
          <ColumnVisibilityPicker
            :value="visibleColumnKeys"
            :options="fieldOptions"
            storage-key="procurement.purchase-records.visible-columns.v4"
            @update:value="setVisibleColumnKeys"
          />
          <div class="filter-action-buttons">
            <n-button @click="resetFilters">重置</n-button>
            <n-button
              secondary
              type="primary"
              :loading="aiSearching"
              :disabled="!aiAvailable || !filters.name.trim()"
              :title="
                aiAvailable
                  ? filters.name.trim()
                    ? '自动扩展物资名称同义词并立即查询'
                    : '请先输入物资名称'
                  : '请联系超级管理员配置大模型服务'
              "
              @click="aiQuery"
            >
              智能查询
            </n-button>
            <n-button type="primary" @click="query">查询</n-button>
          </div>
        </div>
      </div>
    </n-card>
    <div ref="tableAreaRef">
      <n-card class="records-card data-card" :bordered="false">
        <n-data-table
          v-model:checked-row-keys="checkedRowKeys"
          :bordered="false"
          :columns="columns"
          :data="items"
          :loading="loading"
          :remote="true"
          :row-props="rowProps"
          :row-key="(row: PurchaseRecord) => row.line_id"
          :scroll-x="tableScrollX"
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
    </div>
    <n-modal
      v-model:show="showBatchEdit"
      preset="card"
      draggable
      title="批量修改申购记录"
      style="width: 760px; max-width: calc(100vw - 32px)"
      :mask-closable="false"
    >
      <n-alert type="info" style="margin-bottom: 16px">
        已选择 {{ selectedRecords.length }}
        条记录。仅勾选的字段会被统一修改；单据共享字段会同步影响同一申购单下的其他物资。
      </n-alert>
      <n-scrollbar style="max-height: 65vh" content-style="padding-right: 12px">
        <n-form label-placement="top">
          <div class="form-grid batch-edit-grid">
            <n-form-item>
              <template #label>
                <n-checkbox v-model:checked="batchEditForm.update_plan_date">
                  修改需求日期
                </n-checkbox>
              </template>
              <n-date-picker
                v-model:value="batchEditForm.plan_date"
                type="date"
                class="full-width"
                :disabled="!batchEditForm.update_plan_date"
              />
            </n-form-item>
            <n-form-item>
              <template #label>
                <n-checkbox v-model:checked="batchEditForm.update_purchase_order_no">
                  修改申购单号
                </n-checkbox>
              </template>
              <n-input
                v-model:value="batchEditForm.purchase_order_no"
                maxlength="128"
                placeholder="留空将清除申购单号"
                :disabled="!batchEditForm.update_purchase_order_no"
              />
            </n-form-item>
            <n-form-item>
              <template #label>
                <n-checkbox v-model:checked="batchEditForm.update_trace_no">修改追溯号</n-checkbox>
              </template>
              <n-input
                v-model:value="batchEditForm.trace_no"
                maxlength="128"
                placeholder="留空将清除追溯号"
                :disabled="!batchEditForm.update_trace_no"
              />
            </n-form-item>
            <n-form-item>
              <template #label>
                <n-checkbox v-model:checked="batchEditForm.update_contract_no"
                  >修改合同号</n-checkbox
                >
              </template>
              <n-input
                v-model:value="batchEditForm.contract_no"
                maxlength="128"
                placeholder="留空将清除合同号"
                :disabled="!batchEditForm.update_contract_no"
              />
            </n-form-item>
            <n-form-item>
              <template #label>
                <n-checkbox v-model:checked="batchEditForm.update_vessel_no">修改船号</n-checkbox>
              </template>
              <n-input
                v-model:value="batchEditForm.vessel_no"
                maxlength="128"
                placeholder="留空将清除船号"
                :disabled="!batchEditForm.update_vessel_no"
              />
            </n-form-item>
            <n-form-item>
              <template #label>
                <n-checkbox v-model:checked="batchEditForm.update_consolidation_date">
                  修改集港日期
                </n-checkbox>
              </template>
              <n-date-picker
                v-model:value="batchEditForm.consolidation_date"
                type="date"
                class="full-width"
                clearable
                :disabled="!batchEditForm.update_consolidation_date"
              />
            </n-form-item>
            <n-form-item>
              <template #label>
                <n-checkbox v-model:checked="batchEditForm.update_consolidation_port">
                  修改集港港口
                </n-checkbox>
              </template>
              <n-input
                v-model:value="batchEditForm.consolidation_port"
                maxlength="128"
                placeholder="留空将清除集港港口"
                :disabled="!batchEditForm.update_consolidation_port"
              />
            </n-form-item>
            <n-form-item>
              <template #label>
                <n-checkbox v-model:checked="batchEditForm.update_sailing_date">
                  修改发船日期
                </n-checkbox>
              </template>
              <n-date-picker
                v-model:value="batchEditForm.sailing_date"
                type="date"
                class="full-width"
                clearable
                :disabled="!batchEditForm.update_sailing_date"
              />
            </n-form-item>
            <n-form-item>
              <template #label>
                <n-checkbox v-model:checked="batchEditForm.update_contract_sign_date">
                  修改合同签订日期
                </n-checkbox>
              </template>
              <n-date-picker
                v-model:value="batchEditForm.contract_sign_date"
                type="date"
                class="full-width"
                clearable
                :disabled="!batchEditForm.update_contract_sign_date"
              />
            </n-form-item>
            <n-form-item>
              <template #label>
                <n-checkbox v-model:checked="batchEditForm.update_purchase_date">
                  修改申购日期
                </n-checkbox>
              </template>
              <n-date-picker
                v-model:value="batchEditForm.purchase_date"
                type="date"
                class="full-width"
                clearable
                :disabled="!batchEditForm.update_purchase_date"
              />
            </n-form-item>
            <n-form-item>
              <template #label>
                <n-checkbox v-model:checked="batchEditForm.update_actual_demand_person">
                  修改提报员工
                </n-checkbox>
              </template>
              <n-select
                v-model:value="batchEditForm.actual_demand_person"
                :options="actualDemandPersonOptions"
                filterable
                tag
                placeholder="选择或输入提报员工"
                :disabled="!batchEditForm.update_actual_demand_person"
              />
            </n-form-item>
            <n-form-item>
              <template #label>
                <n-checkbox v-model:checked="batchEditForm.update_purchase_responsible">
                  修改实际需求人
                </n-checkbox>
              </template>
              <n-select
                v-model:value="batchEditForm.purchase_responsible"
                :options="purchaseResponsibleOptions"
                filterable
                tag
                placeholder="选择或输入实际需求人"
                :disabled="!batchEditForm.update_purchase_responsible"
              />
            </n-form-item>
            <n-form-item>
              <template #label>
                <n-checkbox v-model:checked="batchEditForm.update_salesperson"
                  >修改业务员</n-checkbox
                >
              </template>
              <n-select
                v-model:value="batchEditForm.salesperson"
                :options="salespersonOptions"
                filterable
                tag
                clearable
                placeholder="留空将清除业务员"
                :disabled="!batchEditForm.update_salesperson"
              />
            </n-form-item>
            <n-form-item>
              <template #label>
                <n-checkbox v-model:checked="batchEditForm.update_status">修改申购状态</n-checkbox>
              </template>
              <n-input
                v-model:value="batchEditForm.status"
                maxlength="128"
                placeholder="输入申购状态"
                :disabled="!batchEditForm.update_status"
              />
            </n-form-item>
          </div>
          <n-form-item>
            <template #label>
              <n-checkbox v-model:checked="batchEditForm.update_record_remark">
                修改申购记录备注
              </n-checkbox>
            </template>
            <n-input
              v-model:value="batchEditForm.record_remark"
              type="textarea"
              maxlength="1000"
              show-count
              placeholder="留空将清除申购记录备注"
              :disabled="!batchEditForm.update_record_remark"
            />
          </n-form-item>
        </n-form>
      </n-scrollbar>
      <template #footer>
        <n-space justify="end">
          <n-button @click="showBatchEdit = false">取消</n-button>
          <n-button type="primary" :loading="batchUpdating" @click="batchUpdate">
            保存修改
          </n-button>
        </n-space>
      </template>
    </n-modal>
    <n-modal
      v-model:show="showEdit"
      preset="card"
      draggable
      data-detail-modal
      title="申购记录详情"
      style="width: 760px; max-width: calc(100vw - 32px)"
      :mask-closable="false"
      :close-on-esc="false"
      @mask-click="requestCloseDetail"
      @esc="requestCloseDetail"
      @close="handleCloseClick"
    >
      <n-scrollbar style="max-height: 70vh" content-style="padding-right: 12px">
        <n-form label-placement="top" :disabled="!canWrite">
          <div class="form-grid">
            <n-form-item label="需求日期" required>
              <n-date-picker v-model:value="editPlanDate" type="date" class="full-width" />
            </n-form-item>
            <n-form-item label="申购日期" required>
              <n-date-picker v-model:value="editPurchaseDate" type="date" class="full-width" />
            </n-form-item>
            <n-form-item label="申购单号">
              <n-input
                v-model:value="editForm.purchase_order_no"
                maxlength="128"
                placeholder="可留空"
              />
            </n-form-item>
            <n-form-item label="追溯号">
              <n-input v-model:value="editForm.trace_no" maxlength="128" placeholder="可留空" />
            </n-form-item>
            <n-form-item label="类别">
              <n-select
                v-model:value="editForm.category"
                :options="purchaseCategoryOptions"
                filterable
                clearable
                placeholder="选择类别"
              />
            </n-form-item>
            <n-form-item label="状态" required>
              <n-input
                v-model:value="editForm.status"
                maxlength="128"
                placeholder="可填写任意状态"
              />
            </n-form-item>
            <n-form-item label="名称" required>
              <n-input v-model:value="editForm.material_name" maxlength="128" />
            </n-form-item>
            <n-form-item label="型号规格" required>
              <n-input v-model:value="editForm.model_spec" maxlength="255" />
            </n-form-item>
            <n-form-item label="申购数量 / 计量单位" required>
              <n-input-group>
                <QuantityInput
                  v-model:value="editForm.purchase_qty"
                  :decimal-places="1"
                  :disabled="!canWrite"
                  class="quantity-input"
                />
                <n-input
                  v-model:value="editForm.unit_name"
                  maxlength="32"
                  placeholder="计量单位"
                  class="quantity-unit-select"
                />
              </n-input-group>
            </n-form-item>
            <n-form-item label="提报员工" required>
              <n-input v-model:value="editForm.actual_demand_person" maxlength="128" />
            </n-form-item>
            <n-form-item label="实际需求人" required>
              <n-input v-model:value="editForm.purchase_responsible" maxlength="128" />
            </n-form-item>
            <n-form-item label="业务员">
              <n-input v-model:value="editForm.salesperson" maxlength="128" />
            </n-form-item>
            <n-form-item label="子项号">
              <n-input v-model:value="editForm.subitem_no" maxlength="64" placeholder="选填" />
            </n-form-item>
            <n-form-item label="用途" required>
              <n-input v-model:value="editForm.usage" maxlength="500" />
            </n-form-item>
          </div>
          <n-collapse v-model:expanded-names="editAdvancedSections" class="edit-advanced-fields">
            <n-collapse-item name="advanced">
              <template #header>
                <span class="advanced-header">更多设置</span>
              </template>
              <div class="form-grid">
                <n-form-item label="合同号">
                  <n-input
                    v-model:value="editForm.contract_no"
                    maxlength="128"
                    placeholder="可留空"
                  />
                </n-form-item>
                <n-form-item label="船号">
                  <n-input
                    v-model:value="editForm.vessel_no"
                    maxlength="128"
                    placeholder="可留空"
                  />
                </n-form-item>
                <n-form-item label="集港日期">
                  <n-date-picker
                    v-model:value="editConsolidationDate"
                    type="date"
                    class="full-width"
                    clearable
                  />
                </n-form-item>
                <n-form-item label="集港港口">
                  <n-input
                    v-model:value="editForm.consolidation_port"
                    maxlength="128"
                    placeholder="可留空"
                  />
                </n-form-item>
                <n-form-item label="发船日期">
                  <n-date-picker
                    v-model:value="editSailingDate"
                    type="date"
                    class="full-width"
                    clearable
                  />
                </n-form-item>
                <n-form-item label="合同签订日期">
                  <n-date-picker
                    v-model:value="editContractSignDate"
                    type="date"
                    class="full-width"
                    clearable
                  />
                </n-form-item>
                <n-form-item label="物料编码">
                  <n-input
                    v-model:value="editForm.material_code"
                    maxlength="64"
                    placeholder="可留空"
                  />
                </n-form-item>
                <n-form-item label="需求部门" required>
                  <n-input v-model:value="editForm.demand_department" maxlength="128" />
                </n-form-item>
                <n-form-item label="关联二级库物资">
                  <MaterialSelector
                    :value="editForm.stock_material_id ?? null"
                    :disabled="!canWrite"
                    @update:value="editForm.stock_material_id = $event ?? undefined"
                  />
                </n-form-item>
              </div>
            </n-collapse-item>
          </n-collapse>
          <div class="form-grid">
            <n-form-item label="申购计划备注">
              <n-input
                v-model:value="editForm.plan_remark"
                type="textarea"
                maxlength="1000"
                show-count
              />
            </n-form-item>
            <n-form-item label="申购记录备注">
              <n-input
                v-model:value="editForm.record_remark"
                type="textarea"
                maxlength="1000"
                show-count
              />
            </n-form-item>
          </div>
          <n-form-item label="图片附件">
            <ImageUploader
              v-model:files="editImages"
              v-model:busy="editImagesUploading"
              :disabled="!canWrite"
            />
          </n-form-item>
        </n-form>
      </n-scrollbar>
      <template #footer>
        <n-space justify="space-between">
          <n-space v-if="editing" justify="start" align="center">
            <span v-if="editing.updated_at" class="muted"
              >最后更新：{{ formatShanghaiTime(editing.updated_at) }}</span
            >
            <n-button
              v-if="canWrite"
              type="primary"
              secondary
              :loading="restoring"
              @click="confirmRestorePlan"
              >转为申购计划</n-button
            >
            <n-button v-if="canWrite" type="primary" secondary @click="openReapply"
              >再次申购</n-button
            >
            <n-button
              type="primary"
              secondary
              class="open-new-page-btn"
              @click="openRecordInNewPage"
            >
              在新页面打开
            </n-button>
          </n-space>
          <span v-else></span>
          <n-space justify="end">
            <n-button @click="requestCloseDetail">取消</n-button>
            <n-button
              v-if="canWrite"
              type="primary"
              :loading="editSaving"
              :disabled="editImagesUploading"
              @click="saveEditRecord"
            >
              保存
            </n-button>
          </n-space>
        </n-space>
      </template>
    </n-modal>
    <n-modal
      v-model:show="showReapply"
      preset="card"
      draggable
      title="再次申购"
      style="width: 760px; max-width: calc(100vw - 32px)"
      :mask-closable="false"
    >
      <n-scrollbar style="max-height: 70vh" content-style="padding-right: 12px">
        <n-form label-placement="top">
          <div class="form-grid">
            <n-form-item label="需求日期" required>
              <n-date-picker v-model:value="reapplyPlanDate" type="date" class="full-width" />
            </n-form-item>
            <n-form-item label="名称" required>
              <n-input v-model:value="reapplyForm.name" maxlength="256" />
            </n-form-item>
            <n-form-item label="型号规格" required>
              <n-input v-model:value="reapplyForm.model_spec" maxlength="128" />
            </n-form-item>
            <n-form-item label="申购数量 / 计量单位" required>
              <n-input-group>
                <QuantityInput
                  v-model:value="reapplyForm.planned_qty"
                  :decimal-places="1"
                  class="quantity-input"
                />
                <n-input
                  v-model:value="reapplyForm.unit_name"
                  maxlength="32"
                  placeholder="计量单位"
                  class="quantity-unit-select"
                />
              </n-input-group>
            </n-form-item>
            <n-form-item label="物料编码">
              <n-input
                v-model:value="reapplyForm.material_code"
                maxlength="64"
                placeholder="留空"
              />
            </n-form-item>
            <n-form-item label="类别">
              <n-select
                v-model:value="reapplyForm.category"
                :options="purchaseCategoryOptions"
                filterable
                clearable
                placeholder="选择类别"
              />
            </n-form-item>
            <n-form-item label="用途" required>
              <n-input v-model:value="reapplyForm.usage" maxlength="500" />
            </n-form-item>
            <n-form-item label="需求部门">
              <n-input v-model:value="reapplyForm.demand_department" maxlength="128" />
            </n-form-item>
            <n-form-item label="提报员工">
              <n-input v-model:value="reapplyForm.actual_demand_person" maxlength="128" />
            </n-form-item>
            <n-form-item label="实际需求人">
              <n-input v-model:value="reapplyForm.purchase_responsible" maxlength="128" />
            </n-form-item>
            <n-form-item label="子项号">
              <n-input v-model:value="reapplyForm.subitem_no" maxlength="64" placeholder="选填" />
            </n-form-item>
            <n-form-item label="备注">
              <n-input
                v-model:value="reapplyForm.plan_remark"
                type="textarea"
                maxlength="1000"
                show-count
              />
            </n-form-item>
          </div>
        </n-form>
      </n-scrollbar>
      <template #footer>
        <n-space justify="end">
          <n-button @click="showReapply = false">取消</n-button>
          <n-button type="primary" :loading="reapplySaving" @click="submitReapply">
            创建申购计划
          </n-button>
        </n-space>
      </template>
    </n-modal>
    <ShareLinkDialog
      v-model:show="showShare"
      share-type="purchase_record"
      :item-ids="selectedRecords.map((item) => item.line_id)"
      title="申购记录"
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

.quantity-input {
  flex: 1;
}

.quantity-unit-select {
  width: 160px;
}

.edit-advanced-fields {
  margin-bottom: 18px;
  overflow: hidden;
  border-radius: 8px;
  background: var(--color-panel);
}

.edit-advanced-fields :deep(.n-collapse-item) {
  border-radius: 8px;
}

.edit-advanced-fields :deep(.n-collapse-item__header) {
  padding: 10px 12px;
  transition: background-color 0.2s ease;
}

.edit-advanced-fields :deep(.n-collapse-item__header:hover) {
  background: var(--color-panel-hover);
}

.edit-advanced-fields :deep(.n-collapse-item__content-inner) {
  padding: 12px;
}

.advanced-header {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-weight: 500;
  color: var(--color-text);
}

.open-new-page-btn {
  align-self: center;
}
</style>
