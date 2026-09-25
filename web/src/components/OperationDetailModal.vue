<script setup lang="ts">
/**
 * 出入库流水「详情 / 编辑 / 冲销」弹窗。
 *
 * 取代原来的 `OperationDetailView` 页面：操作记录列表点行、点「详情」、以及入库/出库提交成功
 * 后的跳转都打开本弹窗。内容与原详情页一一对应——Hero 摘要（流水号 / 类型 / 发生时间 /
 * 操作来源 / 操作人 / 明细项数）、单据信息（只读 `n-descriptions` 与编辑表单互斥）、物资明细
 * （只读表格与行编辑器互斥）、修改影响提示与保存前的变化摘要确认、反向冲销入口。
 *
 * 关闭语义见 `useMaskCloseGuard`：编辑态有未保存修改时，点遮罩 / ESC / × 先二次确认。
 */
import { computed, reactive, ref, watch } from 'vue'
import { useDialog, useMessage } from 'naive-ui'
import type { OperationType, SourceType, StockOperation } from '@/api/generated'
import { inventoryApi } from '@/api/inventory'
import { useAuthStore } from '@/stores/auth'
import { formatShanghaiTime, toIsoWithTimezone } from '@/utils/time'
import LoadingMask from '@/components/LoadingMask.vue'
import OperationLinesEditor, {
  type OperationLineModel,
} from '@/components/OperationLinesEditor.vue'
import ReverseOperationDialog from '@/components/ReverseOperationDialog.vue'
import { useMaskCloseGuard } from '@/composables/useMaskCloseGuard'
import { compareDecimal, isDecimalString, subtractDecimal } from '@/utils/decimal'

const props = withDefaults(
  defineProps<{
    show: boolean
    /** 要查看的流水 id；null 表示未指定（弹窗不加载） */
    operationId?: number | null
  }>(),
  { operationId: null },
)

const emit = defineEmits<{
  'update:show': [value: boolean]
  /** 流水被修改 */
  saved: []
  /** 已被冲销，回传冲销后的新流水 id（列表据此切到新流水） */
  reversed: [id: number]
}>()

const auth = useAuthStore()
const message = useMessage()
const dialog = useDialog()

const showModel = computed({
  get: () => props.show,
  set: (value: boolean) => emit('update:show', value),
})

const operation = ref<StockOperation | null>(null)
const loading = ref(false)
const editing = ref(false)
const saving = ref(false)
const canWrite = computed(() => auth.can('warehouse:write'))

const sourceTypeLabels: Record<SourceType, string> = {
  MANUAL: '管理端手工录入',
  MINI_PROGRAM: '微信小程序出库',
  REVERSAL: '系统反向冲销',
  INITIALIZATION: '库存初始化',
}
const sourceTypeOptions = Object.entries(sourceTypeLabels).map(([value, label]) => ({
  label,
  value: value as SourceType,
}))
const editableSourceTypeOptions = computed(() => {
  const currentSource = operation.value?.source_type
  if (currentSource === 'MINI_PROGRAM' || currentSource === 'REVERSAL') {
    return sourceTypeOptions.filter((option) => option.value === currentSource)
  }
  return sourceTypeOptions.filter(
    (option) => option.value === 'MANUAL' || option.value === 'INITIALIZATION',
  )
})
const edit = reactive({
  operation_type: 'INBOUND' as OperationType,
  occurred_at: Date.now(),
  business_reason: '',
  receiver_unit: '',
  receiver_name: '',
  subitem_no: '',
  source_type: 'MANUAL' as SourceType,
  lines: [] as OperationLineModel[],
})

/** 脏判定只针对编辑态：只读看详情时点遮罩应当直接关。 */
function snapshot(): string {
  return JSON.stringify({
    operation_type: edit.operation_type,
    occurred_at: edit.occurred_at,
    business_reason: edit.business_reason,
    receiver_unit: edit.receiver_unit,
    receiver_name: edit.receiver_name,
    subitem_no: edit.subitem_no,
    source_type: edit.source_type,
    lines: edit.lines.map((line) => [line.stock_material_id, line.quantity]),
  })
}
const baseline = ref('')

const { requestClose } = useMaskCloseGuard({
  isDirty: () => editing.value && snapshot() !== baseline.value,
  close: () => {
    showModel.value = false
  },
})

/** `@close` 必须返回 false，否则 naive-ui 自己会把 show 置 false，拦不住「继续编辑」。 */
function handleCloseClick(): false {
  requestClose()
  return false
}

/**
 * 行编辑器需要完整物资对象（选物资、显示型号单位），但流水行只带快照字段，
 * 所以按 `stock_material_id` 逐个补齐——与原来详情页的做法一致。
 */
