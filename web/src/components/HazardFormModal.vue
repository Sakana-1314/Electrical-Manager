<script setup lang="ts">
/**
 * 隐患登记 / 编辑弹窗。
 *
 * 与申购计划等模块一致：新增与编辑共用同一弹窗，删除入口在弹窗页脚左下角，
 * 列表行点击进入编辑。责任人由责任单位只读联动带出（不随提交体发送，服务端按单位快照）。
 */
import { computed, reactive, ref, watch } from 'vue'
import {
  NButton,
  NDatePicker,
  NForm,
  NFormItem,
  NGrid,
  NGridItem,
  NInput,
  NModal,
  NSelect,
  useDialog,
  useMessage,
  type FormInst,
  type FormRules,
  type SelectOption,
} from 'naive-ui'
import { hazardApi } from '@/api/hazards'
import type {
  FileObject,
  Hazard,
  HazardLevel,
  HazardStatus,
  HazardType,
  HazardUnit,
  HazardWrite,
} from '@/api/generated'
import ImageUploader from '@/components/ImageUploader.vue'
import { dateToTimestamp, toShanghaiDate } from '@/utils/time'
import { hazardLevels, hazardStatuses } from '@/utils/hazard'

const props = withDefaults(defineProps<{ show: boolean; hazardId?: number | null }>(), {
  hazardId: null,
})

const emit = defineEmits<{
  'update:show': [value: boolean]
  saved: []
}>()

const message = useMessage()
const dialog = useDialog()

const isEdit = computed(() => props.hazardId !== null && props.hazardId !== undefined)

const formRef = ref<FormInst | null>(null)
const loading = ref(false)
const saving = ref(false)
const deleting = ref(false)
const units = ref<HazardUnit[]>([])
const types = ref<HazardType[]>([])
const beforeImages = ref<FileObject[]>([])
const afterImages = ref<FileObject[]>([])
/** 整改前 / 后图片是否还有在途上传：任一在传就禁用保存，避免 `*_image_ids` 漏掉还没传完的图。 */
const beforeImagesUploading = ref(false)
const afterImagesUploading = ref(false)

const form = reactive({
  inspectionArea: '华星现场',
  inspectionDate: null as number | null,
  inspector: '电气自查',
  level: '一般隐患' as HazardLevel,
  description: '',
  suggestion: '',
  hazardUnitId: null as number | null,
  dueDate: null as number | null,
  recheckPerson: '',
  rectifyPerson: '',
  status: '待整改' as HazardStatus,
  hazardTypeId: null as number | null,
  remark: '',
})

/** 用户是否手改过「要求完成时间」：没改过时随检查日期联动 +7 天。 */
let dueTouched: boolean = false

const rules: FormRules = {
  description: [
    { required: true, message: '请填写隐患描述', trigger: ['input', 'blur'] },
    { min: 2, message: '隐患描述至少 2 个字符', trigger: ['input', 'blur'] },
  ],
  hazardUnitId: { required: true, type: 'number', message: '请选择责任单位', trigger: ['change'] },
  hazardTypeId: { required: true, type: 'number', message: '请选择隐患类型', trigger: ['change'] },
}

// 停用单位不再出现在新增下拉里（历史隐患仍保留其名称快照）。
const unitOptions = computed<SelectOption[]>(() =>
  units.value
    .filter((unit) => unit.enabled)
    .map((unit) => ({ label: `${unit.name}（${unit.person}）`, value: unit.id })),
)

const statusOptions = hazardStatuses.map((value) => ({ label: value, value }))
const levelOptions = hazardLevels.map((value) => ({ label: value, value }))

/** 隐患类型按大类分组展示：选类型时先看大类再看小类。 */
const typeOptions = computed(() => {
  const groups = new Map<string, SelectOption[]>()
  for (const item of types.value) {
    const group = groups.get(item.major) ?? []
    group.push({ label: item.minor, value: item.id })
    groups.set(item.major, group)
  }
  return [...groups].map(([major, children]) => ({ type: 'group', label: major, children }))
})

/** 责任人：由所选责任单位联动带出，只读展示。 */
const linkedPerson = computed(() => {
  const unit = units.value.find((item) => item.id === form.hazardUnitId)
  return unit?.person ?? ''
})

async function loadEnums(): Promise<void> {
  const [unitList, typeList] = await Promise.all([hazardApi.units(), hazardApi.types()])
  units.value = unitList
  types.value = typeList
}

function today(): number {
  return dateToTimestamp(toShanghaiDate(Date.now())) as number
}

function resetForm(): void {
  Object.assign(form, {
    inspectionArea: '华星现场',
    inspectionDate: today(),
    inspector: '电气自查',
    level: '一般隐患' as HazardLevel,
    description: '',
    suggestion: '',
    hazardUnitId: null,
    dueDate: today() + 7 * 24 * 60 * 60 * 1000,
    recheckPerson: '',
    rectifyPerson: '',
    status: '待整改' as HazardStatus,
    hazardTypeId: null,
    remark: '',
  })
  dueTouched = false
  beforeImages.value = []
  afterImages.value = []
  formRef.value?.restoreValidation()
}

