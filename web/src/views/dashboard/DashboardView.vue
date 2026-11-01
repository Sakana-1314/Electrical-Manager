<script setup lang="ts">
import { computed, onActivated, onBeforeUnmount, onMounted, ref, type Component } from 'vue'
import { useRouter, type RouteLocationRaw } from 'vue-router'
import {
  AddCircleOutline,
  AlertCircleOutline,
  ArrowDownCircleOutline,
  ArrowUpCircleOutline,
  BarcodeOutline,
  CartOutline,
  ChevronForwardOutline,
  CubeOutline,
  DocumentTextOutline,
  HourglassOutline,
  RefreshOutline,
  ShieldCheckmarkOutline,
  TimeOutline,
  WarningOutline,
} from '@vicons/ionicons5'
import { inventoryApi } from '@/api/inventory'
import { hazardApi } from '@/api/hazards'
import type {
  DashboardSummary,
  HazardStats,
  InventoryBalance,
  StockOperation,
} from '@/api/generated'
import { useAuthStore } from '@/stores/auth'
import { useSettingsStore } from '@/stores/settings'
import { formatShanghaiTime } from '@/utils/time'

type Tone = 'primary' | 'success' | 'warning' | 'danger' | 'neutral'

interface Metric {
  key: string
  label: string
  value: number | null
  icon: Component
  /** 数值为 0 时退回中性色：「低库存 0」不该用红色制造紧张感 */
  tone: Tone
  to: RouteLocationRaw
}

interface MetricGroup {
  key: string
  title: string
  to: RouteLocationRaw
  metrics: Metric[]
}

const router = useRouter()
const auth = useAuthStore()
const settings = useSettingsStore()

const loading = ref(true)
const refreshing = ref(false)
const failed = ref<string[]>([])
const updatedAt = ref<number | null>(null)
const summary = ref<DashboardSummary | null>(null)
const hazardStats = ref<HazardStats | null>(null)
const lowStock = ref<InventoryBalance[]>([])
const lowStockTotal = ref(0)
const recentOperations = ref<StockOperation[]>([])

const showWarehouse = computed(() => settings.isFeatureVisible('warehouse'))
const showProcurement = computed(() => settings.isFeatureVisible('procurement'))
const showHazards = computed(() => settings.isFeatureVisible('hazards'))
/** 精简模式没有出入库流水与补库策略，库存区只保留物资数 */
const fullWarehouse = computed(() => showWarehouse.value && !settings.isLiteMode)

