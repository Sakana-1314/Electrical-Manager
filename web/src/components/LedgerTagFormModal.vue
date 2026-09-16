<script setup lang="ts">
/**
 * 标签节点新增 / 编辑弹窗。
 *
 * 标签是至多 3 层的树：新增与编辑都选上级（不选 = 一级标签），
 * 已到第 3 层的节点不能再挂子标签，编辑时自身与自己的子孙也不能选（会成环）——这两类在选项里置灰，
 * 「移动后超过 3 层」由后端再校验一次（`LEDGER_TAG_MAX_LEVEL`）。
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
import { tagParentOptions } from '@/utils/ledger'

const props = withDefaults(
  defineProps<{
    show: boolean
    /** 编辑对象；为空表示新增 */
    tag?: LedgerTag | null
    /** 新增时的上级标签（从节点上的「+」进来时预填） */
    parentId?: number | null
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
/** 弹窗自己加载全量标签：页面可能正按「孤立 / 树标签」筛选，筛选后的局部列表不能当上级候选。 */
const allTags = ref<LedgerTag[]>([])
const loadingParent = ref(false)
const form = reactive({ name: '', parentId: null as number | null, remark: '' })

const rules: FormRules = {
  name: { required: true, message: '请输入标签名称', trigger: ['input', 'blur'] },
}

/**
 * 上级标签选项：第 3 层节点不能挂子标签，编辑时自身与自己的子孙也不能选（会成环）。
 * 不选上级就是一级标签。
 */
const parentOptions = computed<TreeSelectOption[]>(
  () => tagParentOptions(allTags.value, props.tag?.id) as unknown as TreeSelectOption[],
)

async function loadAllTags(): Promise<void> {
  loadingParent.value = true
  try {
    allTags.value = await ledgerApi.tags()
  } catch (error) {
    message.error(error instanceof Error ? error.message : '上级标签加载失败')
  } finally {
    loadingParent.value = false
  }
}

function resetForm(): void {
  Object.assign(form, {
    name: props.tag?.name ?? '',
    // 一级标签的 parent_id 是 null，这里保持为空而不是回填自己
    parentId: props.tag?.parent_id ?? props.parentId ?? null,
    remark: props.tag?.remark ?? '',
  })
  images.value = props.tag ? [...props.tag.images] : []
  formRef.value?.restoreValidation()
}

watch(
  () => props.show,
  (open) => {
    if (!open) return
    resetForm()
    void loadAllTags()
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
        parent_id: payload.parent_id,
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
          v-model:value="form.parentId"
          :options="parentOptions"
          :loading="loadingParent"
          clearable
          filterable
          placeholder="不选即为一级标签（最多 3 层）"
        />
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
