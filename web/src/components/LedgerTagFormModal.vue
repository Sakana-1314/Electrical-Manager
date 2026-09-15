<script setup lang="ts">
/**
 * 标签节点新增 / 编辑弹窗。
 *
 * 标签是至多 3 层的树：新建时可选上级（已到第 3 层的节点置灰，不能再挂子标签），
 * 编辑时不允许改上级（避免子树深度变化），只改名称、备注与图片。
 * 删除入口在页脚左下角：有子标签或已被台账引用时后端返回 409，这里直接展示其文案。
 */
import { computed, reactive, ref, watch } from 'vue'
import {
  NButton,
  NForm,
  NFormItem,
  NInput,
  NModal,
  NTreeSelect,
  useDialog,
  useMessage,
  type FormInst,
  type FormRules,
  type TreeSelectOption,
} from 'naive-ui'
import { ledgerApi } from '@/api/ledger'
import type { FileObject, LedgerTag, LedgerTagWrite } from '@/api/generated'
import ImageUploader from '@/components/ImageUploader.vue'
import { tagParentOptions, tagPath } from '@/utils/ledger'

const props = withDefaults(
  defineProps<{
    show: boolean
    /** 编辑对象；为空表示新增 */
    tag?: LedgerTag | null
    /** 新增时的上级标签（从节点上的「+ 子标签」进来时预填） */
    parentId?: number | null
    /** 当前全部标签（用于上级选择与路径展示，由页面统一加载，避免弹窗重复请求） */
    tags: LedgerTag[]
  }>(),
  { tag: null, parentId: null },
)

const emit = defineEmits<{
  'update:show': [value: boolean]
  saved: []
}>()

const message = useMessage()
const dialog = useDialog()

const isEdit = computed(() => props.tag !== null && props.tag !== undefined)
const formRef = ref<FormInst | null>(null)
const saving = ref(false)
const deleting = ref(false)
const images = ref<FileObject[]>([])
const form = reactive({ name: '', parentId: null as number | null, remark: '' })

const rules: FormRules = {
  name: { required: true, message: '请输入标签名称', trigger: ['input', 'blur'] },
}

/** 上级标签选项：第 3 层节点置灰（不能再挂子标签）。 */
const parentOptions = computed<TreeSelectOption[]>(
  () => tagParentOptions(props.tags) as unknown as TreeSelectOption[],
)

/** 编辑态展示当前层级路径（上级不可改，用只读文本说明它挂在哪里）。 */
const currentPath = computed(() =>
  isEdit.value && props.tag ? tagPath(props.tags, props.tag) : '',
)

function resetForm(): void {
  Object.assign(form, {
    name: props.tag?.name ?? '',
    parentId: props.tag?.parent_id ?? props.parentId ?? null,
    remark: props.tag?.remark ?? '',
  })
  images.value = props.tag ? [...props.tag.images] : []
  formRef.value?.restoreValidation()
}

watch(
  () => props.show,
  (open) => {
    if (open) resetForm()
  },
)

function close(): void {
  emit('update:show', false)
}

async function handleSubmit(): Promise<void> {
  try {
    await formRef.value?.validate()
  } catch {
    return
  }
  saving.value = true
  try {
    const payload: LedgerTagWrite = {
      parent_id: form.parentId,
      name: form.name.trim(),
      remark: form.remark.trim() || null,
      image_ids: images.value.map((file) => file.id),
    }
    if (isEdit.value && props.tag) {
      await ledgerApi.updateTag(props.tag.id, {
        name: payload.name,
        remark: payload.remark,
        image_ids: payload.image_ids,
        version: props.tag.version,
      })
      message.success('保存成功')
    } else {
      await ledgerApi.createTag(payload)
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
  const tag = props.tag
  if (!tag) return
  dialog.warning({
    draggable: true,
    title: '确认删除标签',
    content: `确定删除“${tag.name}”吗？有子标签或已被台账引用的标签无法删除。`,
    positiveText: '确认删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      deleting.value = true
      try {
        await ledgerApi.deleteTag(tag.id, tag.version)
        message.success('标签已删除')
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
    :title="isEdit ? '编辑标签' : '新增标签'"
    style="width: min(600px, calc(100vw - 24px))"
    :mask-closable="false"
    @update:show="close"
  >
    <n-form ref="formRef" :model="form" :rules="rules" label-placement="top">
      <n-form-item label="名称" path="name">
        <n-input v-model:value="form.name" placeholder="如：低压柜" />
      </n-form-item>
      <n-form-item label="上级标签">
        <n-tree-select
          v-if="!isEdit"
          v-model:value="form.parentId"
          :options="parentOptions"
          clearable
          filterable
          placeholder="不选则为一级标签（最多 3 层）"
        />
        <n-input v-else :value="currentPath" disabled />
      </n-form-item>
      <n-form-item label="备注">
        <n-input
          v-model:value="form.remark"
          type="textarea"
          :autosize="{ minRows: 2, maxRows: 5 }"
          placeholder="鼠标悬停标签节点时会展示这段备注"
        />
      </n-form-item>
      <n-form-item label="图片附件">
        <ImageUploader v-model:files="images" />
      </n-form-item>
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
          <n-button type="primary" :loading="saving" @click="handleSubmit">保存</n-button>
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