async function resetEditor(value: StockOperation) {
  const materials = await Promise.all(
    value.lines.map((line) => inventoryApi.material(line.stock_material_id)),
  )
  Object.assign(edit, {
    operation_type: value.operation_type,
    occurred_at: new Date(value.occurred_at).getTime(),
    business_reason: value.business_reason,
    receiver_unit: value.receiver_unit || '',
    receiver_name: value.receiver_name || '',
    subitem_no: value.subitem_no || '',
    source_type: value.source_type,
    lines: value.lines.map((line, index) => ({
      stock_material_id: line.stock_material_id,
      quantity: line.quantity,
      material: materials[index],
    })),
  })
  baseline.value = snapshot()
}

async function load() {
  const id = props.operationId
  if (id === null || id === undefined) return
  loading.value = true
  try {
    const value = await inventoryApi.operation(id)
    operation.value = value
    await resetEditor(value)
  } catch (error) {
    message.error(error instanceof Error ? error.message : '流水加载失败')
    showModel.value = false
  } finally {
    loading.value = false
  }
}

function validationError(): string | null {
  if (edit.operation_type === 'OUTBOUND' && !edit.business_reason.trim()) return '用途必填'
  if (edit.operation_type === 'OUTBOUND' && !edit.receiver_name.trim()) return '领用人必填'
  if (
    !edit.lines.length ||
    edit.lines.some((line) => !line.stock_material_id || !isDecimalString(line.quantity, 1))
  )
    return '请完整填写物资和有效数量'
  return null
}

async function save() {
  if (!operation.value) return
  saving.value = true
  try {
    operation.value = await inventoryApi.updateOperation(operation.value.id, {
      version: operation.value.version,
      operation_type: edit.operation_type,
      occurred_at: toIsoWithTimezone(edit.occurred_at),
      business_reason: edit.business_reason.trim(),
      receiver_unit:
        edit.operation_type === 'OUTBOUND' ? edit.receiver_unit.trim() || undefined : undefined,
      receiver_name:
        edit.operation_type === 'OUTBOUND' ? edit.receiver_name.trim() || undefined : undefined,
      subitem_no:
        edit.operation_type === 'OUTBOUND' ? edit.subitem_no.trim() || undefined : undefined,
      source_type: edit.source_type,
      lines: edit.lines.map((line) => ({
        stock_material_id: line.stock_material_id!,
        quantity: line.quantity,
      })),
    })
    message.success('流水已修改，库存已重新计算')
    editing.value = false
    await load()
    emit('saved')
  } catch (error) {
    message.error(error instanceof Error ? error.message : '保存失败')
  } finally {
    saving.value = false
  }
}

// 对比原流水行与新编辑行，产出受影响物资的数量变化摘要（含新增/删除的行）
const editChanges = computed<string[]>(() => {
  const value = operation.value
  if (!value) return []
  const oldByMaterial = new Map(value.lines.map((line) => [line.stock_material_id, line.quantity]))
  const newByMaterial = new Map(
    edit.lines
      .filter(
        (line): line is OperationLineModel & { stock_material_id: number } =>
          !!line.stock_material_id,
      )
      .map((line) => [line.stock_material_id, line.quantity]),
  )
  const ids = new Set([...oldByMaterial.keys(), ...newByMaterial.keys()])
  const summary: string[] = []
  for (const id of ids) {
    const oldQty = oldByMaterial.get(id)
    const newQty = newByMaterial.get(id)
    const name = value.lines.find((line) => line.stock_material_id === id)?.material_name
    const unit = value.lines.find((line) => line.stock_material_id === id)?.unit_name || ''
    if (oldQty === undefined) {
      summary.push(`${name}：新增 ${newQty} ${unit}`)
    } else if (newQty === undefined) {
      summary.push(`${name}：删除 ${oldQty} ${unit}`)
    } else if (oldQty !== newQty) {
      const diff = subtractDecimal(newQty, oldQty)
      summary.push(`${name}：${oldQty} → ${newQty} ${unit}（变化 ${diff}）`)
    } else {
      summary.push(`${name}：${oldQty} ${unit}（无变化）`)
    }
  }
  return summary
})

function confirmSave() {
  const error = validationError()
  if (error) {
    message.error(error)
    return
  }
  dialog.warning({
    draggable: true,
    title: '确认修改流水',
    content: `修改流水将重新计算受影响物资的库存和后续流水快照。\n\n${editChanges.value.join('\n')}`,
    positiveText: '确认修改',
    negativeText: '取消',
    onPositiveClick: save,
  })
}

function sourceTagType(sourceType: SourceType) {
  if (sourceType === 'MINI_PROGRAM') return 'info'
  if (sourceType === 'REVERSAL') return 'warning'
  if (sourceType === 'INITIALIZATION') return 'success'
  return 'default'
}

async function cancelEdit() {
  if (operation.value) await resetEditor(operation.value)
  editing.value = false
}

