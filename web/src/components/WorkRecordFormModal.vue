<script setup lang="ts">
/**
 * 工作记录新增 / 编辑弹窗：一个任务 + 一段起止时间（精确到上午 / 下午）+ 参与人员 + 备注。
 *
 * - 任务从任务列表里选（可搜索）；还没有任务时先在任务视图新增任务。
 * - 参与人员是自由文本多人输入：下拉里给项目内历史姓名辅助输入（减少错别字），
 *   新姓名直接输入回车即可（人员不是名册实体，见用户文档）。
 * - 起止都精确到半天：结束不得早于开始；同一天时「下午 → 上午」这种空区间本地先拦，
 *   后端同样会返回 400 `WORK_DATE_RANGE`。
 * - 列表页点色块打开编辑；从任务 / 人员行新增时用 props 预填任务、日期或姓名。
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
import { workApi } from '@/api/work'
import type { WorkHalfDay, WorkRecordWrite, WorkTask } from '@/api/generated'
import { dateToTimestamp, toShanghaiDate } from '@/utils/time'
import { formatRecordRange, participantOptions, workHalfOptions } from '@/utils/work'

/** 参与人上限与姓名长度：与后端 `WORK_PARTICIPANT_LIMIT` / 姓名长度上限一致。 */
const PARTICIPANT_LIMIT = 20
const PARTICIPANT_NAME_MAX_LENGTH = 24

const props = withDefaults(
  defineProps<{
    show: boolean
    /** 编辑模式的任务记录 id；null 表示新增 */
    recordId?: number | null
    /** 新增时的预填：任务 / 开始日期 / 参与人员（从任务行或人员行新增时带过来） */
    presetTaskId?: number | null
    presetDate?: string | null
    presetParticipants?: string[]
    /** 只读模式（无工作管理写权限）：字段禁用、只保留关闭按钮 */
    readonly?: boolean
  }>(),
  {
    recordId: null,
    presetTaskId: null,
    presetDate: null,
    presetParticipants: () => [],
    readonly: false,
  },
)

const emit = defineEmits<{ 'update:show': [value: boolean]; saved: [] }>()

const message = useMessage()
const dialog = useDialog()

const isEdit = computed(() => props.recordId !== null && props.recordId !== undefined)

const formRef = ref<FormInst | null>(null)
const loading = ref(false)
const saving = ref(false)
const deleting = ref(false)
const tasks = ref<WorkTask[]>([])
const participantNames = ref<string[]>([])
const version = ref(1)

const form = reactive({
  taskId: null as number | null,
  startDate: null as number | null,
  startHalf: 'AM' as WorkHalfDay,
  endDate: null as number | null,
  endHalf: 'PM' as WorkHalfDay,
  participants: [] as string[],
  remark: '',
})

const rules: FormRules = {
  taskId: { required: true, type: 'number', message: '请选择任务', trigger: ['change', 'blur'] },
  startDate: { required: true, type: 'number', message: '请选择开始日期', trigger: ['change'] },
  endDate: { required: true, type: 'number', message: '请选择结束日期', trigger: ['change'] },
  participants: {
    required: true,
    type: 'array',
    message: '请至少填写一名参与人员',
    trigger: ['change'],
  },
}

const taskOptions = computed<SelectOption[]>(() =>
  tasks.value.map((task) => ({ label: task.name, value: task.id })),
)

const participantSuggestions = computed<SelectOption[]>(() =>
  participantOptions(participantNames.value),
)

function resetForm(): void {
  Object.assign(form, {
    taskId: props.presetTaskId ?? null,
    startDate: dateToTimestamp(props.presetDate ?? null) ?? dateToTimestamp(todayDate()),
    startHalf: 'AM',
    endDate: dateToTimestamp(props.presetDate ?? null) ?? dateToTimestamp(todayDate()),
    endHalf: 'PM',
    participants: [...props.presetParticipants],
    remark: '',
  })
  version.value = 1
  formRef.value?.restoreValidation()
}

function todayDate(): string {
  return toShanghaiDate(Date.now())
}

