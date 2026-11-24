<script setup lang="ts">
import PersistentDataTable from '@/components/PersistentDataTable.vue'
import { computed, h, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useMessage, type DataTableBaseColumn, type DataTableColumns } from 'naive-ui'
import { useRoute, useRouter } from 'vue-router'
import type {
  PurchaseFilterOptions,
  PurchaseMaterial,
  PurchaseMaterialBatchUpdate,
  PurchasePlanResultExportRequest,
  PurchasePlanStatus,
} from '@/api/generated'
import { procurementApi } from '@/api/procurement'
import { AppError } from '@/api/client'
import { aiSearchApi } from '@/api/aiSearch'
import { useAuthStore } from '@/stores/auth'
import PurchasePlanDetailModal from '@/components/PurchasePlanDetailModal.vue'
import ColumnVisibilityPicker from '@/components/ColumnVisibilityPicker.vue'
import ExportLoadingOverlay from '@/components/ExportLoadingOverlay.vue'
import ImageThumbnails from '@/components/ImageThumbnails.vue'
import ExportButton from '@/components/ExportButton.vue'
import FilterExpandButton from '@/components/FilterExpandButton.vue'
import ShareLinkDialog from '@/components/ShareLinkDialog.vue'
import SortableHeader, { type SortOptionKey } from '@/components/SortableHeader.vue'
import type { ExportOption } from '@/types/export'
import {
  getTableScrollX,
  preventTableColumnCompression,
  tableColumnWidths,
} from '@/constants/table'
import { defaultPurchaseOrderNo, mergeExportColumns } from '@/utils/purchase'
import { createTableRowClickGuard } from '@/utils/tableRowNavigation'
import {
  defaultDemandDepartment,
  defaultPurchasePlanStatus,
  defaultPurchaseUrgency,
  purchaseCategoryOptions,
  purchaseUrgencyOptions,
  purchasePlanStatusOptions,
} from '@/constants/purchase'
import { formatDate, toShanghaiDate } from '@/utils/time'
import { downloadBlob, downloadFromUrl, exportDownloadUrl } from '@/utils/download'
import { routeQueryString } from '@/utils/routeQuery'
import { useExportJob } from '@/composables/useExportJob'
import { useImplicitAiSearch } from '@/composables/useImplicitAiSearch'
import { usePagedTable } from '@/composables/usePagedTable'
import { useShiftWheelHorizontalScroll } from '@/composables/useShiftWheelHorizontalScroll'
import { renderMaterialCode, renderQuantityWithUnit, renderTwoLineText } from '@/utils/tableText'

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()
const message = useMessage()
const rowClickGuard = createTableRowClickGuard()
const filterExpanded = ref(false)
const EMPTY_DEMAND_PERSON_FILTER = '__empty_actual_demand_person__'
const EMPTY_SUBITEM_FILTER = '__empty_subitem_no__'
// 归档计划的可见性跟系统管理权限走（原「仅超级管理员」，统一 RBAC 后同键）。
const canViewArchivedPlans = computed(() => auth.can('system:admin'))
/** 详情弹窗的写权限：无写权限时字段禁用、页脚只留「取消」（与原详情页一致）。 */
const canWrite = computed(() => auth.can('purchase:write'))
const statusFilterOptions = computed(() =>
  purchasePlanStatusOptions.filter(
    (option) => canViewArchivedPlans.value || option.value !== '已归档',
  ),
)
type PurchaseFilters = {
  name: string
  model_spec: string
  actual_demand_person: string | null
  subitem_no: string | null
  category: string | null
  status: PurchasePlanStatus[]
  sort_by: PlanColumnKey | null
  sort_order: 'asc' | 'desc' | null
}
// fromQuery 在 usePagedTable setup 期同步执行，早于 availableColumns 定义，
// 需在 hook 调用前声明运行时值用于校验 URL 恢复的 sort_by 合法性。
const PLAN_SORTABLE_KEYS: readonly PlanColumnKey[] = [
  'plan_date',
  'material_code',
  'category',
  'urgency',
  'demand_department',
  'name',
  'model_spec',
  'unit_name',
  'planned_qty',
  'actual_demand_person',
  'purchase_responsible',
  'subitem_no',
  'usage',
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
} = usePagedTable<PurchaseMaterial, PurchaseFilters>({
  fetch: (f, pager) =>
    procurementApi.materials({
      page: pager.page,
      page_size: pager.page_size,
      moved: false,
      name: searchName.value,
      model_spec: f.model_spec.trim() || undefined,
      actual_demand_person:
        f.actual_demand_person && f.actual_demand_person !== EMPTY_DEMAND_PERSON_FILTER
          ? f.actual_demand_person.trim()
          : undefined,
      empty_actual_demand_person:
        f.actual_demand_person === EMPTY_DEMAND_PERSON_FILTER || undefined,
      subitem_no: f.subitem_no && f.subitem_no !== EMPTY_SUBITEM_FILTER ? f.subitem_no : undefined,
      empty_subitem_no: f.subitem_no === EMPTY_SUBITEM_FILTER || undefined,
      category: f.category || undefined,
      status: f.status.length ? f.status : undefined,
      sort_by: f.sort_by || undefined,
      sort_order: f.sort_order || undefined,
    }),
  initialFilters: () => ({
    name: '',
    model_spec: '',
    actual_demand_person: null,
    subitem_no: null,
    category: null,
    status: [defaultPurchasePlanStatus],
    sort_by: null,
    sort_order: null,
  }),
  onLoaded: () => {
    checkedRowKeys.value = []
  },
  beforeQuery: () => clearExpandedName(),
  urlSync: {
    routeName: 'purchase-materials',
    fromQuery: (route) => {
      const routeStatuses = routeQueryString(route.query.status)
        .split(',')
        .filter((value): value is PurchasePlanStatus =>
          purchasePlanStatusOptions.some((option) => option.value === value),
        )
      const sortBy = routeQueryString(route.query.sort_by)
      const sortOrder = routeQueryString(route.query.sort_order)
      return {
        name: routeQueryString(route.query.name),
        model_spec: routeQueryString(route.query.model_spec),
        actual_demand_person: routeQueryString(route.query.actual_demand_person) || null,
        subitem_no: routeQueryString(route.query.subitem_no) || null,
        category: routeQueryString(route.query.category) || null,
        status:
          routeStatuses.filter((status) => canViewArchivedPlans.value || status !== '已归档')
            .length > 0
            ? routeStatuses.filter((status) => canViewArchivedPlans.value || status !== '已归档')
            : [defaultPurchasePlanStatus],
        sort_by: PLAN_SORTABLE_KEYS.includes(sortBy as PlanColumnKey)
          ? (sortBy as PlanColumnKey)
          : null,
        sort_order: sortOrder === 'asc' || sortOrder === 'desc' ? sortOrder : null,
      }
    },
    toQuery: (f) => ({
      name: f.name,
      model_spec: f.model_spec,
      actual_demand_person: f.actual_demand_person || undefined,
      subitem_no: f.subitem_no || undefined,
      category: f.category || undefined,
      status:
        f.status.length === 1 && f.status[0] === defaultPurchasePlanStatus
          ? undefined
          : f.status.join(','),
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
// 异步导出（含图片渲染耗时较长）：提交 202 秒回 → 轮询 → 下载
const { running: resultExporting, run: runResultExport } =
  useExportJob<PurchasePlanResultExportRequest>({
    start: procurementApi.exportMaterialResults,
    poll: procurementApi.excelExportJob,
  })
// 申购审批表同样嵌图、文件可能很大：一律走异步任务，避免请求超时被网关掐断
const { running: approvalExporting, run: runApprovalExport } = useExportJob<number[]>({
  start: procurementApi.exportPurchaseApproval,
  poll: procurementApi.excelExportJob,
})
const showDetail = ref(false)
/** 详情弹窗要展示的计划；`null` 表示新建。 */
const detailPlan = ref<PurchaseMaterial | null>(null)
// 详情弹窗（原 /procurement/materials/:id 详情页）写成 URL 的 ?detail=<id>
const detailId = ref<number | null>(null)
const showBatch = ref(false)
const showBatchEdit = ref(false)
const batchMoving = ref(false)
const batchUpdating = ref(false)
const batchExporting = ref(false)
const checkedRowKeys = ref<Array<string | number>>([])
const tableAreaRef = ref<HTMLElement | null>(null)
const isTableFullscreen = ref(false)
const filterOptions = ref<PurchaseFilterOptions>({
  actual_demand_persons: [],
  purchase_responsibles: [],
  subitem_nos: [],
  categories: [],
})
const actualDemandPersonOptions = computed(() => [
  { label: '空提报员工', value: EMPTY_DEMAND_PERSON_FILTER },
  ...filterOptions.value.actual_demand_persons.map((value) => ({ label: value, value })),
])
const subitemOptions = computed(() => [
  { label: '空子项号', value: EMPTY_SUBITEM_FILTER },
  ...filterOptions.value.subitem_nos.map((value) => ({ label: value, value })),
])
const categoryOptions = computed(() => {
  const values = new Set([
    ...purchaseCategoryOptions.map((option) => option.value),
    ...filterOptions.value.categories,
  ])
  return [...values].map((value) => ({ label: value, value }))
})
const activeFilterCount = computed(
  () =>
    [
      filters.name.trim(),
      filters.model_spec.trim(),
      filters.actual_demand_person,
      filters.subitem_no,
      filters.category,
      filters.status.length === 1 && filters.status[0] === defaultPurchasePlanStatus
        ? ''
        : filters.status.join(','),
    ].filter(Boolean).length,
)
const batchForm = reactive({
  purchase_order_no: defaultPurchaseOrderNo(),
  trace_no: '',
  contract_no: '',
  vessel_no: '',
  consolidation_date: null as number | null,
  consolidation_port: '',
  sailing_date: null as number | null,
  contract_sign_date: null as number | null,
  purchase_date: Date.now(),
  salesperson: '',
  status: '已申购',
  record_remark: '',
})
const batchEditForm = reactive({
  update_plan_date: false,
  plan_date: null as number | null,
  update_category: false,
  category: '',
  update_urgency: false,
  urgency: defaultPurchaseUrgency,
  update_demand_department: false,
  demand_department: defaultDemandDepartment,
  update_actual_demand_person: false,
  actual_demand_person: '',
  update_purchase_responsible: false,
  purchase_responsible: '',
  update_subitem_no: false,
  subitem_no: '',
  update_usage: false,
  usage: '',
  update_status: false,
  status: defaultPurchasePlanStatus as PurchasePlanStatus,
})

const selectedPlans = computed(() => {
  const selected = new Set(checkedRowKeys.value.map(Number))
  return items.value.filter((item) => selected.has(item.id))
})
const exportOptions = computed<ExportOption[]>(() => {
  const options: ExportOption[] = [
    { label: `导出查询结果（共 ${total.value} 条）`, key: 'results' },
  ]
  options.push({
    label: `链接分享（已选 ${selectedPlans.value.length} 条）`,
    key: 'share',
    disabled: !selectedPlans.value.length,
  })
  if (auth.can('purchase:write')) {
    options.push({
      label: `导出采购申请表（已选 ${selectedPlans.value.length} 条）`,
      key: 'purchase-application',
      disabled: !selectedPlans.value.length,
    })
    options.push({
      label: `导出申购审批表（已选 ${selectedPlans.value.length} 条）`,
      key: 'purchase-approval',
      disabled: !selectedPlans.value.length,
    })
  }
  return options
})
const showShare = ref(false)
const exportLoading = computed(
  () => resultExporting.value || approvalExporting.value || batchExporting.value,
)
type PlanColumnKey =
  | 'plan_date'
  | 'material_code'
  | 'category'
  | 'urgency'
  | 'demand_department'
  | 'name'
  | 'model_spec'
  | 'unit_name'
  | 'planned_qty'
  | 'actual_demand_person'
  | 'purchase_responsible'
  | 'subitem_no'
  | 'usage'
  | 'images'

const availableColumns: Array<{
  key: PlanColumnKey
  label: string
  /** 只用于导出、不在列表与列显隐里出现的列（如并入「数量」的计量单位）。 */
  hidden?: boolean
  column: DataTableBaseColumn<PurchaseMaterial>
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
    key: 'material_code',
    label: '物料编码',
    column: {
      title: '物料编码',
      key: 'material_code',
      width: tableColumnWidths.codeNarrow,
      render: (row) => renderMaterialCode(row.material_code),
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
    key: 'urgency',
    label: '紧急程度',
    column: {
      title: '紧急程度',
      key: 'urgency',
      width: tableColumnWidths.person,
      render: (row) => renderTwoLineText(row.urgency),
    },
  },
  {
    key: 'demand_department',
    label: '需求部门',
    column: {
      title: '需求部门',
      key: 'demand_department',
      width: tableColumnWidths.department,
      render: (row) => renderTwoLineText(row.demand_department),
    },
  },
  {
    key: 'name',
    label: '名称',
    column: {
      title: '名称',
      key: 'name',
      width: tableColumnWidths.name,
      render: (row) => renderTwoLineText(row.name),
    },
  },
  {
    key: 'model_spec',
    label: '型号规格',
    column: {
      title: '型号规格',
      key: 'model_spec',
      width: tableColumnWidths.model,
      render: (row) => renderTwoLineText(row.model_spec),
    },
  },
  {
    key: 'planned_qty',
    label: '数量',
    // 列表把「计划数量 + 计量单位」合成一列展示（如「12 个」）：单看数量没有参照。
    // 列键仍是 planned_qty（后端排序白名单、分享链接已存列键都以它为准）；
    // 导出仍按「计划数量」「计量单位」两列走，见 mergeExportColumns。
    column: {
      title: '数量',
      key: 'planned_qty',
      width: tableColumnWidths.quantityWithUnit,
      render: (row) => renderQuantityWithUnit(row.planned_qty, row.unit_name),
    },
  },
  {
    key: 'unit_name',
    label: '计量单位',
    // 列表不单独显示（并入上面的「数量」），但保留定义：导出仍按两列走。
    hidden: true,
    column: {
      title: '计量单位',
      key: 'unit_name',
      width: tableColumnWidths.unit,
      render: (row) => renderTwoLineText(row.unit_name),
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
/** 列表里真正可显示 / 可勾选的列（hidden 的只服务导出，不出现）。 */
const displayColumns = availableColumns.filter((item) => !item.hidden)
const visibleColumnKeys = ref<PlanColumnKey[]>(displayColumns.map((item) => item.key))
const fieldOptions = displayColumns.map((item) => ({ label: item.label, value: item.key }))
const columns = computed<DataTableColumns<PurchaseMaterial>>(() => {
  const sortBy = filters.sort_by
  const sortOrder = filters.sort_order
  return preventTableColumnCompression([
    {
      type: 'selection',
      disabled: () => !auth.can('purchase:write'),
    },
    ...displayColumns
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
function handleSortSelect(key: PlanColumnKey, order: SortOptionKey) {
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
  visibleColumnKeys.value = value as PlanColumnKey[]
}
function rowProps(row: PurchaseMaterial) {
  return {
    style: 'cursor: pointer',
    onMousedown: rowClickGuard.onMouseDown,
    onClick: (event: MouseEvent) => {
      if (rowClickGuard.shouldIgnore(event)) return
      // Ctrl/Meta+点击在新标签页打开详情（列表页 + ?detail=）
      if (event.ctrlKey || event.metaKey) {
        const href = router.resolve({
          name: 'purchase-materials',
          query: { detail: String(row.id) },
        }).href
        window.open(href, '_blank')
        return
      }
      // 点击行直接打开详情弹窗（与「新建」共用同一弹窗）
      openDetail(row)
    },
  }
}
function syncTableFullscreen() {
  isTableFullscreen.value = document.fullscreenElement === tableAreaRef.value
}
async function toggleTableFullscreen() {
  const tableArea = tableAreaRef.value
  if (!tableArea?.requestFullscreen) {
    message.warning('当前浏览器不支持全屏显示')
    return
  }
  try {
    if (document.fullscreenElement === tableArea) await document.exitFullscreen()
    else await tableArea.requestFullscreen()
  } catch {
    message.error('切换全屏失败')
  }
}
/** 筛选下拉选项只是辅助数据：失败时保留上一次的选项，不能让「保存成功」后再弹一条「保存失败」 */
async function loadFilterOptions() {
  try {
    filterOptions.value = await procurementApi.materialFilterOptions({ moved: false })
  } catch {
    // 静默：选项沿用上一次结果
  }
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
  // 导出仍按「计划数量」「计量单位」两列走：列表里合成了一列「数量」，
  // 但导出沿用后端模板的列键与顺序，不能因为显示合并而少给下游一列。
  const exportColumns = mergeExportColumns(
    visibleColumnKeys.value,
    availableColumns.map((item) => item.key),
  )
  if (!exportColumns.length) {
    message.warning('请至少显示一个字段')
    return
  }
  try {
    const actualDemandPerson =
      filters.actual_demand_person && filters.actual_demand_person !== EMPTY_DEMAND_PERSON_FILTER
        ? filters.actual_demand_person.trim()
        : undefined
    const job = await runResultExport({
      columns: exportColumns,
      name: searchName.value,
      model_spec: filters.model_spec.trim() || undefined,
      actual_demand_person: actualDemandPerson,
      empty_actual_demand_person: filters.actual_demand_person === EMPTY_DEMAND_PERSON_FILTER,
      subitem_no:
        filters.subitem_no && filters.subitem_no !== EMPTY_SUBITEM_FILTER
          ? filters.subitem_no
          : undefined,
      empty_subitem_no: filters.subitem_no === EMPTY_SUBITEM_FILTER,
      category: filters.category || undefined,
      status: filters.status.length ? filters.status : undefined,
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
      job.download_filename ?? `申购计划导出_${date}.xlsx`,
    )
    message.success(rows != null ? `查询结果已导出（共${rows}条）` : '查询结果已导出')
  } catch (error) {
    message.error(error instanceof Error ? error.message : '导出失败')
  }
}
/** 把当前打开的详情 id 写进 URL（`?detail=`），刷新 / 新标签页 / 收藏都能回到同一条计划。 */
async function syncDetailQuery(id: number | null) {
  const current = routeQueryString(route.query.detail)
  const next = id === null ? undefined : String(id)
  if (current === (next ?? '')) return
  await router.replace({ query: { ...route.query, detail: next } })
}

/** 详情弹窗开关联动：关闭时清掉 URL 上的 `?detail=`，避免刷新后再次弹出。 */
function handleDetailShow(value: boolean) {
  showDetail.value = value
  if (value) return
  detailPlan.value = null
  detailId.value = null
  void syncDetailQuery(null)
}

function closeDetail() {
  handleDetailShow(false)
}

function openCreate() {
  detailId.value = null
  void syncDetailQuery(null)
  detailPlan.value = null
  showDetail.value = true
}

function openDetail(row: PurchaseMaterial) {
  detailPlan.value = row
  detailId.value = row.id
  void syncDetailQuery(row.id)
  showDetail.value = true
}

/** 按 id 打开详情弹窗（详情页来的深链、补库成功跳转等都用它）。 */
async function openDetailById(id: number) {
  detailId.value = id
  try {
    detailPlan.value = await procurementApi.material(id)
    showDetail.value = true
  } catch (error) {
    message.error(error instanceof Error ? error.message : '申购计划加载失败')
    closeDetail()
  }
}

async function handlePlanSaved(created: boolean) {
  // 新建回第一页看到新记录；编辑已有记录留在当前页，不打断翻到后面页的核对流程
  if (created) page.value = 1
  await Promise.all([load(), loadFilterOptions()])
}

async function handlePlanDeleted() {
  // 防空页：删除的是当前页最后一条且非第一页时回退一页
  if (items.value.length === 1 && page.value > 1) page.value -= 1
  await Promise.all([load(), loadFilterOptions()])
}

async function handlePlanMoved(recordLineId: number) {
  await Promise.all([load(), loadFilterOptions()])
  // 原详情页转入后直接落到新记录的详情；记录详情同样是弹窗，因此跳记录列表并由 ?detail= 打开它
  await router.push({ name: 'purchase-records', query: { detail: String(recordLineId) } })
}

// 工作台「新建申购计划」快捷入口：?create=1 打开新建弹窗，随即把该参数从 URL 去掉
// （刷新 / 后退不会再次弹出）。同样只认本页路由，keepAlive 停用期间不响应。
watch(
  () => routeQueryString(route.query.create),
  async (raw) => {
    if (route.name !== 'purchase-materials' || raw !== '1') return
    await router.replace({ query: { ...route.query, create: undefined } })
    if (canWrite.value) openCreate()
  },
  { immediate: true },
)

// URL → 弹窗的唯一入口：用 watch 而不是 onMounted，keepAlive / 同页导航都能生效
watch(
  () => routeQueryString(route.query.detail),
  (raw) => {
    // 本页是 keepAlive 页：跳去申购记录（转入成功后、记录「转为申购计划」跳回来）时本页只是被
    // 停用，watcher 仍会跑。必须只认自己这条路由，否则会拿对方的 id 去查自己的数据，
    // 并把对方刚写进的 `?detail=` 改写成自己的 id（两条列表来回打架）。
    if (route.name !== 'purchase-materials') return
    const id = Number(raw)
    if (!Number.isInteger(id) || id <= 0) return
    if (showDetail.value && detailId.value === id) return
    void openDetailById(id)
  },
  { immediate: true },
)
function openBatchMove() {
  if (!selectedPlans.value.length) {
    message.warning('请先选择至少一条已有编码的申购计划')
    return
  }
  if (selectedPlans.value.some((item) => !item.material_code)) {
    message.warning('选中的申购计划包含未编码物资，请先补充物料编码')
    return
  }
  Object.assign(batchForm, {
    purchase_order_no: defaultPurchaseOrderNo(),
    trace_no: '',
    contract_no: '',
    vessel_no: '',
    consolidation_date: null,
    consolidation_port: '',
    sailing_date: null,
    contract_sign_date: null,
    purchase_date: Date.now(),
    salesperson: '',
    status: '已申购',
    record_remark: '',
  })
  showBatch.value = true
}
function openBatchEdit() {
  if (!selectedPlans.value.length) {
    message.warning('请先选择至少一条申购计划')
    return
  }
  Object.assign(batchEditForm, {
    update_plan_date: false,
    plan_date: null,
    update_category: false,
    category: '',
    update_urgency: false,
    urgency: defaultPurchaseUrgency,
    update_demand_department: false,
    demand_department: defaultDemandDepartment,
    update_actual_demand_person: false,
    actual_demand_person: '',
    update_purchase_responsible: false,
    purchase_responsible: '',
    update_subitem_no: false,
    subitem_no: '',
    update_usage: false,
    usage: '',
    update_status: false,
    status: defaultPurchasePlanStatus,
  })
  showBatchEdit.value = true
}
async function batchUpdate() {
  const payload: PurchaseMaterialBatchUpdate = {
    materials: selectedPlans.value.map((item) => ({ id: item.id, version: item.version })),
  }
  if (batchEditForm.update_plan_date) {
    if (!batchEditForm.plan_date) {
      message.error('请选择需求日期')
      return
    }
    payload.plan_date = toShanghaiDate(batchEditForm.plan_date)
  }
  if (batchEditForm.update_category) {
    payload.category = batchEditForm.category.trim() || null
  }
  if (batchEditForm.update_urgency) {
    payload.urgency = batchEditForm.urgency
  }
  if (batchEditForm.update_demand_department) {
    if (!batchEditForm.demand_department.trim()) {
      message.error('请输入需求部门')
      return
    }
    payload.demand_department = batchEditForm.demand_department.trim()
  }
  if (batchEditForm.update_actual_demand_person) {
    if (!batchEditForm.actual_demand_person.trim()) {
      message.error('请输入提报员工')
      return
    }
    payload.actual_demand_person = batchEditForm.actual_demand_person.trim()
  }
  if (batchEditForm.update_purchase_responsible) {
    if (!batchEditForm.purchase_responsible.trim()) {
      message.error('请输入实际需求人')
      return
    }
    payload.purchase_responsible = batchEditForm.purchase_responsible.trim()
  }
  if (batchEditForm.update_subitem_no) {
    payload.subitem_no = batchEditForm.subitem_no.trim() || null
  }
  if (batchEditForm.update_usage) {
    if (!batchEditForm.usage.trim()) {
      message.error('请输入用途')
      return
    }
    payload.usage = batchEditForm.usage.trim()
  }
  if (batchEditForm.update_status) {
    payload.status = batchEditForm.status
  }
  if (Object.keys(payload).length === 1) {
    message.warning('请至少勾选一个需要修改的字段')
    return
  }
  batchUpdating.value = true
  try {
    await procurementApi.batchUpdateMaterials(payload)
    message.success(`已批量修改 ${selectedPlans.value.length} 条申购计划`)
    showBatchEdit.value = false
    await Promise.all([load(), loadFilterOptions()])
  } catch (error) {
    message.error(error instanceof Error ? error.message : '批量修改失败')
  } finally {
    batchUpdating.value = false
  }
}
async function batchMove() {
  if (!batchForm.purchase_date) {
    message.error('请选择申购日期')
    return
  }
  batchMoving.value = true
  try {
    await procurementApi.batchMovePlansToRecord(
      selectedPlans.value.map((item) => item.id),
      {
        purchase_order_no: batchForm.purchase_order_no.trim() || null,
        trace_no: batchForm.trace_no.trim() || null,
        contract_no: batchForm.contract_no.trim() || null,
        vessel_no: batchForm.vessel_no.trim() || null,
        consolidation_date: batchForm.consolidation_date
          ? toShanghaiDate(batchForm.consolidation_date)
          : undefined,
        consolidation_port: batchForm.consolidation_port.trim() || null,
        sailing_date: batchForm.sailing_date ? toShanghaiDate(batchForm.sailing_date) : undefined,
        contract_sign_date: batchForm.contract_sign_date
          ? toShanghaiDate(batchForm.contract_sign_date)
          : undefined,
        purchase_date: toShanghaiDate(batchForm.purchase_date),
        salesperson: batchForm.salesperson.trim() || undefined,
        status: batchForm.status.trim(),
        record_remark: batchForm.record_remark.trim() || undefined,
      },
    )
    message.success(`已将 ${selectedPlans.value.length} 条计划转为申购记录`)
    checkedRowKeys.value = []
    showBatch.value = false
    await router.push('/procurement/records')
  } catch (error) {
    message.error(error instanceof Error ? error.message : '批量转入失败')
  } finally {
    batchMoving.value = false
  }
}
async function exportPurchaseApplication() {
  if (!selectedPlans.value.length) return
  const requiredFields = [
    { label: '编码', missing: (item: PurchaseMaterial) => !item.material_code?.trim() },
    { label: '子项号', missing: (item: PurchaseMaterial) => !item.subitem_no?.trim() },
    { label: '用途', missing: (item: PurchaseMaterial) => !item.usage?.trim() },
  ]
  const missingLabels = requiredFields
    .filter(({ missing }) => selectedPlans.value.some(missing))
    .map(({ label }) => label)
  if (missingLabels.length) {
    message.warning(`导出采购申请表前请补全：${missingLabels.join('、')}`)
    return
  }
  batchExporting.value = true
  try {
    const content = await procurementApi.exportPurchaseApplication(
      selectedPlans.value.map((item) => item.id),
    )
    const date = toShanghaiDate(Date.now()).replace(/-/g, '')
    downloadBlob(content, `采购申请表_${date}.xlsx`)
    message.success('采购申请表已导出')
  } catch (error) {
    message.error(error instanceof Error ? error.message : '导出失败')
  } finally {
    batchExporting.value = false
  }
}
async function exportPurchaseApproval() {
  if (!selectedPlans.value.length) return
  const requiredFields = [
    { label: '子项号', missing: (item: PurchaseMaterial) => !item.subitem_no?.trim() },
    { label: '物资名称', missing: (item: PurchaseMaterial) => !item.name?.trim() },
    { label: '型号', missing: (item: PurchaseMaterial) => !item.model_spec?.trim() },
    { label: '申请数量', missing: (item: PurchaseMaterial) => !item.planned_qty?.trim() },
    { label: '单位', missing: (item: PurchaseMaterial) => !item.unit_name?.trim() },
    { label: '用途', missing: (item: PurchaseMaterial) => !item.usage?.trim() },
  ]
  const missingLabels = requiredFields
    .filter(({ missing }) => selectedPlans.value.some(missing))
    .map(({ label }) => label)
  if (missingLabels.length) {
    message.warning(`导出申购审批表前请补全：${missingLabels.join('、')}`)
    return
  }
  try {
    // 后端已异步化：提交 202 秒回任务 → 轮询到终态 → 按 file_uuid 原生下载（链接不鉴权）
    const job = await runApprovalExport(selectedPlans.value.map((item) => item.id))
    if (!job.file_uuid) {
      throw new AppError({
        code: 'EXPORT_FILE_EXPIRED',
        message: '导出文件不存在，请重新导出；若仍失败请确认后端服务已更新到最新版本',
        request_id: '',
      })
    }
    const date = toShanghaiDate(Date.now()).replace(/-/g, '')
    downloadFromUrl(
      exportDownloadUrl(job.file_uuid),
      job.download_filename ?? `采购申请（审批）_${date}.xlsx`,
    )
    const rows = job.result?.rows
    message.success(rows != null ? `申购审批表已导出（共${rows}条）` : '申购审批表已导出')
  } catch (error) {
    message.error(error instanceof Error ? error.message : '导出失败')
  }
}
function handleExport(key: string) {
  if (key === 'results') {
    void exportResults()
    return
  }
  if (key === 'share') {
    showShare.value = true
    return
  }
  if (key === 'purchase-application') void exportPurchaseApplication()
  if (key === 'purchase-approval') void exportPurchaseApproval()
}
onMounted(() => {
  document.addEventListener('fullscreenchange', syncTableFullscreen)
  void loadFilterOptions()
  void loadAiStatus()
  // 列表首载由 usePagedTable（immediate）触发
})
onBeforeUnmount(() => {
  document.removeEventListener('fullscreenchange', syncTableFullscreen)
})
</script>

<template>
  <div class="page">
    <ExportLoadingOverlay :show="exportLoading" />
    <div class="page-header">
      <div>
        <h1 class="page-title">申购计划</h1>
      </div>
      <div class="page-actions">
        <n-space>
          <ExportButton :options="exportOptions" :loading="exportLoading" @select="handleExport" />
          <template v-if="canWrite">
            <n-button :disabled="!selectedPlans.length" @click="openBatchEdit">
              批量修改（{{ selectedPlans.length }}）
            </n-button>
            <n-button :disabled="!selectedPlans.length" @click="openBatchMove">
              批量转为申购记录（{{ selectedPlans.length }}）
            </n-button>
            <n-button type="primary" @click="openCreate">新建申购计划</n-button>
          </template>
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
          <span>子项号</span>
          <n-select
            v-model:value="filters.subitem_no"
            :options="subitemOptions"
            placeholder="选择或搜索子项号"
            filterable
            clearable
          />
        </label>
        <label class="filter-field">
          <span>类别</span>
          <n-select
            v-model:value="filters.category"
            :options="categoryOptions"
            placeholder="选择类别"
            filterable
            clearable
          />
        </label>
        <label class="filter-field">
          <span>申购状态</span>
          <n-select
            v-model:value="filters.status"
            class="status-filter-select"
            :options="statusFilterOptions"
            multiple
            clearable
            placeholder="选择一个或多个状态"
          />
        </label>
      </div>
      <div class="filter-extras-actions">
        <div class="filter-actions">
          <ColumnVisibilityPicker
            :value="visibleColumnKeys"
            :options="fieldOptions"
            storage-key="procurement.purchase-materials.visible-columns.v4"
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
    <div ref="tableAreaRef" class="purchase-plan-table-area">
      <n-button
        class="table-fullscreen-toggle"
        :class="{ 'is-fullscreen': isTableFullscreen }"
        quaternary
        circle
        size="small"
        :title="isTableFullscreen ? '退出表格全屏' : '表格全屏'"
        :aria-label="isTableFullscreen ? '退出表格全屏' : '表格全屏'"
        @click="toggleTableFullscreen"
      />
      <n-card class="data-card">
        <PersistentDataTable
          v-model:checked-row-keys="checkedRowKeys"
          storage-key="procurement/purchase-materials"
          :bordered="false"
          :columns="columns"
          :data="items"
          :loading="loading"
          :remote="true"
          :row-props="rowProps"
          :row-key="(r: PurchaseMaterial) => r.id"
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
      title="批量修改申购计划"
      style="width: min(620px, calc(100vw - 24px))"
      :mask-closable="false"
    >
      <n-alert type="info">
        已选择 {{ selectedPlans.length }} 条计划。仅勾选的字段会被统一修改。
      </n-alert>
      <n-form label-placement="top" size="small" :show-feedback="false">
        <div class="form-grid">
          <n-form-item>
            <template #label>
              <n-checkbox v-model:checked="batchEditForm.update_plan_date">修改需求日期</n-checkbox>
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
              <n-checkbox v-model:checked="batchEditForm.update_category">修改类别</n-checkbox>
            </template>
            <n-select
              v-model:value="batchEditForm.category"
              :options="categoryOptions"
              filterable
              clearable
              placeholder="留空将清除类别"
              :disabled="!batchEditForm.update_category"
            />
          </n-form-item>
          <n-form-item>
            <template #label>
              <n-checkbox v-model:checked="batchEditForm.update_urgency"> 修改紧急程度 </n-checkbox>
            </template>
            <n-select
              v-model:value="batchEditForm.urgency"
              :options="purchaseUrgencyOptions"
              :disabled="!batchEditForm.update_urgency"
            />
          </n-form-item>
          <n-form-item>
            <template #label>
              <n-checkbox v-model:checked="batchEditForm.update_demand_department">
                修改需求部门
              </n-checkbox>
            </template>
            <n-input
              v-model:value="batchEditForm.demand_department"
              maxlength="128"
              :disabled="!batchEditForm.update_demand_department"
            />
          </n-form-item>
          <n-form-item>
            <template #label>
              <n-checkbox v-model:checked="batchEditForm.update_actual_demand_person">
                修改提报员工
              </n-checkbox>
            </template>
            <n-input
              v-model:value="batchEditForm.actual_demand_person"
              maxlength="128"
              :disabled="!batchEditForm.update_actual_demand_person"
            />
          </n-form-item>
          <n-form-item>
            <template #label>
              <n-checkbox v-model:checked="batchEditForm.update_purchase_responsible">
                修改实际需求人
              </n-checkbox>
            </template>
            <n-input
              v-model:value="batchEditForm.purchase_responsible"
              maxlength="128"
              :disabled="!batchEditForm.update_purchase_responsible"
            />
          </n-form-item>
          <n-form-item>
            <template #label>
              <n-checkbox v-model:checked="batchEditForm.update_subitem_no">修改子项号</n-checkbox>
            </template>
            <n-input
              v-model:value="batchEditForm.subitem_no"
              maxlength="64"
              placeholder="留空将清除子项号"
              :disabled="!batchEditForm.update_subitem_no"
            />
          </n-form-item>
          <n-form-item>
            <template #label>
              <n-checkbox v-model:checked="batchEditForm.update_status">修改状态</n-checkbox>
            </template>
            <n-select
              v-model:value="batchEditForm.status"
              :options="purchasePlanStatusOptions"
              :disabled="!batchEditForm.update_status"
            />
          </n-form-item>
        </div>
        <n-form-item>
          <template #label>
            <n-checkbox v-model:checked="batchEditForm.update_usage">修改用途</n-checkbox>
          </template>
          <n-input
            v-model:value="batchEditForm.usage"
            type="textarea"
            maxlength="500"
            show-count
            :disabled="!batchEditForm.update_usage"
          />
        </n-form-item>
      </n-form>
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
      v-model:show="showBatch"
      preset="card"
      draggable
      title="批量转为申购记录"
      style="width: min(620px, calc(100vw - 24px))"
      :mask-closable="false"
    >
      <n-alert type="info">
        已选择 {{ selectedPlans.length }} 条计划，将使用同一申购单号、追溯号和申购日期转入。
      </n-alert>
      <n-form label-placement="top" size="small" :show-feedback="false">
        <div class="form-grid">
          <n-form-item label="申购单号">
            <n-input
              v-model:value="batchForm.purchase_order_no"
              maxlength="128"
              placeholder="可留空"
            />
          </n-form-item>
          <n-form-item label="追溯号">
            <n-input v-model:value="batchForm.trace_no" maxlength="128" placeholder="可留空" />
          </n-form-item>
          <n-form-item label="合同号">
            <n-input v-model:value="batchForm.contract_no" maxlength="128" placeholder="可留空" />
          </n-form-item>
          <n-form-item label="船号">
            <n-input v-model:value="batchForm.vessel_no" maxlength="128" placeholder="可留空" />
          </n-form-item>
          <n-form-item label="集港日期">
            <n-date-picker
              v-model:value="batchForm.consolidation_date"
              type="date"
              class="full-width"
              clearable
            />
          </n-form-item>
          <n-form-item label="集港港口">
            <n-input
              v-model:value="batchForm.consolidation_port"
              maxlength="128"
              placeholder="可留空"
            />
          </n-form-item>
          <n-form-item label="发船日期">
            <n-date-picker
              v-model:value="batchForm.sailing_date"
              type="date"
              class="full-width"
              clearable
            />
          </n-form-item>
          <n-form-item label="合同签订日期">
            <n-date-picker
              v-model:value="batchForm.contract_sign_date"
              type="date"
              class="full-width"
              clearable
            />
          </n-form-item>
          <n-form-item label="申购日期" required>
            <n-date-picker v-model:value="batchForm.purchase_date" type="date" class="full-width" />
          </n-form-item>
          <n-form-item label="业务员">
            <n-input v-model:value="batchForm.salesperson" maxlength="128" />
          </n-form-item>
          <n-form-item label="状态" required>
            <n-input v-model:value="batchForm.status" maxlength="128" />
          </n-form-item>
        </div>
        <n-form-item label="记录备注">
          <n-input
            v-model:value="batchForm.record_remark"
            type="textarea"
            maxlength="1000"
            show-count
          />
        </n-form-item>
      </n-form>
      <template #footer>
        <n-space justify="end">
          <n-button @click="showBatch = false">取消</n-button>
          <n-button type="primary" :loading="batchMoving" @click="batchMove">确认转入</n-button>
        </n-space>
      </template>
    </n-modal>
    <PurchasePlanDetailModal
      :show="showDetail"
      :plan="detailPlan"
      :categories="filterOptions.categories"
      @update:show="handleDetailShow"
      @saved="handlePlanSaved"
      @deleted="handlePlanDeleted"
      @moved="handlePlanMoved"
    />
    <ShareLinkDialog
      v-model:show="showShare"
      share-type="purchase_plan"
      :item-ids="selectedPlans.map((item) => item.id)"
      title="申购计划"
    />
  </div>
</template>

<style scoped>
.status-filter-select :deep(.n-base-selection-tags) {
  min-height: var(--control-height);
  padding: 4px 30px 1px 10px;
}

.status-filter-select :deep(.n-base-selection-tag-wrapper) {
  padding: 0 6px 3px 0;
}

.status-filter-select :deep(.n-base-selection-placeholder) {
  padding: 0 30px 0 10px;
}

.purchase-plan-table-area {
  position: relative;
}

.table-fullscreen-toggle {
  position: absolute;
  z-index: 2;
  top: 6px;
  right: 6px;
  width: 28px;
  height: 28px;
  color: var(--color-status-icon);
}

.table-fullscreen-toggle::before {
  width: 13px;
  height: 13px;
  border-top: 2px solid currentcolor;
  border-right: 2px solid currentcolor;
  border-top-right-radius: 1px;
  content: '';
  transition:
    color 0.18s ease,
    transform 0.18s ease;
}

.table-fullscreen-toggle.is-fullscreen::before {
  transform: rotate(180deg);
}

.table-fullscreen-toggle:hover {
  background: var(--color-status-icon-hover-bg);
  color: var(--color-status-icon-hover);
}

.purchase-plan-table-area:fullscreen {
  overflow: auto;
  padding: var(--page-gap);
  background: var(--color-bg);
}

.purchase-plan-table-area:fullscreen :deep(.n-card) {
  min-height: 100%;
}
</style>