async function startEdit() {
  if (operation.value) await resetEditor(operation.value)
  editing.value = true
}

const showReverse = ref(false)
function onReversed(id: number) {
  showModel.value = false
  emit('reversed', id)
}

// 冲销流水本身不可再冲销；原流水还有剩余可冲数量时才显示冲销按钮
const canReverse = computed(() => {
  const value = operation.value
  if (!value || value.is_reversed) return false
  return value.lines.some((line) => compareDecimal(line.remaining_qty, '0') > 0)
})

watch(
  () => [props.show, props.operationId] as const,
  ([show]) => {
    if (!show) {
      editing.value = false
      operation.value = null
      return
    }
    void load()
  },
  { immediate: true },
)
</script>

<template>
  <n-modal
    v-model:show="showModel"
    preset="card"
    draggable
    data-detail-modal
    title="出入库流水详情"
    style="width: min(960px, calc(100vw - 24px))"
    :mask-closable="false"
    :close-on-esc="false"
    @mask-click="requestClose"
    @esc="requestClose"
    @close="handleCloseClick"
  >
    <LoadingMask :show="loading" text="加载中…" />
    <template v-if="operation">
      <n-card :bordered="false" class="operation-hero">
        <div class="operation-hero-layout">
          <div class="operation-hero-main">
            <div class="operation-eyebrow">库存操作流水</div>
            <div class="operation-title-row">
              <span class="operation-no">{{ operation.operation_no }}</span>
              <n-tag
                round
                size="large"
                :type="operation.operation_type === 'INBOUND' ? 'success' : 'warning'"
              >
                {{ operation.operation_type === 'INBOUND' ? '入库' : '出库' }}
              </n-tag>
            </div>
            <div class="operation-meta-row">
              <span>发生时间</span>
              <strong>{{ formatShanghaiTime(operation.occurred_at) }}</strong>
              <span class="operation-meta-divider"></span>
              <span>操作来源</span>
              <n-tag :type="sourceTagType(operation.source_type)" size="small">
                {{ sourceTypeLabels[operation.source_type] }}
              </n-tag>
              <template v-if="operation.mini_program_user_name">
                <span class="operation-meta-divider"></span>
                <span>操作人</span>
                <strong>{{ operation.mini_program_user_name }}</strong>
              </template>
            </div>
          </div>
          <div class="operation-line-count">
            <span>物资明细</span>
            <div>
              <strong>{{ operation.lines.length }}</strong
              ><small>项</small>
            </div>
          </div>
        </div>
      </n-card>

      <n-alert v-if="editing" type="warning" title="修改影响提示" style="margin-top: 12px">
        保存后，后端会按发生时间重放相关物资的全部流水；允许形成负库存。
      </n-alert>

      <n-divider title-placement="left">单据信息</n-divider>
      <n-form v-if="editing" label-placement="top">
        <div class="form-grid">
          <n-form-item label="业务类型">
            <n-select
              v-model:value="edit.operation_type"
              :options="[
                { label: '入库', value: 'INBOUND' },
                { label: '出库', value: 'OUTBOUND' },
              ]"
              :disabled="['MINI_PROGRAM', 'REVERSAL'].includes(operation.source_type)"
            />
          </n-form-item>
          <n-form-item label="发生时间">
            <n-date-picker v-model:value="edit.occurred_at" type="datetime" class="full-width" />
          </n-form-item>
          <n-form-item label="操作来源">
            <n-select
              v-model:value="edit.source_type"
              :options="editableSourceTypeOptions"
              :disabled="['MINI_PROGRAM', 'REVERSAL'].includes(operation.source_type)"
            />
          </n-form-item>
          <n-form-item v-if="edit.operation_type === 'OUTBOUND'" label="领用单位">
            <n-input v-model:value="edit.receiver_unit" maxlength="128" />
          </n-form-item>
          <n-form-item v-if="edit.operation_type === 'OUTBOUND'" label="领用人" required>
            <n-input v-model:value="edit.receiver_name" maxlength="64" />
          </n-form-item>
          <n-form-item v-if="edit.operation_type === 'OUTBOUND'" label="子项号">
            <n-input v-model:value="edit.subitem_no" maxlength="64" />
          </n-form-item>
        </div>
        <n-form-item label="用途" :required="edit.operation_type === 'OUTBOUND'">
          <n-input v-model:value="edit.business_reason" maxlength="500" />
        </n-form-item>
      </n-form>
      <n-descriptions v-else :column="3">
        <n-descriptions-item label="类型">
          {{ operation.operation_type === 'INBOUND' ? '入库' : '出库' }}
        </n-descriptions-item>
        <n-descriptions-item label="操作来源">
          {{ sourceTypeLabels[operation.source_type] }}
        </n-descriptions-item>
        <n-descriptions-item label="发生时间">
          {{ formatShanghaiTime(operation.occurred_at) }}
        </n-descriptions-item>
        <n-descriptions-item label="用途" :span="2">
          {{ operation.business_reason || '—' }}
        </n-descriptions-item>
        <n-descriptions-item v-if="operation.operation_type === 'OUTBOUND'" label="领用单位">
          {{ operation.receiver_unit || '—' }}
        </n-descriptions-item>
        <n-descriptions-item v-if="operation.operation_type === 'OUTBOUND'" label="领用人">
          {{ operation.receiver_name || '—' }}
        </n-descriptions-item>
        <n-descriptions-item v-if="operation.operation_type === 'OUTBOUND'" label="子项号">
          {{ operation.subitem_no || '—' }}
        </n-descriptions-item>
        <n-descriptions-item label="请求幂等 ID" :span="2">
          {{ operation.client_request_id }}
        </n-descriptions-item>
      </n-descriptions>

      <n-divider title-placement="left">物资明细</n-divider>
      <OperationLinesEditor v-if="editing" v-model:lines="edit.lines" :type="edit.operation_type" />
      <div v-else class="table-scroll" style="--table-min-width: 1000px">
        <n-table :bordered="false">
          <thead>
            <tr>
              <th>物资</th>
              <th>型号规格</th>
              <th>数量</th>
              <th>剩余可冲</th>
              <th>操作前</th>
              <th>操作后</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(line, index) in operation.lines" :key="line.id || index">
              <td>{{ line.material_name }}</td>
              <td>{{ line.model_spec }}</td>
              <td>{{ line.quantity }} {{ line.unit_name }}</td>
              <td>
                <n-tag
                  v-if="compareDecimal(line.remaining_qty, '0') <= 0"
                  type="success"
                  size="small"
                >
                  已冲销
                </n-tag>
                <span v-else>{{ line.remaining_qty }} {{ line.unit_name }}</span>
              </td>
              <td>{{ line.before_qty }}</td>
              <td>{{ line.after_qty }}</td>
            </tr>
          </tbody>
        </n-table>
      </div>
    </template>
    <template #footer>
      <n-space justify="space-between" align="center">
        <n-space v-if="canWrite && operation" justify="start">
          <n-button secondary :disabled="!canReverse" @click="showReverse = true">
            反向冲销
          </n-button>
          <n-button
            :type="editing ? 'default' : 'primary'"
            @click="editing ? cancelEdit() : startEdit()"
          >
            {{ editing ? '取消编辑' : '编辑流水' }}
          </n-button>
        </n-space>
        <span v-else></span>
        <n-space justify="end">
          <n-button v-if="editing" @click="cancelEdit">取消</n-button>
          <n-button v-if="editing" type="primary" :loading="saving" @click="confirmSave">
            保存修改
          </n-button>
          <n-button v-else @click="requestClose">关闭</n-button>
        </n-space>
      </n-space>
    </template>
  </n-modal>

  <ReverseOperationDialog
    v-model:show="showReverse"
    :operation="operation"
    @reversed="onReversed"
  />