async function prepare(): Promise<void> {
  loading.value = true
  resetForm()
  try {
    const [taskPage, names] = await Promise.all([
      workApi.tasks({ page_size: 200 }),
      workApi.participants(),
    ])
    tasks.value = taskPage.items
    participantNames.value = names
    if (isEdit.value && props.recordId !== null && props.recordId !== undefined) {
      const record = await workApi.record(props.recordId)
      Object.assign(form, {
        taskId: record.task_id,
        startDate: dateToTimestamp(record.start_date),
        startHalf: record.start_half,
        endDate: dateToTimestamp(record.end_date),
        endHalf: record.end_half,
        participants: [...record.participants],
        remark: record.remark ?? '',
      })
      version.value = record.version
    }
  } catch (error) {
    message.error(error instanceof Error ? error.message : '加载工作记录失败')
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

function close(): void {
  emit('update:show', false)
}

/** 校验参与人人数与姓名长度：提交前先拦，避免只拿到 422。 */
function checkParticipants(names: string[]): string | null {
  if (!names.length) return '请至少填写一名参与人员'
  if (names.length > PARTICIPANT_LIMIT) return `一条记录最多 ${PARTICIPANT_LIMIT} 名参与人员`
  const tooLong = names.find((name) => name.length > PARTICIPANT_NAME_MAX_LENGTH)
  return tooLong ? `姓名「${tooLong}」超过 ${PARTICIPANT_NAME_MAX_LENGTH} 字` : null
}

/** 半日区间校验：结束不得早于开始，同一天不允许「下午 → 上午」。 */
function checkRange(
  startDate: string,
  startHalf: WorkHalfDay,
  endDate: string,
  endHalf: WorkHalfDay,
): string | null {
  if (endDate < startDate) return '结束日期不能早于开始日期'
  if (endDate === startDate && startHalf === 'PM' && endHalf === 'AM') {
    return '当天的结束时段不能早于开始时段'
  }
  return null
}

function payload(): WorkRecordWrite | null {
  if (form.taskId === null || form.startDate === null || form.endDate === null) return null
  const startDate = toShanghaiDate(form.startDate)
  const endDate = toShanghaiDate(form.endDate)
  const participantError = checkParticipants(form.participants)
  if (participantError) {
    message.error(participantError)
    return null
  }
  const rangeError = checkRange(startDate, form.startHalf, endDate, form.endHalf)
  if (rangeError) {
    message.error(rangeError)
    return null
  }
  return {
    task_id: form.taskId,
    start_date: startDate,
    start_half: form.startHalf,
    end_date: endDate,
    end_half: form.endHalf,
    participants: form.participants,
    remark: form.remark.trim() || null,
  }
}

async function handleSubmit(): Promise<void> {
  try {
    await formRef.value?.validate()
  } catch {
    return
  }
  const body = payload()
  if (!body) return
  saving.value = true
  try {
    if (isEdit.value && props.recordId !== null && props.recordId !== undefined) {
      const current = await workApi.record(props.recordId)
      await workApi.updateRecord(props.recordId, { ...body, version: current.version })
      message.success('保存成功')
    } else {
      await workApi.createRecord(body)
      message.success('新增成功')
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
  const recordId = props.recordId
  if (recordId === null || recordId === undefined) return
  dialog.warning({
    draggable: true,
    title: '确认删除工作记录',
    content: '删除后无法恢复，确定删除这条工作记录吗？',
    positiveText: '确认删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      deleting.value = true
      try {
        const current = await workApi.record(recordId)
        await workApi.deleteRecord(recordId, current.version)
        message.success('工作记录已删除')
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

/** 弹窗标题下方的一行摘要：编辑时显示当前时间段，便于核对。 */
const summary = computed(() => {
  if (!isEdit.value || form.startDate === null || form.endDate === null) return ''
  return formatRecordRange({
    start_date: toShanghaiDate(form.startDate),
    start_half: form.startHalf,
    end_date: toShanghaiDate(form.endDate),
    end_half: form.endHalf,
  })
})
</script>

<template>
  <n-modal
    :show="show"
    preset="card"
    draggable
    :title="readonly ? '工作记录详情' : isEdit ? '编辑工作记录' : '新增工作记录'"
    style="width: min(680px, calc(100vw - 24px))"
    :mask-closable="false"
    @update:show="close"
  >
    <p v-if="summary" class="record-summary">{{ summary }}</p>
    <n-form
      ref="formRef"
      :model="form"
      :rules="rules"
      label-placement="top"
      :disabled="loading || readonly"
    >
      <n-grid :cols="2" :x-gap="20">
        <n-grid-item :span="2">
          <n-form-item label="任务" path="taskId">
            <n-select
              v-model:value="form.taskId"
              :options="taskOptions"
              filterable
              clearable
              placeholder="选择这个活对应的任务"
            />
          </n-form-item>
        </n-grid-item>
        <n-grid-item>
          <n-form-item label="开始日期" path="startDate">
            <div class="half-row">
              <n-date-picker v-model:value="form.startDate" type="date" class="half-date" />
              <n-select
                v-model:value="form.startHalf"
                :options="workHalfOptions"
                class="half-select"
              />
            </div>
          </n-form-item>
        </n-grid-item>
        <n-grid-item>
          <n-form-item label="结束日期" path="endDate">
            <div class="half-row">
              <n-date-picker v-model:value="form.endDate" type="date" class="half-date" />
              <n-select
                v-model:value="form.endHalf"
                :options="workHalfOptions"
                class="half-select"
              />
            </div>
          </n-form-item>
        </n-grid-item>
        <n-grid-item :span="2">
          <n-form-item label="参与人员" path="participants">
            <n-select
              v-model:value="form.participants"
              :options="participantSuggestions"
              multiple
              filterable
              tag
              clearable
              :max-tag-count="6"
              placeholder="从历史姓名里选，或直接输入新姓名后回车"
            />
          </n-form-item>
        </n-grid-item>
        <n-grid-item :span="2">
          <n-form-item label="备注">
            <n-input
              v-model:value="form.remark"
              type="textarea"
              :autosize="{ minRows: 2, maxRows: 4 }"
              maxlength="500"
              placeholder="这一步的具体内容、交接说明等"
            />
          </n-form-item>
        </n-grid-item>
      </n-grid>
    </n-form>
    <template #footer>
      <div class="modal-footer">
        <div class="modal-footer-left">
          <n-button
            v-if="isEdit && !readonly"
            type="error"
            ghost
            :loading="deleting"
            @click="confirmDelete"
          >
            删除
          </n-button>
        </div>
        <div class="modal-footer-right">
          <n-button @click="close">{{ readonly ? '关闭' : '取消' }}</n-button>
          <n-button v-if="!readonly" type="primary" :loading="saving" @click="handleSubmit">
            保存
          </n-button>
        </div>
      </div>
    </template>
  </n-modal>
</template>

<style scoped>
.record-summary {
  margin: 0 0 12px;
  color: var(--color-text-muted);
  font-size: 13px;
}

/* 日期与半天档同一行：一条记录的端点永远是「日期 + 上午 / 下午」两个值 */
.half-row {
  display: flex;
  gap: 8px;
  width: 100%;
}

.half-date {
  flex: 1 1 auto;
  min-width: 0;
}

.half-select {
  flex: 0 0 96px;
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
