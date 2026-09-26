<script setup lang="ts">
/**
 * 任务新增 / 编辑弹窗。
 *
 * 与台账、隐患等模块一致：新增与编辑共用同一弹窗，删除入口在页脚左下角。
 * 任务名在项目内唯一（重名后端返回 409），任务下还有工作记录时不允许删除（409）——
 * 两种情况都把后端的提示原样抛出，避免前端自己拼一套文案。
 * 图片附件先上传拿 file_id，再随整表提交（与全站口径一致）。
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
} from 'naive-ui'
import { workApi } from '@/api/work'
import type { FileObject, WorkTask, WorkTaskStatus, WorkTaskWrite } from '@/api/generated'
import ImageUploader from '@/components/ImageUploader.vue'
import { dateToTimestamp, toShanghaiDate } from '@/utils/time'
import { workTaskStatusOptions } from '@/utils/work'

const props = withDefaults(defineProps<{ show: boolean; taskId?: number | null }>(), {
  taskId: null,
})

const emit = defineEmits<{ 'update:show': [value: boolean]; saved: [] }>()

const message = useMessage()
const dialog = useDialog()

const isEdit = computed(() => props.taskId !== null && props.taskId !== undefined)

const formRef = ref<FormInst | null>(null)
const loading = ref(false)
const saving = ref(false)
const deleting = ref(false)
const images = ref<FileObject[]>([])
/** 图片附件是否还有在途上传：有则禁用保存，避免 `image_ids` 漏掉还没传完的图。 */
const imagesUploading = ref(false)

const form = reactive({
  name: '',
  status: '未开始' as WorkTaskStatus,
  planStart: null as number | null,
  planEnd: null as number | null,
  description: '',
  remark: '',
})

const rules: FormRules = {
  name: { required: true, message: '请输入任务名称', trigger: ['input', 'blur'] },
}

function resetForm(): void {
  Object.assign(form, {
    name: '',
    status: '未开始',
    planStart: null,
    planEnd: null,
    description: '',
    remark: '',
  })
  images.value = []
  formRef.value?.restoreValidation()
}

function applyDetail(task: WorkTask): void {
  Object.assign(form, {
    name: task.name,
    status: task.status,
    planStart: dateToTimestamp(task.plan_start_date),
    planEnd: dateToTimestamp(task.plan_end_date),
    description: task.description ?? '',
    remark: task.remark ?? '',
  })
  images.value = [...task.images]
}

async function prepare(): Promise<void> {
  loading.value = true
  resetForm()
  try {
    if (isEdit.value && props.taskId !== null && props.taskId !== undefined) {
      applyDetail(await workApi.task(props.taskId))
    }
  } catch (error) {
    message.error(error instanceof Error ? error.message : '加载任务失败')
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

function payload(): WorkTaskWrite {
  return {
    name: form.name.trim(),
    description: form.description.trim() || null,
    status: form.status,
    plan_start_date: form.planStart === null ? null : toShanghaiDate(form.planStart),
    plan_end_date: form.planEnd === null ? null : toShanghaiDate(form.planEnd),
    remark: form.remark.trim() || null,
    image_ids: images.value.map((file) => file.id),
  }
}

async function handleSubmit(): Promise<void> {
  try {
    await formRef.value?.validate()
  } catch {
    return
  }
  saving.value = true
  try {
    if (isEdit.value && props.taskId !== null && props.taskId !== undefined) {
      // 编辑：取最新版本号再提交，冲突时后端返回 VERSION_CONFLICT。
      const current = await workApi.task(props.taskId)
      await workApi.updateTask(props.taskId, { ...payload(), version: current.version })
      message.success('保存成功')
    } else {
      await workApi.createTask(payload())
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
  const taskId = props.taskId
  if (taskId === null || taskId === undefined) return
  dialog.warning({
    draggable: true,
    title: '确认删除任务',
    content: `确定删除“${form.name}”吗？任务下还有工作记录时需要先删记录。`,
    positiveText: '确认删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      deleting.value = true
      try {
        const current = await workApi.task(taskId)
        await workApi.deleteTask(taskId, current.version)
        message.success('任务已删除')
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
    :title="isEdit ? '编辑任务' : '新增任务'"
    style="width: min(720px, calc(100vw - 24px))"
    :mask-closable="false"
    @update:show="close"
  >
    <n-form ref="formRef" :model="form" :rules="rules" label-placement="top" :disabled="loading">
      <n-grid :cols="2" :x-gap="20">
        <n-grid-item :span="2">
          <n-form-item label="任务名称" path="name">
            <n-input
              v-model:value="form.name"
              maxlength="128"
              placeholder="如：1# 回转窑主电机轴承更换"
            />
          </n-form-item>
        </n-grid-item>
        <n-grid-item>
          <n-form-item label="状态">
            <n-select v-model:value="form.status" :options="workTaskStatusOptions" />
          </n-form-item>
        </n-grid-item>
        <n-grid-item>
          <n-form-item label="计划开始">
            <n-date-picker v-model:value="form.planStart" type="date" clearable />
          </n-form-item>
        </n-grid-item>
        <n-grid-item>
          <n-form-item label="计划结束">
            <n-date-picker v-model:value="form.planEnd" type="date" clearable />
          </n-form-item>
        </n-grid-item>
        <n-grid-item :span="2">
          <n-form-item label="工作内容">
            <n-input
              v-model:value="form.description"
              type="textarea"
              :autosize="{ minRows: 2, maxRows: 5 }"
              maxlength="1000"
              placeholder="这一步要干什么、有什么前置条件"
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
              placeholder="备件、工作票、停机窗口等"
            />
          </n-form-item>
        </n-grid-item>
        <n-grid-item :span="2">
          <n-form-item label="图片附件">
            <ImageUploader v-model:files="images" v-model:busy="imagesUploading" />
          </n-form-item>
        </n-grid-item>
      </n-grid>
    </n-form>
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
            :disabled="imagesUploading"
            @click="handleSubmit"
            >保存</n-button
          >
        </div>
      </div>
    </template>
  </n-modal>
</template>

<style scoped>
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
