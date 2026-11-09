<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useDialog, useMessage } from 'naive-ui'
import { useRouter } from 'vue-router'
import type { FileObject, PurchaseRecord, PurchaseRecordWrite } from '@/api/generated'
import { procurementApi } from '@/api/procurement'
import ImageUploader from '@/components/ImageUploader.vue'
import MaterialSelector from '@/components/MaterialSelector.vue'
import QuantityInput from '@/components/QuantityInput.vue'
import { purchaseCategoryOptions } from '@/constants/purchase'
import { useMaskCloseGuard } from '@/composables/useMaskCloseGuard'
import { useAuthStore } from '@/stores/auth'
import { dateToTimestamp, formatShanghaiTime, toShanghaiDate } from '@/utils/time'

const props = defineProps<{
  show: boolean
  record: PurchaseRecord | null
}>()
const emit = defineEmits<{
  'update:show': [value: boolean]
  saved: []
  restored: [planId: number]
  reapplyCreated: [planId: number]
}>()

const router = useRouter()
const auth = useAuthStore()
const message = useMessage()
const dialog = useDialog()
const canWrite = computed(() => auth.can('purchase:write'))

const editing = ref<PurchaseRecord | null>(null)
const editSaving = ref(false)
const editAdvancedSections = ref<string[]>([])
const editPlanDate = ref<number | null>(null)
const editPurchaseDate = ref<number | null>(null)
const editConsolidationDate = ref<number | null>(null)
const editSailingDate = ref<number | null>(null)
const editContractSignDate = ref<number | null>(null)
// 单价（元）：与日期字段同法用独立 ref，避免 n-input-number 的 number 与表单字符串模型互相污染。
const editUnitPrice = ref<number | null>(null)
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
const editBaseline = ref('')

const showModel = computed({
  get: () => props.show,
  set: (value: boolean) => emit('update:show', value),
})

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
  // 空单价（null/undefined/''）保持空输入框；只有真实数值才回填。
  const unitPrice = value.unit_price ? Number(value.unit_price) : null
  editUnitPrice.value = unitPrice !== null && Number.isFinite(unitPrice) ? unitPrice : null
  editImages.value = [...value.images]
}

/**
 * 未保存修改的脏判定：与打开时的快照比对（`watch(deep)` 会被 `syncEditForm` 回填的
 * 刷新时序误判成用户改动）。
 */
function editSnapshot(): string {
  return JSON.stringify({
    form: { ...editForm },
    plan_date: editPlanDate.value,
    purchase_date: editPurchaseDate.value,
    consolidation_date: editConsolidationDate.value,
    sailing_date: editSailingDate.value,
    contract_sign_date: editContractSignDate.value,
    unit_price: editUnitPrice.value,
    image_ids: editImages.value.map((image) => image.id),
  })
}

function isEditDirty(): boolean {
  return editBaseline.value !== '' && editSnapshot() !== editBaseline.value
}

function openRecord(value: PurchaseRecord) {
  editing.value = value
  syncEditForm(value)
  editAdvancedSections.value = []
  editBaseline.value = editSnapshot()
}

function resetState() {
  editing.value = null
  editBaseline.value = ''
  showReapply.value = false
}

watch(
  () => [props.show, props.record] as const,
  ([show, record]) => {
    if (show && record) openRecord(record)
    if (!show) resetState()
  },
  { immediate: true },
)

function closeModal() {
  showModel.value = false
}

const { requestClose } = useMaskCloseGuard({
  isDirty: () => isEditDirty(),
  close: () => closeModal(),
})

/** `@close` 必须返回 false，否则 naive-ui 自己会把 show 置 false，拦不住「继续编辑」。 */
function handleCloseClick(): false {
  requestClose()
  return false
}

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
    emit('restored', plan.id)
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
    emit('reapplyCreated', created.id)
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
      // 单价可留空：留空即清空该字段（后端 PATCH 是全量覆盖）。
      unit_price: editUnitPrice.value === null ? null : editUnitPrice.value.toFixed(2),
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
    emit('saved')
    closeModal()
  } catch (error) {
    message.error(error instanceof Error ? error.message : '保存失败')
  } finally {
    editSaving.value = false
  }
}
</script>

<template>
  <n-modal
    v-model:show="showModel"
    preset="card"
    draggable
    data-detail-modal
    title="申购记录详情"
    style="width: 760px; max-width: calc(100vw - 32px)"
    :mask-closable="false"
    :close-on-esc="false"
    @mask-click="requestClose"
    @esc="requestClose"
    @close="handleCloseClick"
  >
    <!-- 最后更新时间放标题右侧：不占页脚空间，也不与左侧的操作按钮挤在一行 -->
    <template v-if="editing?.updated_at" #header-extra>
      <span class="card-header-time">{{ formatShanghaiTime(editing.updated_at) }}</span>
    </template>
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
            <n-input v-model:value="editForm.status" maxlength="128" placeholder="可填写任意状态" />
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
                <n-input v-model:value="editForm.vessel_no" maxlength="128" placeholder="可留空" />
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
              <n-form-item label="单价">
                <n-input-number
                  v-model:value="editUnitPrice"
                  class="full-width"
                  :min="0"
                  :precision="2"
                  placeholder="留空表示未填写"
                  :disabled="!canWrite"
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
          <n-button type="primary" secondary class="open-new-page-btn" @click="openRecordInNewPage">
            在新页面打开
          </n-button>
        </n-space>
        <span v-else></span>
        <n-space justify="end">
          <n-button @click="requestClose">取消</n-button>
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
            <n-input v-model:value="reapplyForm.material_code" maxlength="64" placeholder="留空" />
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
</template>

<style scoped>
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
