<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router'
import { useDialog, useMessage } from 'naive-ui'
import OperationLinesEditor, {
  type OperationLineModel,
} from '@/components/OperationLinesEditor.vue'
import { inventoryApi } from '@/api/inventory'
import { isDecimalString } from '@/utils/decimal'
import { toIsoWithTimezone } from '@/utils/time'
import { invalidateStockMaterialCache } from '@/utils/stockMaterialCache'

const props = defineProps<{ operationType: 'INBOUND' | 'OUTBOUND' }>()
const route = useRoute()
const router = useRouter()
const message = useMessage()
const dialog = useDialog()
const submitting = ref(false)
const occurredAt = ref(Date.now())
const requestId = ref<string | null>(null)
const model = reactive({
  business_reason: '',
  receiver_unit: '',
  receiver_name: '',
  subitem_no: '',
  source_type: 'MANUAL' as 'MANUAL' | 'INITIALIZATION',
  lines: [{ stock_material_id: null, quantity: '' }] as OperationLineModel[],
})
const title = computed(() => (props.operationType === 'INBOUND' ? '办理入库' : '办理出库'))
/** 已提交成功：离开页面不再拦截 */
const submitted = ref(false)
/** 填过任何内容（物资、数量、用途、领用信息）即视为有草稿，离开前需要确认 */
const dirty = computed(
  () =>
    !submitted.value &&
    (model.lines.some((x) => x.stock_material_id || x.quantity) ||
      !!model.business_reason.trim() ||
      !!model.receiver_unit.trim() ||
      !!model.receiver_name.trim() ||
      !!model.subitem_no.trim()),
)
// 幂等键跟着「这一份表单内容」走：内容不变时重复提交（含超时后重试）沿用同一个键，
// 服务端按键返回原单据、不会重复记账；内容一改就是新的一次提交，换新键。
// 不能在出错时清空：超时的请求可能已经落库，换新键重试会生成两张流水。
watch(
  [model, occurredAt],
  () => {
    requestId.value = null
  },
  { deep: true },
)
function validate(): string | null {
  if (props.operationType === 'OUTBOUND' && !model.business_reason.trim()) return '请填写用途'
  if (props.operationType === 'OUTBOUND' && !model.receiver_name.trim()) return '请填写领用人'
  if (
    !model.lines.length ||
    model.lines.some((x) => !x.stock_material_id || !isDecimalString(x.quantity, 1))
  )
    return '请完整填写物资和有效数量'
  return null
}
async function submit() {
  requestId.value ||= crypto.randomUUID()
  try {
    const payload = {
      client_request_id: requestId.value,
      occurred_at: toIsoWithTimezone(occurredAt.value),
      source_type: model.source_type,
      business_reason: model.business_reason.trim(),
      receiver_unit: model.receiver_unit.trim() || undefined,
      receiver_name: model.receiver_name.trim() || undefined,
      subitem_no: model.subitem_no.trim() || undefined,
      lines: model.lines.map((x) => ({
        stock_material_id: x.stock_material_id!,
        quantity: x.quantity,
      })),
    }
    const result =
      props.operationType === 'INBOUND'
        ? await inventoryApi.inbound(payload)
        : await inventoryApi.outbound(payload)
    submitted.value = true
    invalidateStockMaterialCache()
    message.success(`${title.value}成功：${result.operation_no}`)
    // 流水详情已改为弹窗：跳到操作记录列表并由 ?detail= 打开这条流水
    await router.replace({ name: 'operations', query: { detail: String(result.id) } })
  } catch (e) {
    message.error(e instanceof Error ? e.message : '提交失败')
  } finally {
    submitting.value = false
  }
}
function confirmSubmit() {
  if (submitting.value) return
  const error = validate()
  if (error) {
    message.error(error)
    return
  }
  submitting.value = true
  dialog.warning({
    draggable: true,
    title: `确认${props.operationType === 'INBOUND' ? '入库' : '出库'}`,
    content: `将为 ${model.lines.length} 项物资生成库存流水，确认继续？`,
    positiveText: '确认提交',
    negativeText: '取消',
    maskClosable: false,
    closable: false,
    onPositiveClick: submit,
    onNegativeClick: () => {
      submitting.value = false
    },
  })
}
// 侧栏切页 / 返回时有未提交的草稿：先确认，避免误触丢掉一整单明细
onBeforeRouteLeave(() => {
  if (!dirty.value) return true
  return new Promise<boolean>((resolve) => {
    dialog.warning({
      title: '放弃未提交的单据？',
      content: `当前${props.operationType === 'INBOUND' ? '入库' : '出库'}单还没有提交，离开后填写的内容不会保留。`,
      positiveText: '放弃并离开',
      negativeText: '继续填写',
      onPositiveClick: () => resolve(true),
      onNegativeClick: () => resolve(false),
      onClose: () => resolve(false),
      onMaskClick: () => resolve(false),
    })
  })
})
function onBeforeUnload(event: BeforeUnloadEvent) {
  if (!dirty.value) return
  event.preventDefault()
  event.returnValue = ''
}
window.addEventListener('beforeunload', onBeforeUnload)
onBeforeUnmount(() => window.removeEventListener('beforeunload', onBeforeUnload))
onMounted(async () => {
  const id = Number(route.query.material_id)
  if (id) {
    const material = await inventoryApi.material(id)
    model.lines = [
      {
        stock_material_id: id,
        quantity: String(route.query.quantity || ''),
        material,
      },
    ]
  }
})
</script>

<template>
  <div class="page">
    <div class="page-header">
      <div>
        <h1 class="page-title">{{ title }}</h1>
      </div>
    </div>
    <n-card title="业务信息"
      ><n-form label-placement="top"
        ><div class="form-grid">
          <n-form-item label="发生时间" required
            ><n-date-picker
              v-model:value="occurredAt"
              type="datetime"
              clearable
              class="full-width" /></n-form-item
          ><n-form-item v-if="operationType === 'INBOUND'" label="来源类型"
            ><n-select
              v-model:value="model.source_type"
              :options="[
                { label: '手工入库', value: 'MANUAL' },
                { label: '初始化入库', value: 'INITIALIZATION' },
              ]" /></n-form-item
          ><n-form-item v-if="operationType === 'OUTBOUND'" label="领用单位"
            ><n-input v-model:value="model.receiver_unit" maxlength="128" /></n-form-item
          ><n-form-item v-if="operationType === 'OUTBOUND'" label="领用人" required
            ><n-input v-model:value="model.receiver_name" maxlength="64" /></n-form-item
          ><n-form-item v-if="operationType === 'OUTBOUND'" label="子项号"
            ><n-input v-model:value="model.subitem_no" maxlength="64"
          /></n-form-item>
        </div>
        <n-form-item label="用途" :required="operationType === 'OUTBOUND'"
          ><n-input
            v-model:value="model.business_reason"
            maxlength="500"
            show-count /></n-form-item></n-form
    ></n-card>
    <n-card title="物资明细"
      ><OperationLinesEditor v-model:lines="model.lines" :type="operationType"
    /></n-card>
    <n-space justify="end"
      ><n-button @click="router.back()">取消</n-button
      ><n-button type="primary" :loading="submitting" :disabled="submitting" @click="confirmSubmit"
        >确认{{ operationType === 'INBOUND' ? '入库' : '出库' }}</n-button
      ></n-space
    >
  </div>
</template>
