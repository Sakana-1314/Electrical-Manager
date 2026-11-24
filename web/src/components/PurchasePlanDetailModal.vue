<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { useDialog, useMessage, type FormInst, type FormRules } from 'naive-ui'
import { useRouter } from 'vue-router'
import type {
  FileObject,
  MaterialCodeLibrary,
  PurchaseMaterial,
  PurchaseMaterialWrite,
  PurchaseRecord,
} from '@/api/generated'
import { procurementApi } from '@/api/procurement'
import ImageUploader from '@/components/ImageUploader.vue'
import MaterialCodeSelector from '@/components/MaterialCodeSelector.vue'
import MaterialSelector from '@/components/MaterialSelector.vue'
import PurchaseRecordHistoryDialog from '@/components/PurchaseRecordHistoryDialog.vue'
import QuantityInput from '@/components/QuantityInput.vue'
import {
  defaultDemandDepartment,
  defaultPurchasePlanStatus,
  defaultPurchaseUrgency,
  purchaseCategoryOptions,
  purchasePlanStatusOptions,
  purchaseUrgencyOptions,
} from '@/constants/purchase'
import { useMaskCloseGuard } from '@/composables/useMaskCloseGuard'
import { useAuthStore } from '@/stores/auth'
import {
  defaultPurchaseOrderNo,
  getLastPurchaseResponsible,
  rememberPurchaseResponsible,
} from '@/utils/purchase'
import { dateToTimestamp, formatShanghaiTime, toShanghaiDate } from '@/utils/time'
import PinyinSelect from '@/components/PinyinSelect.vue'

const props = defineProps<{
  show: boolean
  /** 要查看/编辑的计划；传 `null` 表示新建。 */
  plan: PurchaseMaterial | null
  /** 列表筛选选项里出现的额外类别（与内置类别合并后作为下拉选项）。 */
  categories?: string[]
}>()
const emit = defineEmits<{
  'update:show': [value: boolean]
  /** 保存成功（`created` 为 true 表示是新建）。 */
  saved: [created: boolean]
  deleted: []
  /** 已转入申购记录，带回新记录的行 id。 */
  moved: [recordLineId: number]
}>()

const router = useRouter()
const auth = useAuthStore()
const message = useMessage()
const dialog = useDialog()
const canWrite = computed(() => auth.can('purchase:write'))
const categoryOptions = computed(() => {
  const values = new Set([
    ...purchaseCategoryOptions.map((option) => option.value),
    ...(props.categories ?? []),
  ])
  return [...values].map((value) => ({ label: value, value }))
})

const showModel = computed({
  get: () => props.show,
  set: (value: boolean) => emit('update:show', value),
})

const editing = ref<PurchaseMaterial | null>(null)
const formRef = ref<FormInst | null>(null)
const saving = ref(false)
const deleting = ref(false)
const showHistory = ref(false)
const images = ref<FileObject[]>([])
/** 图片附件是否还有在途上传：有则禁用保存，避免 `image_ids` 漏掉还没传完的图。 */
const imagesUploading = ref(false)
// 打开新建/编辑时由 resetCreateForm（默认今天）/syncEditForm（取记录值）赋值，避免组件挂载即固定日期。
const createPlanDate = ref<number | null>(null)
/**
 * 详情弹窗内的字段分组：字段多、一屏铺开会显拥挤，按业务域拆成 3 个 tab。
 * 保存校验失败时自动切到缺必填项的 tab（见 `firstIncompleteDetailTab`），
 * 否则隐藏 tab 上的报错用户看不到。
 */