const groups = computed<MetricGroup[]>(() => {
  const s = summary.value
  const h = hazardStats.value
  const out: MetricGroup[] = []
  if (showWarehouse.value) {
    const stockRoute = settings.isLiteMode ? { name: 'warehouse-lite' } : { name: 'stock' }
    const metrics: Metric[] = [
      {
        key: 'stock',
        label: '库存物资',
        value: s?.stock_material_count ?? null,
        icon: CubeOutline,
        tone: 'primary',
        to: stockRoute,
      },
    ]
    if (!settings.isLiteMode) {
      metrics.push(
        {
          key: 'low',
          label: '低库存',
          value: s?.low_stock_count ?? null,
          icon: AlertCircleOutline,
          tone: 'danger',
          to: { name: 'stock', query: { low_stock: 'true' } },
        },
        {
          key: 'today-in',
          label: '今日入库',
          value: s?.today_inbound_count ?? null,
          icon: ArrowDownCircleOutline,
          tone: 'primary',
          to: { name: 'operations', query: { operation_type: 'INBOUND' } },
        },
        {
          key: 'today-out',
          label: '今日出库',
          value: s?.today_outbound_count ?? null,
          icon: ArrowUpCircleOutline,
          tone: 'primary',
          to: { name: 'operations', query: { operation_type: 'OUTBOUND' } },
        },
      )
    }
    out.push({ key: 'warehouse', title: '二级库', to: stockRoute, metrics })
  }
  if (showProcurement.value) {
    out.push({
      key: 'procurement',
      title: '申购',
      to: { name: 'purchase-materials' },
      metrics: [
        {
          key: 'pending-plan',
          label: '待请购计划',
          value: s?.pending_purchase_plan_count ?? null,
          icon: DocumentTextOutline,
          tone: 'primary',
          to: { name: 'purchase-materials' },
        },
        {
          key: 'uncoded',
          label: '未编码物资',
          value: s?.uncoded_purchase_material_count ?? null,
          icon: BarcodeOutline,
          tone: 'warning',
          to: { name: 'uncoded-materials' },
        },
        {
          key: 'in-progress',
          label: '在途申购',
          value: s?.purchase_in_progress_count ?? null,
          icon: CartOutline,
          tone: 'primary',
          to: { name: 'purchase-records' },
        },
        {
          key: 'records',
          label: '申购记录',
          value: s?.purchase_record_count ?? null,
          icon: HourglassOutline,
          tone: 'neutral',
          to: { name: 'purchase-records' },
        },
      ],
    })
  }
  if (showHazards.value) {
    out.push({
      key: 'hazards',
      title: '隐患',
      to: { name: 'hazard-records' },
      metrics: [
        {
          key: 'pending',
          label: '待整改',
          value: h?.pending ?? null,
          icon: WarningOutline,
          tone: 'warning',
          to: { name: 'hazard-records', query: { status: '待整改' } },
        },
        {
          key: 'overdue',
          label: '逾期未整改',
          value: h?.overdue ?? null,
          icon: TimeOutline,
          tone: 'danger',
          to: { name: 'hazard-records', query: { overdue: 'true' } },
        },
        {
          key: 'blocked',
          label: '整改受阻',
          value: h?.blocked ?? null,
          icon: AlertCircleOutline,
          tone: 'danger',
          to: { name: 'hazard-records', query: { status: '整改受阻' } },
        },
        {
          key: 'done',
          label: '已整改',
          value: h?.done ?? null,
          icon: ShieldCheckmarkOutline,
          tone: 'success',
          to: { name: 'hazard-records', query: { status: '已整改' } },
        },
      ],
    })
  }
  return out
})

interface QuickAction {
  key: string
  label: string
  icon: Component
  to: RouteLocationRaw
}
/** 快捷操作：只给有写权限、且对应主 tab 可见的入口 */
const quickActions = computed<QuickAction[]>(() => {
  const actions: QuickAction[] = []
  if (fullWarehouse.value && auth.can('warehouse:write')) {
    actions.push(
      { key: 'inbound', label: '办理入库', icon: ArrowDownCircleOutline, to: { name: 'inbound' } },
      { key: 'outbound', label: '办理出库', icon: ArrowUpCircleOutline, to: { name: 'outbound' } },
    )
  }
  if (showProcurement.value && auth.can('purchase:write')) {
    actions.push({
      key: 'plan',
      label: '新建申购计划',
      icon: AddCircleOutline,
      to: { name: 'purchase-materials', query: { create: '1' } },
    })
  }
  if (showHazards.value && auth.can('hazard:write')) {
    actions.push({
      key: 'hazard',
      label: '登记隐患',
      icon: WarningOutline,
      to: { name: 'hazard-records', query: { create: '1' } },
    })
  }
  return actions
})

function metricTone(metric: Metric): Tone {
  return metric.value ? metric.tone : 'neutral'
}

