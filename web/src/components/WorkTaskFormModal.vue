<script setup lang="ts">
/**
 * 工作任务新增 / 编辑弹窗：一行一个任务（工作任务 / 事项或步骤 / 开始时间 / 完成时间 /
 * 责任人 / 完成度 / 备注 / 标签 / 图片）。
 *
 * - 标签提交为英文逗号分隔的字符串（服务端存储口径）；输入框用可创建的标签选择器，
 *   已有标签作为候选，新标签直接输入回车即可。
 * - 图片先上传拿 file_id，再随整表提交（与全站口径一致）。
 * - 只读用户（无 work:write）打开时字段禁用，只保留关闭按钮。
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
  NInputNumber,
  NModal,
  NSelect,
  NSlider,
  useDialog,
  useMessage,
  type FormInst,
  type FormRules,
  type SelectOption,
} from 'naive-ui'
import { workApi } from '@/api/work'
import type { FileObject, WorkTask, WorkTaskWrite } from '@/api/generated'
import ImageUploader from '@/components/ImageUploader.vue'
import { dateToTimestamp, toShanghaiDate } from '@/utils/time'
import { joinWorkTags, splitWorkTags } from '@/utils/work'

const props = withDefaults(
  defineProps<{
    show: boolean
    /** 编辑模式的任务 id；null 表示新增 */
    taskId?: number | null
    /** 只读模式（无工作管理写权限）：字段禁用、只保留关闭按钮 */
    readonly?: boolean
  }>(),
  { taskId: null, readonly: false },
)

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
const tagOptions = ref<SelectOption[]>([])
const version = ref(1)

const form = reactive({
  name: '',
  steps: '',
  start: null as number | null,
  end: null as number | null,
  owner: '',
  progress: 0,
  remark: '',
  tags: [] as string[],
})

const rules: FormRules = {
  name: { required: true, message: '请输入工作任务', trigger: ['input', 'blur'] },
}

function resetForm(): void {
  Object.assign(form, {
    name: '',
    steps: '',
    start: null,
    end: null,
    owner: '',
    progress: 0,
    remark: '',
    tags: [],
  })
  images.value = []
  version.value = 1
  formRef.value?.restoreValidation()
}

function applyDetail(task: WorkTask): void {
  Object.assign(form, {
    name: task.name,
    steps: task.steps ?? '',
    start: dateToTimestamp(task.start_date),
    end: dateToTimestamp(task.end_date),
    owner: task.owner ?? '',
    progress: task.progress,
    remark: task.remark ?? '',
    tags: splitWorkTags(task.tags),
  })
  images.value = [...task.images]
  version.value = task.version
}

async function loadTagOptions(): Promise<void> {
  try {
    tagOptions.value = (await workApi.taskTags()).map((tag) => ({ label: tag, value: tag }))
  } catch {
    // 标签候选加载失败不阻塞编辑，已选标签仍可提交
  }
}