type PlanDetailTab = 'material' | 'info' | 'notes'
const detailTab = ref<PlanDetailTab>('material')
const form = reactive<PurchaseMaterialWrite>({
  status: defaultPurchasePlanStatus,
  material_code: '',
  category: '',
  urgency: defaultPurchaseUrgency,
  demand_department: defaultDemandDepartment,
  name: '',
  model_spec: '',
  unit_name: '',
  actual_demand_person: '',
  purchase_responsible: '',
  planned_qty: '',
  usage: '',
  subitem_no: '',
  stock_material_id: undefined,
  remark: '',
  image_ids: [],
})
const rules: FormRules = {
  name: { required: true, message: '请输入名称' },
  model_spec: { required: true, message: '请输入型号规格' },
  actual_demand_person: { required: true, message: '请输入提报员工' },
  purchase_responsible: { required: true, message: '请输入实际需求人' },
  planned_qty: [
    { required: true, message: '请输入计划数量' },
    {
      validator: () => Boolean(form.unit_name.trim()),
      message: '请输入计量单位',
      trigger: ['blur', 'change'],
    },
  ],
  usage: { required: true, message: '请输入用途' },
}

// 物料编码软校验：编码已存在于编码库时提示“已收录”，否则仅提示未收录，不阻断保存。
const materialCodeKnown = ref<boolean | null>(null)
let materialCodeCheckTimer: ReturnType<typeof setTimeout> | null = null
watch(
  () => form.material_code,
  (value) => {
    if (materialCodeCheckTimer) clearTimeout(materialCodeCheckTimer)
    if (!props.show) {
      materialCodeKnown.value = null
      return
    }
    const code = value?.trim() ?? ''
    if (!code) {
      materialCodeKnown.value = null
      return
    }
    materialCodeCheckTimer = setTimeout(async () => {
      try {
        const result = await procurementApi.materialCodeExists(code)
        materialCodeKnown.value = result.exists
      } catch {
        materialCodeKnown.value = null
      }
    }, 400)
  },
)
onBeforeUnmount(() => {
  if (materialCodeCheckTimer) clearTimeout(materialCodeCheckTimer)
})

/**
 * 未保存修改的脏判定：与打开时的快照比对。用快照而不是 `watch(deep)`，
 * 避免回填表单时被 watcher 的刷新时序误判成用户改动。
 */
const editBaseline = ref('')
function editSnapshot(): string {
  return JSON.stringify({
    form: { ...form },
    plan_date: createPlanDate.value,
    image_ids: images.value.map((image) => image.id),
  })
}
function isEditDirty(): boolean {
  return editBaseline.value !== '' && editSnapshot() !== editBaseline.value
}

function syncEditForm(row: PurchaseMaterial) {
  editing.value = row
  Object.assign(form, {
    status: row.status,
    material_code: row.material_code || '',
    category: row.category || '',
    urgency: row.urgency,
    demand_department: row.demand_department,
    name: row.name,
    model_spec: row.model_spec,
    unit_name: row.unit_name,
    actual_demand_person: row.actual_demand_person,
    purchase_responsible: row.purchase_responsible,
    planned_qty: row.planned_qty,
    usage: row.usage,
    subitem_no: row.subitem_no || '',
    stock_material_id: row.stock_material_id,
    remark: row.remark || '',
    image_ids: row.images.map((image) => image.id),
    version: row.version,
  })
  images.value = [...row.images]
  createPlanDate.value = dateToTimestamp(row.plan_date)
  // 每次打开都回到第一个 tab：上次停在「备注与附件」不该让这次也先看到它
  detailTab.value = 'material'
  editBaseline.value = editSnapshot()
}

function resetCreateForm() {
  editing.value = null
  Object.assign(form, {
    status: defaultPurchasePlanStatus,
    material_code: '',
    category: '',
    urgency: defaultPurchaseUrgency,
    demand_department: defaultDemandDepartment,
    name: '',
    model_spec: '',
    unit_name: '',
    actual_demand_person: '',
    purchase_responsible: getLastPurchaseResponsible(),
    planned_qty: '',
    usage: '',
    subitem_no: '',
    stock_material_id: undefined,
    remark: '',
    image_ids: [],
    version: undefined,
  })
  images.value = []
  createPlanDate.value = Date.now()
  // 新建从第一个 tab 开始填
  detailTab.value = 'material'
  // 新建也要刷新脏基准：否则会拿上一条计划的基准去比，刚打开就判成「有未保存修改」
  editBaseline.value = editSnapshot()
}