/** 各块独立请求、独立失败：任何一个接口出错都不拖垮整页，失败的块显示「—」并给出重试入口 */
async function load(silent = false) {
  if (silent) refreshing.value = true
  else loading.value = true
  const errors: string[] = []
  const tasks: Promise<void>[] = [
    inventoryApi
      .summary()
      .then((value) => {
        summary.value = value
      })
      .catch(() => {
        errors.push('概览')
      }),
  ]
  if (showHazards.value) {
    tasks.push(
      hazardApi
        .stats()
        .then((value) => {
          hazardStats.value = value
        })
        .catch(() => {
          errors.push('隐患统计')
        }),
    )
  }
  if (fullWarehouse.value) {
    tasks.push(
      inventoryApi
        .lowStock({ page_size: 6 })
        .then((page) => {
          lowStock.value = page.items
          lowStockTotal.value = page.total
        })
        .catch(() => {
          errors.push('低库存')
        }),
      inventoryApi
        .operations({ page_size: 6 })
        .then((page) => {
          recentOperations.value = page.items
        })
        .catch(() => {
          errors.push('最近出入库')
        }),
    )
  }
  await Promise.all(tasks)
  failed.value = errors
  updatedAt.value = Date.now()
  loading.value = false
  refreshing.value = false
}

const updatedLabel = computed(() => {
  if (!updatedAt.value) return ''
  const date = new Date(updatedAt.value)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `更新于 ${pad(date.getHours())}:${pad(date.getMinutes())}`
})

function operationSummary(op: StockOperation): string {
  const first = op.lines[0]
  if (!first) return op.business_reason || '—'
  const more = op.lines.length > 1 ? ` 等 ${op.lines.length} 项` : ''
  return `${first.material_name}${more}`
}

function operationQty(op: StockOperation): string {
  const first = op.lines[0]
  if (!first || op.lines.length > 1) return `${op.lines.length} 项`
  return `${first.quantity} ${first.unit_name}`
}

function openOperation(op: StockOperation) {
  void router.push({ name: 'operations', query: { detail: String(op.id) } })
}

// 工作台常开在大屏上：回到页面可见时若数据已超过 2 分钟，静默刷新一次（不遮罩、不打断阅读）
const STALE_MS = 2 * 60 * 1000
function refreshIfStale() {
  if (document.visibilityState !== 'visible' || loading.value || refreshing.value) return
  if (updatedAt.value && Date.now() - updatedAt.value > STALE_MS) void load(true)
}
document.addEventListener('visibilitychange', refreshIfStale)
onBeforeUnmount(() => document.removeEventListener('visibilitychange', refreshIfStale))
onActivated(refreshIfStale)
onMounted(() => void load())
</script>