async function prepare(): Promise<void> {
  loading.value = true
  resetForm()
  try {
    await loadTagOptions()
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

/** 标签候选：把当前已选标签补进选项，避免下拉里看不到它们。 */
const mergedTagOptions = computed<SelectOption[]>(() => {
  const known = new Set(tagOptions.value.map((option) => String(option.value)))
  const extra = form.tags
    .filter((tag) => !known.has(tag))
    .map((tag) => ({ label: tag, value: tag }))
  return [...extra, ...tagOptions.value]
})

function payload(): WorkTaskWrite {
  return {
    name: form.name.trim(),
    steps: form.steps.trim() || null,
    start_date: form.start === null ? null : toShanghaiDate(form.start),
    end_date: form.end === null ? null : toShanghaiDate(form.end),
    owner: form.owner.trim() || null,
    progress: form.progress ?? 0,
    remark: form.remark.trim() || null,
    tags: joinWorkTags(form.tags),
    image_ids: images.value.map((file) => file.id),
  }
}

async function handleSubmit(): Promise<void> {
  try {
    await formRef.value?.validate()
  } catch {
    return
  }
  if (form.start !== null && form.end !== null && form.end < form.start) {
    message.error('完成时间不能早于开始时间')
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
    content: `确定删除“${form.name}”吗？删除后不可恢复。`,
    positiveText: '确认删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      deleting.value = true
      try {
        await workApi.deleteTask(taskId, version.value)
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
    :title="readonly ? '任务详情' : isEdit ? '编辑任务' : '新增任务'"
    style="width: min(760px, calc(100vw - 24px))"
    :mask-closable="false"
    @update:show="close"
  >
    <n-form
      ref="formRef"
      :model="form"
      :rules="rules"
      label-placement="top"
      size="small"
      :disabled="loading || readonly"
    >
      <n-grid :cols="2" :x-gap="20" :y-gap="20">
        <n-grid-item :span="2">
          <n-form-item label="工作任务" path="name">
            <n-input
              v-model:value="form.name"
              type="textarea"
              :autosize="{ minRows: 1, maxRows: 3 }"
              maxlength="500"
              show-count
              placeholder="如：311区域流量计未试运"
            />
          </n-form-item>
        </n-grid-item>
        <n-grid-item :span="2">
          <n-form-item label="事项或步骤">
            <n-input
              v-model:value="form.steps"
              type="textarea"
              :autosize="{ minRows: 2, maxRows: 5 }"
              maxlength="1000"
              placeholder="这一步要做什么、有什么注意事项"
            />
          </n-form-item>
        </n-grid-item>
        <n-grid-item>
          <n-form-item label="开始时间">
            <n-date-picker v-model:value="form.start" type="date" clearable class="full-width" />
          </n-form-item>
        </n-grid-item>
        <n-grid-item>
          <n-form-item label="完成时间">
            <n-date-picker v-model:value="form.end" type="date" clearable class="full-width" />
          </n-form-item>
        </n-grid-item>
        <n-grid-item>
          <n-form-item label="责任人">
            <n-input
              v-model:value="form.owner"
              maxlength="255"
              placeholder="如：王杰，李刚，方向清"
            />
          </n-form-item>
        </n-grid-item>
        <n-grid-item>
          <n-form-item label="完成度">
            <div class="progress-field">
              <n-slider v-model:value="form.progress" :min="0" :max="100" :step="1" />
              <n-input-number
                v-model:value="form.progress"
                :min="0"
                :max="100"
                :show-button="false"
                class="progress-number"
              />
              <span class="progress-suffix">%</span>
            </div>
          </n-form-item>
        </n-grid-item>
        <n-grid-item :span="2">
          <n-form-item label="备注">
            <n-input
              v-model:value="form.remark"
              type="textarea"
              :autosize="{ minRows: 2, maxRows: 5 }"
              maxlength="1000"
              placeholder="处理结果、待办事项等"
            />
          </n-form-item>
        </n-grid-item>
        <n-grid-item :span="2">
          <n-form-item label="标签">
            <n-select
              v-model:value="form.tags"
              :options="mergedTagOptions"
              multiple
              filterable
              tag
              clearable
              :max-tag-count="8"
              placeholder="选择已有标签或直接输入新标签，回车添加"
            />
          </n-form-item>
        </n-grid-item>
        <n-grid-item :span="2">
          <n-form-item label="图片附件">
            <ImageUploader
              v-model:files="images"
              v-model:busy="imagesUploading"
              :disabled="readonly"
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
          <n-button v-if="readonly" @click="close">关闭</n-button>
          <template v-else>
            <n-button @click="close">取消</n-button>
            <n-button
              type="primary"
              :loading="saving"
              :disabled="imagesUploading"
              @click="handleSubmit"
              >保存</n-button
            >
          </template>
        </div>
      </div>
    </template>
  </n-modal>
</template>

<style scoped>
.progress-field {
  display: flex;
  align-items: center;
  gap: var(--list-inline-gap);
  width: 100%;
}

.progress-field :deep(.n-slider) {
  flex: 1;
}

.progress-number {
  flex: none;
  width: 88px;
}

.progress-suffix {
  flex: none;
  color: var(--color-text-muted);
}
</style>