// 打开方式只由 props 决定：`plan` 有值即查看/编辑详情，`null` 即新建。
watch(
  () => [props.show, props.plan] as const,
  ([show, plan]) => {
    if (!show) return
    if (plan) syncEditForm(plan)
    else resetCreateForm()
  },
  { immediate: true },
)

function closeDetail() {
  showModel.value = false
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

function applyMaterialCode(item: MaterialCodeLibrary) {
  form.material_code = item.material_code
  if (item.name?.trim()) form.name = item.name
  if (item.model_spec?.trim()) form.model_spec = item.model_spec
  form.unit_name = item.unit_name
}

/** 缺必填项时返回所在 tab（含提示文案）：保存前先切过去，避免报错藏在别的 tab 里看不见。 */
function firstIncompleteDetailTab(): { tab: PlanDetailTab; message: string } | null {
  if (
    !form.name.trim() ||
    !form.model_spec.trim() ||
    !form.planned_qty ||
    !form.unit_name.trim() ||
    !form.usage.trim()
  ) {
    return {
      tab: 'material',
      message: '请完整填写物资信息：名称、型号规格、计划数量、计量单位、用途',
    }
  }
  if (!(form.actual_demand_person ?? '').trim() || !(form.purchase_responsible ?? '').trim()) {
    return { tab: 'info', message: '请完整填写申购信息：需求日期、提报员工、实际需求人' }
  }
  return null
}

async function save() {
  const planDate = createPlanDate.value
  if (!planDate) {
    detailTab.value = 'info'
    message.error('请选择需求日期')
    return
  }
  const incomplete = firstIncompleteDetailTab()
  if (incomplete) {
    detailTab.value = incomplete.tab
    message.error(incomplete.message)
    return
  }
  // 必填项已逐 tab 检查过；保留表单校验兜住规则变化（如数量格式），内联报错仍可见
  try {
    await formRef.value?.validate()
  } catch {
    return
  }
  saving.value = true
  try {
    form.image_ids = images.value.map((x) => x.id)
    const payload = {
      ...form,
      plan_date: toShanghaiDate(planDate),
      subitem_no: form.subitem_no?.trim() || undefined,
    }
    const created = !editing.value
    if (editing.value) {
      await procurementApi.updateMaterial(editing.value.id, payload)
      message.success('申购计划已保存')
    } else {
      await procurementApi.createMaterial(payload)
      rememberPurchaseResponsible(form.purchase_responsible || '')
      message.success('申购计划已创建')
    }
    closeDetail()
    emit('saved', created)
  } catch (e) {
    message.error(e instanceof Error ? e.message : '保存失败')
  } finally {
    saving.value = false
  }
}

function openInNewPage() {
  const target = editing.value
  if (!target) return
  // 详情页已移除：新标签页打开列表页并由 ?detail= 自动弹开同一条计划的详情弹窗
  const href = router.resolve({
    name: 'purchase-materials',
    query: { detail: String(target.id) },
  }).href
  window.open(href, '_blank')
}

async function deletePlan() {
  const target = editing.value
  if (!target) return
  deleting.value = true
  try {
    await procurementApi.deleteMaterial(target.id, target.version)
    message.success('申购计划已删除')
    closeDetail()
    emit('deleted')
  } catch (error) {
    message.error(error instanceof Error ? error.message : '删除失败')
  } finally {
    deleting.value = false
  }
}

function confirmDelete() {
  const target = editing.value
  if (!target) return
  if (target.moved_to_record) {
    message.warning('已转入申购记录的计划不能删除')
    return
  }
  dialog.warning({
    draggable: true,
    title: '删除申购计划',
    content: `确认删除“${target.name}”的这条申购计划吗？删除后不可恢复。`,
    positiveText: '确认删除',
    negativeText: '取消',
    onPositiveClick: deletePlan,
  })
}

/** 单条「转入申购记录」（计划必须已有物料编码，且尚未转入）。 */
const showMove = ref(false)
const moving = ref(false)
const moveForm = reactive({
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

function openMove() {
  const target = editing.value
  if (!target) return
  if (!target.material_code) {
    message.warning('该计划还没有物料编码，请先补充后再转入申购记录')
    return
  }
  Object.assign(moveForm, {
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
  showMove.value = true
}

async function moveToRecord() {
  const target = editing.value
  if (!target || !moveForm.purchase_date) {
    message.error('请选择申购日期')
    return
  }
  moving.value = true
  try {
    const record = await procurementApi.movePlanToRecord(target.id, {
      purchase_order_no: moveForm.purchase_order_no.trim() || null,
      trace_no: moveForm.trace_no.trim() || null,
      contract_no: moveForm.contract_no.trim() || null,
      vessel_no: moveForm.vessel_no.trim() || null,
      consolidation_date: moveForm.consolidation_date
        ? toShanghaiDate(moveForm.consolidation_date)
        : undefined,
      consolidation_port: moveForm.consolidation_port.trim() || null,
      sailing_date: moveForm.sailing_date ? toShanghaiDate(moveForm.sailing_date) : undefined,
      contract_sign_date: moveForm.contract_sign_date
        ? toShanghaiDate(moveForm.contract_sign_date)
        : undefined,
      purchase_date: toShanghaiDate(moveForm.purchase_date),
      salesperson: moveForm.salesperson.trim() || undefined,
      status: moveForm.status.trim(),
      record_remark: moveForm.record_remark.trim() || undefined,
    })
    message.success('已转入申购记录')
    showMove.value = false
    closeDetail()
    emit('moved', record.line_id)
  } catch (error) {
    message.error(error instanceof Error ? error.message : '转入失败')
  } finally {
    moving.value = false
  }
}

/** 历史申购记录点某条：跳到申购记录列表并复用其详情弹窗（本弹窗没有记录详情）。 */
function openHistoryRecord(record: PurchaseRecord) {
  void router.push({ name: 'purchase-records', query: { detail: String(record.line_id) } })
}
</script>

<template>
  <n-modal
    v-model:show="showModel"
    preset="card"
    draggable
    data-detail-modal
    :title="editing ? '申购计划详情' : '新建申购计划'"
    style="width: min(680px, calc(100vw - 24px))"
    :mask-closable="false"
    :close-on-esc="false"
    @mask-click="requestCloseDetail"
    @esc="requestCloseDetail"
    @close="handleCloseClick"
  >
    <!-- 最后更新时间放标题右侧：不占页脚空间，也不与左侧的操作按钮挤在一行 -->
    <template v-if="editing?.updated_at" #header-extra>
      <span class="card-header-time">{{ formatShanghaiTime(editing.updated_at) }}</span>
    </template>
    <n-form
      ref="formRef"
      :model="form"
      :rules="rules"
      label-placement="top"
      size="small"
      :disabled="!canWrite"
    >
      <!-- 字段按业务域分 tab：一屏铺开会显拥挤；display-directive="show" 让未激活的
             tab 也保持挂载，切回来时输入内容 / 上传进度不会丢，表单校验也能覆盖全部字段 -->
      <n-tabs
        v-model:value="detailTab"
        type="line"
        size="small"
        display-directive="show"
        class="detail-form-tabs"
      >
        <n-tab-pane name="material" tab="物资信息">
          <div class="form-grid">
            <n-form-item label="物料编码">
              <div class="material-code-field">
                <MaterialCodeSelector
                  :model-value="form.material_code || ''"
                  :default-name="form.name"
                  :default-model-spec="form.model_spec"
                  :disabled="!canWrite"
                  @update:model-value="form.material_code = $event"
                  @select="applyMaterialCode"
                />
                <n-tag
                  v-if="materialCodeKnown === true"
                  type="success"
                  :bordered="false"
                  size="small"
                >
                  已在编码库
                </n-tag>
                <n-tag
                  v-else-if="materialCodeKnown === false"
                  type="warning"
                  :bordered="false"
                  size="small"
                >
                  编码未收录
                </n-tag>
              </div>
            </n-form-item>
            <n-form-item label="名称" path="name">
              <n-input v-model:value="form.name" maxlength="128">
                <template #suffix>
                  <n-button text type="primary" size="tiny" @click="showHistory = true"
                    >查历史</n-button
                  >
                </template>
              </n-input>
            </n-form-item>
            <n-form-item label="型号规格" path="model_spec">
              <n-input v-model:value="form.model_spec" maxlength="255" />
            </n-form-item>
            <n-form-item label="计划数量 / 计量单位" path="planned_qty">
              <n-input-group>
                <QuantityInput
                  v-model:value="form.planned_qty"
                  :decimal-places="1"
                  :disabled="!canWrite"
                  class="quantity-input"
                />
                <n-input
                  v-model:value="form.unit_name"
                  maxlength="32"
                  placeholder="计量单位"
                  class="quantity-unit-select"
                />
              </n-input-group>
            </n-form-item>
            <!-- 用途与子项号成对占一行（两列网格里相邻即同排） -->
            <n-form-item label="用途" path="usage">
              <n-input v-model:value="form.usage" maxlength="500" />
            </n-form-item>
            <n-form-item label="子项号">
              <n-input v-model:value="form.subitem_no" maxlength="64" placeholder="选填" />
            </n-form-item>
            <n-form-item label="类别">
              <pinyin-select
                v-model:value="form.category"
                :options="categoryOptions"
                filterable
                clearable
                placeholder="选择类别"
              />
            </n-form-item>
          </div>
        </n-tab-pane>
        <n-tab-pane name="info" tab="申购信息">
          <div class="form-grid">
            <n-form-item label="需求日期" required>
              <n-date-picker v-model:value="createPlanDate" type="date" class="full-width" />
            </n-form-item>
            <n-form-item label="紧急程度">
              <n-select v-model:value="form.urgency" :options="purchaseUrgencyOptions" />
            </n-form-item>
            <n-form-item label="状态" required>
              <n-select v-model:value="form.status" :options="purchasePlanStatusOptions" />
            </n-form-item>
            <n-form-item label="提报员工" path="actual_demand_person">
              <n-input
                v-model:value="form.actual_demand_person"
                maxlength="128"
                placeholder="填写提出需求的员工"
              />
            </n-form-item>
            <n-form-item label="实际需求人" path="purchase_responsible">
              <n-input
                v-model:value="form.purchase_responsible"
                maxlength="128"
                placeholder="填写作为实际需求人的车间负责人"
              />
            </n-form-item>
            <n-form-item label="需求部门">
              <n-input v-model:value="form.demand_department" maxlength="128" />
            </n-form-item>
            <n-form-item label="关联二级库物资">
              <MaterialSelector
                :value="form.stock_material_id ?? null"
                :disabled="!canWrite"
                @update:value="form.stock_material_id = $event ?? undefined"
              />
            </n-form-item>
          </div>
        </n-tab-pane>
        <n-tab-pane name="notes" tab="备注与附件">
          <n-form-item label="备注">
            <n-input v-model:value="form.remark" type="textarea" maxlength="1000" show-count />
          </n-form-item>
          <n-form-item label="图片附件">
            <ImageUploader
              v-model:files="images"
              v-model:busy="imagesUploading"
              :disabled="!canWrite"
            />
          </n-form-item>
        </n-tab-pane>
      </n-tabs>
    </n-form>
    <template #footer>
      <n-space justify="space-between"
        ><template v-if="editing"
          ><n-space justify="start" align="center"
            ><n-button
              v-if="canWrite"
              type="error"
              ghost
              :loading="deleting"
              :disabled="editing.moved_to_record"
              @click="confirmDelete"
              >删除</n-button
            ><n-button
              v-if="canWrite && editing.material_code && !editing.moved_to_record"
              type="primary"
              secondary
              @click="openMove"
              >转入申购记录</n-button
            ><n-button type="primary" secondary class="open-new-page-btn" @click="openInNewPage"
              >在新页面打开</n-button
            ></n-space
          ></template
        ><span v-else></span
        ><n-space justify="end"
          ><n-button @click="requestCloseDetail">取消</n-button
          ><n-button
            v-if="canWrite"
            type="primary"
            :loading="saving"
            :disabled="imagesUploading"
            @click="save"
            >保存</n-button
          ></n-space
        ></n-space
      ></template
    ></n-modal
  >
  <n-modal
    v-model:show="showMove"
    preset="card"
    draggable
    title="转入申购记录"
    style="width: min(560px, calc(100vw - 24px))"
    :mask-closable="false"
  >
    <n-alert type="info"> 计划信息将带入申购记录，转入后仍可继续修改和整理。 </n-alert>
    <n-form label-placement="top" size="small" :show-feedback="false">
      <div class="form-grid">
        <n-form-item label="申购单号">
          <n-input
            v-model:value="moveForm.purchase_order_no"
            maxlength="128"
            placeholder="可留空"
          />
        </n-form-item>
        <n-form-item label="追溯号">
          <n-input v-model:value="moveForm.trace_no" maxlength="128" placeholder="可留空" />
        </n-form-item>
        <n-form-item label="合同号">
          <n-input v-model:value="moveForm.contract_no" maxlength="128" placeholder="可留空" />
        </n-form-item>
        <n-form-item label="船号">
          <n-input v-model:value="moveForm.vessel_no" maxlength="128" placeholder="可留空" />
        </n-form-item>
        <n-form-item label="集港日期">
          <n-date-picker
            v-model:value="moveForm.consolidation_date"
            type="date"
            class="full-width"
            clearable
          />
        </n-form-item>
        <n-form-item label="集港港口">
          <n-input
            v-model:value="moveForm.consolidation_port"
            maxlength="128"
            placeholder="可留空"
          />
        </n-form-item>
        <n-form-item label="发船日期">
          <n-date-picker
            v-model:value="moveForm.sailing_date"
            type="date"
            class="full-width"
            clearable
          />
        </n-form-item>
        <n-form-item label="合同签订日期">
          <n-date-picker
            v-model:value="moveForm.contract_sign_date"
            type="date"
            class="full-width"
            clearable
          />
        </n-form-item>
        <n-form-item label="申购日期" required>
          <n-date-picker v-model:value="moveForm.purchase_date" type="date" class="full-width" />
        </n-form-item>
        <n-form-item label="业务员">
          <n-input v-model:value="moveForm.salesperson" maxlength="128" />
        </n-form-item>
        <n-form-item label="状态" required>
          <n-input v-model:value="moveForm.status" maxlength="128" />
        </n-form-item>
      </div>
      <n-form-item label="记录备注">
        <n-input
          v-model:value="moveForm.record_remark"
          type="textarea"
          maxlength="1000"
          show-count
        />
      </n-form-item>
    </n-form>
    <template #footer>
      <n-space justify="end">
        <n-button @click="showMove = false">取消</n-button>
        <n-button type="primary" :loading="moving" @click="moveToRecord">确认转入</n-button>
      </n-space>
    </template>
  </n-modal>
  <PurchaseRecordHistoryDialog
    v-model:show="showHistory"
    :initial-name="form.name"
    @select="openHistoryRecord"
  />
</template>

<style scoped>
.material-code-field {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
}

.material-code-field :deep(.n-input) {
  flex: 1;
}

.material-code-field :deep(.n-tag) {
  flex-shrink: 0;
}

.quantity-input {
  flex: 1;
}

.quantity-unit-select {
  width: var(--control-width-unit);
}

.open-new-page-btn {
  align-self: center;
}
</style>