<template>
  <div class="page dashboard">
    <div class="page-header">
      <div>
        <h1 class="page-title">工作台</h1>
      </div>
      <div class="page-actions">
        <n-space :size="10" align="center" :wrap="false">
          <span v-if="updatedLabel" class="dashboard-updated">{{ updatedLabel }}</span>
          <n-button :loading="refreshing" :disabled="loading" @click="load(true)">
            <template #icon>
              <n-icon><RefreshOutline /></n-icon>
            </template>
            刷新
          </n-button>
        </n-space>
      </div>
    </div>

    <n-alert v-if="failed.length && !loading" type="warning" :bordered="false" closable>
      {{ failed.join('、') }}加载失败，对应数据显示为「—」。
      <n-button text type="primary" class="dashboard-retry" @click="load(true)">重试</n-button>
    </n-alert>

    <nav v-if="quickActions.length" class="quick-actions" aria-label="快捷操作">
      <router-link
        v-for="action in quickActions"
        :key="action.key"
        :to="action.to"
        class="quick-action"
      >
        <span class="quick-action__icon"><n-icon :size="18" :component="action.icon" /></span>
        <span>{{ action.label }}</span>
      </router-link>
    </nav>

    <div class="metric-groups">
      <section v-for="group in groups" :key="group.key" class="metric-group">
        <header class="metric-group__header">
          <span class="card-title">{{ group.title }}</span>
          <router-link :to="group.to" class="metric-group__link">
            进入<n-icon :size="14"><ChevronForwardOutline /></n-icon>
          </router-link>
        </header>
        <div class="metric-grid">
          <router-link
            v-for="metric in group.metrics"
            :key="metric.key"
            :to="metric.to"
            class="metric"
            :class="`metric--${metricTone(metric)}`"
          >
            <span class="metric__icon"><n-icon :size="18" :component="metric.icon" /></span>
            <span class="metric__label">{{ metric.label }}</span>
            <n-skeleton v-if="loading" text class="metric__skeleton" />
            <strong v-else class="metric__value">{{ metric.value ?? '—' }}</strong>
          </router-link>
        </div>
      </section>
    </div>

    <div v-if="fullWarehouse" class="dashboard-panels">
      <n-card class="data-card">
        <template #header>
          <span class="card-title">低库存提醒</span>
          <n-tag v-if="lowStockTotal" size="small" type="error" :bordered="false" round>
            {{ lowStockTotal }}
          </n-tag>
        </template>
        <template #header-extra>
          <router-link :to="{ name: 'stock', query: { low_stock: 'true' } }" class="panel-link">
            查看全部
          </router-link>
        </template>
        <n-skeleton v-if="loading" text :repeat="4" />
        <n-empty v-else-if="!lowStock.length" description="库存充足，没有低于最低库存的物资" />
        <ul v-else class="row-list">
          <li v-for="item in lowStock" :key="item.stock_material_id">
            <router-link
              :to="{ name: 'stock', query: { keyword: item.name, low_stock: 'true' } }"
              class="row-item"
            >
              <span class="table-material-summary">
                <span class="table-material-summary__name">{{ item.name }}</span>
                <span class="table-material-summary__meta">{{ item.model_spec }}</span>
              </span>
              <span class="row-item__qty">
                <strong class="danger-text">{{ item.current_qty }}</strong>
                <span class="muted"> / {{ item.minimum_qty ?? '—' }} {{ item.unit_name }}</span>
              </span>
            </router-link>
          </li>
        </ul>
      </n-card>

      <n-card class="data-card">
        <template #header>
          <span class="card-title">最近出入库</span>
        </template>
        <template #header-extra>
          <router-link :to="{ name: 'operations' }" class="panel-link">全部记录</router-link>
        </template>
        <n-skeleton v-if="loading" text :repeat="4" />
        <n-empty v-else-if="!recentOperations.length" description="还没有出入库记录" />
        <ul v-else class="row-list">
          <li v-for="op in recentOperations" :key="op.id">
            <button type="button" class="row-item" @click="openOperation(op)">
              <n-tag
                size="small"
                :bordered="false"
                :type="op.operation_type === 'INBOUND' ? 'info' : 'warning'"
              >
                {{ op.operation_type === 'INBOUND' ? '入库' : '出库' }}
              </n-tag>
              <span class="row-item__main">
                <span class="row-item__title">{{ operationSummary(op) }}</span>
                <span class="row-item__meta">
                  {{ formatShanghaiTime(op.occurred_at).slice(5, 16) }}
                  <template v-if="op.receiver_name"> · {{ op.receiver_name }}</template>
                  <template v-if="op.mini_program_user_name"> · 小程序</template>
                </span>
              </span>
              <span class="row-item__qty muted">{{ operationQty(op) }}</span>
            </button>
          </li>
        </ul>
      </n-card>
    </div>
  </div>
</template>