function applyDetail(item: Hazard): void {
  Object.assign(form, {
    inspectionArea: item.inspection_area,
    inspectionDate: dateToTimestamp(item.inspection_date),
    inspector: item.inspector,
    level: item.level,
    description: item.description,
    suggestion: item.suggestion ?? '',
    hazardUnitId: item.hazard_unit_id,
    dueDate: dateToTimestamp(item.due_date),
    recheckPerson: item.recheck_person ?? '',
    rectifyPerson: item.rectify_person ?? '',
    status: item.status,
    hazardTypeId: item.hazard_type_id,
    remark: item.remark ?? '',
  })
  beforeImages.value = [...item.before_images]
  afterImages.value = [...item.after_images]
  // 编辑时不再让检查日期联动覆盖已有的要求完成时间。
  dueTouched = true
}

async function prepare(): Promise<void> {
  loading.value = true
  resetForm()
  try {
    await loadEnums()
    if (props.hazardId !== null && props.hazardId !== undefined) {
      applyDetail(await hazardApi.hazard(props.hazardId))
    }
  } catch (error) {
    message.error(error instanceof Error ? error.message : '加载隐患信息失败')
  } finally {
    loading.value = false
  }
}

watch(
  () => props.show,
  (open) => {
    if (open) void prepare()
  },
)

function handleInspectionDateChange(value: number | null): void {
  form.inspectionDate = value
  // 只有用户从未手动改过要求完成时间时才联动（与旧系统行为一致）。
  if (!dueTouched && value !== null) {
    form.dueDate = value + 7 * 24 * 60 * 60 * 1000
  }
}

/** 用户手动改过要求完成时间后就不再随检查日期联动。 */
function handleDueDateChange(value: number | null): void {
  form.dueDate = value
  dueTouched = true
}

function close(): void {
  emit('update:show', false)
}

async function handleSubmit(): Promise<void> {
  try {
    await formRef.value?.validate()
  } catch {
    return
  }
  if (
    form.hazardUnitId === null ||
    form.hazardTypeId === null ||
    form.inspectionDate === null ||
    form.dueDate === null
  ) {
    message.warning('请完善表单必填项')
    return
  }
  saving.value = true
  try {
    const payload: HazardWrite = {
      inspection_area: form.inspectionArea.trim() || null,
      inspection_date: toShanghaiDate(form.inspectionDate),
      inspector: form.inspector.trim() || null,
      description: form.description.trim(),
      suggestion: form.suggestion.trim() || null,
      hazard_unit_id: form.hazardUnitId,
      due_date: toShanghaiDate(form.dueDate),
      recheck_person: form.recheckPerson.trim() || null,
      rectify_person: form.rectifyPerson.trim() || null,
      status: form.status,
      hazard_type_id: form.hazardTypeId,
      level: form.level,
      remark: form.remark.trim() || null,
      before_image_ids: beforeImages.value.map((file) => file.id),
      after_image_ids: afterImages.value.map((file) => file.id),
    }
    if (props.hazardId !== null && props.hazardId !== undefined) {
      // 编辑：带上版本号做乐观锁，冲突时后端返回 VERSION_CONFLICT。
      const current = await hazardApi.hazard(props.hazardId)
      await hazardApi.updateHazard(props.hazardId, { ...payload, version: current.version })
      message.success('保存成功')
    } else {
      await hazardApi.createHazard(payload)
      message.success('登记成功')
    }
    emit('saved')
    close()
  } catch (error) {
    message.error(error instanceof Error ? error.message : '保存失败')
  } finally {
    saving.value = false
  }
}

function confirmDelete(): void {
  const hazardId = props.hazardId
  if (hazardId === null || hazardId === undefined) {
    return
  }
  dialog.warning({
    draggable: true,
    title: '确认删除隐患',
    content: `确定删除“${form.description}”吗？删除后无法恢复。`,
    positiveText: '确认删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      deleting.value = true
      try {
        const current = await hazardApi.hazard(hazardId)
        await hazardApi.deleteHazard(hazardId, current.version)
        message.success('隐患已删除')
        emit('saved')
        close()
      } catch (error) {
        message.error(error instanceof Error ? error.message : '删除失败')
        return false
      } finally {
        deleting.value = false
      }
      return true
    },
  })
}
</script>

