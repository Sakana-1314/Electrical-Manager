<script setup lang="ts">
/**
 * 台账记录新增 / 编辑弹窗。
 *
 * 与隐患、申购等模块一致：新增与编辑共用同一弹窗，删除入口在页脚左下角，列表行点击进入编辑。
 * 标签是多选（任意层级都可挂），提交时按 id 升序交给后端，后端再规范化为逗号分隔串落库。
 */
import { computed, reactive, ref, watch } from 'vue'
import {
  NButton,
  NForm,
  NFormItem,
  NGrid,
  NGridItem,
  NInput,
  NInputNumber,
  NModal,
  NTreeSelect,
  useDialog,
  useMessage,
  type FormInst,
  type FormRules,
  type TreeSelectOption,
} from 'naive-ui'
import { ledgerApi } from '@/api/ledger'
import type { FileObject, LedgerItem, LedgerItemWrite, LedgerTag } from '@/api/generated'
import ImageUploader from '@/components/ImageUploader.vue'
import { tagSelectOptions } from '@/utils/ledger'

const props = withDefaults(defineProps<{ show: boolean; itemId?: number | null }>(), {
  itemId: null,
})

const emit = defineEmits<{
  'update:show': [value: boolean]
  saved: []
}>()

const message = useMessage()
const dialog = useDialog()

const isEdit = computed(() => props.itemId !== null && props.itemId !== undefined)

const formRef = ref<FormInst | null>(null)
const loading = ref(false)
const saving = ref(false)
const deleting = ref(false)
const tags = ref<LedgerTag[]>([])
const images = ref<FileObject[]>([])

const form = reactive({
  name: '',
  modelSpec: '',
  quantity: 1,
  tagIds: [] as number[],
  remark: '',
})

const rules: FormRules = {
  name: { required: true, message: '请输入台账名称', trigger: ['input', 'blur'] },
  modelSpec: { required: true, message: '请输入型号', trigger: ['input', 'blur'] },
}

/** 标签选择器选项：与标签树同构，任意层级都能选中。 */
const tagOptions = computed<TreeSelectOption[]>(
  () => tagSelectOptions(tags.value) as unknown as TreeSelectOption[],
)

function resetForm(): void {
  Object.assign(form, { name: '', modelSpec: '', quantity: 1, tagIds: [], remark: '' })
  images.value = []
  formRef.value?.restoreValidation()
}

function applyDetail(item: LedgerItem): void {
  Object.assign(form, {
    name: item.name,
    modelSpec: item.model_spec,
    quantity: item.quantity,
    tagIds: [...item.tag_ids],
    remark: item.remark ?? '',
  })
  images.value = [...item.images]
}

async function prepare(): Promise<void> {
  loading.value = true
  resetForm()
  try {
    tags.value = await ledgerApi.tags()
    if (isEdit.value && props.itemId !== null) {
      applyDetail(await ledgerApi.item(props.itemId))
    }
  } catch (error) {
    message.error(error instanceof Error ? error.message : '加载台账信息失败')
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

function payload(): LedgerItemWrite {
  return {
    name: form.name.trim(),
    model_spec: form.modelSpec.trim(),
    quantity: form.quantity ?? 0,
    remark: form.remark.trim() || null,
    // 标签 id 去重升序：与后端存储口径一致，避免提交顺序影响回显
    tag_ids: [...new Set(form.tagIds)].sort((a, b) => a - b),
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
    if (isEdit.value && props.itemId !== null) {
      // 编辑：带上版本号做乐观锁，冲突时后端返回 VERSION_CONFLICT。
      const current = await ledgerApi.item(props.itemId)
      await ledgerApi.updateItem(props.itemId, { ...payload(), version: current.version })
      message.success('保存成功')
    } else {
      await ledgerApi.createItem(payload())
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
  const itemId = props.itemId
  if (itemId === null || itemId === undefined) return
  dialog.warning({
    draggable: true,
    title: '确认删除台账',
    content: `确定删除“${form.name}”吗？删除后无法恢复。`,
    positiveText: '确认删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      deleting.value = true
      try {
        const current = await ledgerApi.item(itemId)
        await ledgerApi.deleteItem(itemId, current.version)
        message.success('台账已删除')
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
    :title="isEdit ? '编辑台账' : '新增台账'"
    style="width: min(720px, calc(100vw - 24px))"
    :mask-closable="false"
    @update:show="close"
  >
    <n-form ref="formRef" :model="form" :rules="rules" label-placement="top" :disabled="loading">
      <n-grid :cols="2" :x-gap="20">
        <n-grid-item>
          <n-form-item label="名称" path="name">
            <n-input v-model:value="form.name" placeholder="如：低压抽屉柜" />
          </n-form-item>
        </n-grid-item>
        <n-grid-item>
          <n-form-item label="型号" path="modelSpec">
            <n-input v-model:value="form.modelSpec" placeholder="如：MNS-400 8E/2" />
          </n-form-item>
        </n-grid-item>
        <n-grid-item>
          <n-form-item label="数量">
            <n-input-number
              v-model:value="form.quantity"
              :min="0"
              :precision="0"
              class="full-width"
              placeholder="按台 / 套 / 件统计"
            />
          </n-form-item>
        </n-grid-item>
        <n-grid-item>
          <n-form-item label="标签">
            <n-tree-select
              v-model:value="form.tagIds"
              :options="tagOptions"
              multiple
              clearable
              filterable
              placeholder="可多选，含子标签"
            />
          </n-form-item>
        </n-grid-item>
        <n-grid-item :span="2">
          <n-form-item label="备注">
            <n-input
              v-model:value="form.remark"
              type="textarea"
              :autosize="{ minRows: 2, maxRows: 5 }"
              placeholder="安装位置、检修记录等"
            />
          </n-form-item>
        </n-grid-item>
        <n-grid-item :span="2">
          <n-form-item label="图片附件">
            <ImageUploader v-model:files="images" />
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