<style scoped>
.dashboard-updated {
  color: var(--color-text-muted);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.dashboard-retry {
  margin-left: 6px;
}
/* 快捷操作：主色浅底胶囊，一排排开，窄屏横向滑动 */
.quick-actions {
  display: flex;
  gap: 10px;
  overflow-x: auto;
  scrollbar-width: none;
}
.quick-actions::-webkit-scrollbar {
  display: none;
}
.quick-action {
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: 8px;
  height: 40px;
  padding: 0 16px 0 8px;
  border: 1px solid var(--color-primary-border);
  border-radius: 999px;
  color: var(--color-primary-strong-text);
  background: var(--color-primary-soft);
  font-size: 13px;
  font-weight: 600;
  transition:
    background-color 0.2s ease,
    border-color 0.2s ease,
    transform 0.2s ease;
}
.quick-action:hover,
.quick-action:focus-visible {
  border-color: var(--color-primary);
  background: var(--color-primary-soft-hover);
  outline: none;
  transform: translateY(-1px);
}
.quick-action__icon {
  display: grid;
  width: 26px;
  height: 26px;
  place-items: center;
  border-radius: 50%;
  color: var(--color-surface);
  background: var(--color-primary);
}
/* 指标分组：每个业务模块一张卡片，卡片内 2×2 指标格 */
.metric-groups {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 18px;
}
.metric-group {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 18px 20px 20px;
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-card);
  background: var(--color-surface);
  box-shadow: var(--shadow-card);
}
.metric-group__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.metric-group__link,
.panel-link {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  color: var(--color-primary);
  font-size: 13px;
}
.metric-group__link:hover,
.panel-link:hover {
  color: var(--color-primary-hover);
}
.metric-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}
.metric {
  --metric-color: var(--color-text-muted);
  display: grid;
  grid-template-columns: auto 1fr;
  grid-template-rows: auto auto;
  align-items: center;
  gap: 6px 8px;
  min-width: 0;
  padding: 12px 14px;
  border: 1px solid transparent;
  border-radius: 12px;
  background: var(--color-panel);
  transition:
    background-color 0.2s ease,
    border-color 0.2s ease,
    box-shadow 0.2s ease;
}
.metric:hover,
.metric:focus-visible {
  border-color: var(--color-primary-border);
  background: var(--color-panel-hover);
  box-shadow: var(--shadow-card-hover);
  outline: none;
}
.metric--primary {
  --metric-color: var(--color-primary);
}
.metric--success {
  --metric-color: var(--color-success);
}
.metric--warning {
  --metric-color: var(--color-warning);
}
.metric--danger {
  --metric-color: var(--color-danger);
}
.metric__icon {
  display: inline-flex;
  color: var(--metric-color);
}
.metric__label {
  overflow: hidden;
  color: var(--color-text);
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.metric__value {
  grid-column: 1 / -1;
  color: var(--metric-color);
  font-size: 26px;
  font-weight: 650;
  font-variant-numeric: tabular-nums;
  line-height: 1.15;
}
.metric--neutral .metric__value {
  color: var(--color-text-strong);
}
.metric__skeleton {
  grid-column: 1 / -1;
  width: 60%;
  height: 30px;
}
/* 低库存 + 最近出入库：桌面两栏，窄屏单栏 */
.dashboard-panels {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18px;
}
.dashboard-panels :deep(.n-card-header__main) {
  display: flex;
  align-items: center;
  gap: 8px;
}
.row-list {
  margin: 0;
  padding: 0;
  list-style: none;
}
.row-list > li + li {
  border-top: 1px solid var(--color-border-subtle);
}
.row-item {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 12px;
  padding: 10px 8px;
  border: 0;
  border-radius: 8px;
  color: inherit;
  background: transparent;
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition: background-color 0.2s ease;
}
.row-item:hover,
.row-item:focus-visible {
  background: var(--color-table-row-hover);
  outline: none;
}
.row-item > .table-material-summary,
.row-item__main {
  flex: 1;
  min-width: 0;
}
.row-item__main {
  display: grid;
  gap: 2px;
}
.row-item__title {
  overflow: hidden;
  color: var(--color-text-strong);
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.row-item__meta {
  overflow: hidden;
  color: var(--color-text-muted);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.row-item__qty {
  flex: none;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
@media (max-width: 1200px) {
  .dashboard-panels {
    grid-template-columns: minmax(0, 1fr);
  }
}
@media (max-width: 768px) {
  .metric-group {
    padding: 14px 14px 16px;
  }
  .metric__value {
    font-size: 22px;
  }
}
</style>