<template>
  <n-modal
    :show="show"
    preset="card"
    draggable
    :title="isEdit ? '编辑隐患' : '登记隐患'"
    style="width: min(860px, calc(100vw - 24px))"
    :mask-closable="false"
    @update:show="close"
  >
    <div class="modal-body">
      <n-form ref="formRef" :model="form" :rules="rules" label-placement="top" :disabled="loading">
        <n-grid :cols="2" :x-gap="20">
          <n-grid-item>
            <n-form-item label="检查区域" path="inspectionArea">
              <n-input v-model:value="form.inspectionArea" placeholder="默认：华星现场" />
            </n-form-item>
          </n-grid-item>
          <n-grid-item>
            <n-form-item label="检查日期">
              <n-date-picker
                :value="form.inspectionDate"
                type="date"
                class="full-width"
                @update:value="handleInspectionDateChange"
              />
            </n-form-item>
          </n-grid-item>
          <n-grid-item>
            <n-form-item label="检查人员">
              <n-input v-model:value="form.inspector" placeholder="默认：电气自查" />
            </n-form-item>
          </n-grid-item>
          <n-grid-item>
            <n-form-item label="隐患等级">
              <n-select v-model:value="form.level" :options="levelOptions" />
            </n-form-item>
          </n-grid-item>
          <n-grid-item :span="2">
            <n-form-item label="隐患描述" path="description">
              <n-input
                v-model:value="form.description"
                type="textarea"
                :autosize="{ minRows: 3, maxRows: 6 }"
                placeholder="请详细描述隐患情况"
              />
            </n-form-item>
          </n-grid-item>
          <n-grid-item :span="2">
            <n-form-item label="建议整改方案">
              <n-input
                v-model:value="form.suggestion"
                type="textarea"
                :autosize="{ minRows: 2, maxRows: 5 }"
                placeholder="建议的整改措施（可选）"
              />
            </n-form-item>
          </n-grid-item>
          <n-grid-item>
            <n-form-item label="责任单位" path="hazardUnitId">
              <n-select
                v-model:value="form.hazardUnitId"
                :options="unitOptions"
                placeholder="选择后自动带出责任人"
                filterable
                clearable
              />
            </n-form-item>
          </n-grid-item>
          <n-grid-item>
            <n-form-item label="责任人">
              <n-input :value="linkedPerson" readonly placeholder="由责任单位自动带出" />
            </n-form-item>
          </n-grid-item>
          <n-grid-item>
            <n-form-item label="要求完成时间">
              <n-date-picker
                v-model:value="form.dueDate"
                type="date"
                class="full-width"
                @update:value="handleDueDateChange"
              />
            </n-form-item>
          </n-grid-item>
          <n-grid-item>
            <n-form-item label="复查人员">
              <n-input v-model:value="form.recheckPerson" placeholder="留空默认同检查人员" />
            </n-form-item>
          </n-grid-item>
          <n-grid-item>
            <n-form-item label="整改员工">
              <n-input v-model:value="form.rectifyPerson" placeholder="负责整改的员工（可选）" />
            </n-form-item>
          </n-grid-item>
          <n-grid-item>
            <n-form-item label="整改状态">
              <n-select v-model:value="form.status" :options="statusOptions" />
            </n-form-item>
          </n-grid-item>
          <n-grid-item :span="2">
            <n-form-item label="隐患类型" path="hazardTypeId">
              <n-select
                v-model:value="form.hazardTypeId"
                :options="typeOptions"
                placeholder="先选大类，再选小类"
                filterable
                clearable
              />
            </n-form-item>
          </n-grid-item>
          <n-grid-item :span="2">
            <n-form-item label="整改前图片附件">
              <ImageUploader v-model:files="beforeImages" v-model:busy="beforeImagesUploading" />
            </n-form-item>
          </n-grid-item>
          <n-grid-item :span="2">
            <n-form-item label="整改后图片附件">
              <ImageUploader v-model:files="afterImages" v-model:busy="afterImagesUploading" />
            </n-form-item>
          </n-grid-item>
          <n-grid-item :span="2">
            <n-form-item label="备注">
              <n-input
                v-model:value="form.remark"
                type="textarea"
                :autosize="{ minRows: 2, maxRows: 5 }"
                placeholder="其他需要说明的情况（可选）"
              />
            </n-form-item>
          </n-grid-item>
        </n-grid>
      </n-form>
    </div>

    <template #footer>
      <div class="modal-footer">
        <div class="modal-footer-left">
          <n-button v-if="isEdit" type="error" ghost :loading="deleting" @click="confirmDelete">
            删除
          </n-button>
        </div>
        <div class="modal-footer-right">
          <n-button @click="close">取消</n-button>
          <n-button
            type="primary"
            :loading="saving"
            :disabled="beforeImagesUploading || afterImagesUploading"
            @click="handleSubmit"
            >保存</n-button
          >
        </div>
      </div>
    </template>
  </n-modal>
</template>

<style scoped>
.modal-body {
  max-height: min(70vh, 660px);
  overflow-y: auto;
}

.modal-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.modal-footer-right {
  display: flex;
  gap: 8px;
}
</style>