</template>

<style scoped>
.operation-hero {
  border: 1px solid var(--color-primary-border);
  background: var(--color-hero);
  box-shadow: 0 14px 34px var(--shadow-hero);
}

.operation-hero-layout {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 32px;
}

.operation-hero-main {
  min-width: 0;
}

.operation-eyebrow {
  color: var(--color-primary-hover);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.14em;
}

.operation-title-row {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-top: 8px;
}

.operation-no {
  color: var(--color-text-strong);
  font-size: clamp(18px, 2vw, 24px);
  font-weight: 600;
  line-height: 1.25;
}

.operation-meta-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-top: 16px;
  color: var(--color-text-muted);
  font-size: 13px;
}

.operation-meta-row strong {
  color: var(--color-text);
  font-weight: 600;
}

.operation-meta-divider {
  width: 1px;
  height: 14px;
  margin: 0 4px;
  background: var(--color-border);
}

.operation-line-count {
  flex: none;
  min-width: 132px;
  padding: 18px 24px;
  border: 1px solid var(--color-primary-border);
  border-radius: 16px;
  background: var(--color-surface-translucent);
  text-align: center;
}

.operation-line-count > span {
  color: var(--color-text-muted);
  font-size: 13px;
}

.operation-line-count div {
  margin-top: 4px;
  color: var(--color-primary-strong-text);
}

.operation-line-count strong {
  font-size: 30px;
  line-height: 1;
}

.operation-line-count small {
  margin-left: 4px;
  font-size: 13px;
}

@media (max-width: 720px) {
  .operation-hero-layout {
    align-items: stretch;
    flex-direction: column;
  }

  .operation-line-count {
    min-width: 0;
    text-align: left;
  }
}
</style>
