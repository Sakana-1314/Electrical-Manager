<script setup lang="ts">
/**
 * 二级库物资「详情 / 新建 / 编辑」弹窗。
 *
 * 取代原来的 `StockMaterialDetailView` 页面：列表点行、列表「编辑」、库存查询点行与「详情」
 * 都打开本弹窗，新建物资也复用同一个组件（`materialId` 为 null 即新建）。因此在弹窗里就能
 * 完成原来详情页的全部事情：看当前库存与建议申购数量、改档案与补库策略、拿到出库小程序码、
 * 直接跳出/出库入口、删除没有操作记录的档案。
 *
 * 关闭语义见 `useMaskCloseGuard`：点遮罩 / ESC / 右上角 × 都先做未保存修改的确认。
 */
import { computed, reactive, ref, watch } from 'vue'
import { useDialog, useMessage, type FormInst, type FormRules } from 'naive-ui'
import { useRouter } from 'vue-router'
import { inventoryApi } from '@/api/inventory'
import type {
  FileObject,
  InventoryBalance,
  StockMaterial,
  StockMaterialWrite,
} from '@/api/generated'
import ImageUploader from '@/components/ImageUploader.vue'
import LoadingMask from '@/components/LoadingMask.vue'
import QuantityInput from '@/components/QuantityInput.vue'
import { useAuthStore } from '@/stores/auth'
import { useMaskCloseGuard } from '@/composables/useMaskCloseGuard'
import { isDecimalString } from '@/utils/decimal'
import { formatShanghaiTime } from '@/utils/time'

const props = withDefaults(
  defineProps<{
    show: boolean
    /** 打开的物资 id；null 表示新建 */
    materialId?: number | null
  }>(),
  { materialId: null },
)

const emit = defineEmits<{ 'update:show': [value: boolean]; saved: [] }>()

const router = useRouter()
const message = useMessage()
const dialog = useDialog()
const auth = useAuthStore()

const showModel = computed({
  get: () => props.show,
  set: (value: boolean) => emit('update:show', value),
})
const isEdit = computed(() => props.materialId !== null && props.materialId !== undefined)
const canWrite = computed(() => auth.can('warehouse:write'))

const material = ref<StockMaterial | null>(null)
const balance = ref<InventoryBalance | null>(null)
const images = ref<FileObject[]>([])
/** 图片附件是否还有在途上传：有则禁用保存，避免 `image_ids` 漏掉还没传完的图。 */
const imagesUploading = ref(false)
const miniProgramCodeUrl = ref('')
const formRef = ref<FormInst | null>(null)
const loading = ref(false)
const saving = ref(false)
const deleting = ref(false)
const miniProgramCodeFilename = computed(
  () => `物资-${material.value?.uuid ?? '出库'}-小程序码.png`,
)

const form = reactive<StockMaterialWrite>({
  name: '',
  name_id: '',
  alias: '',
  model_spec: '',
  unit_name: '',
  remark: '',
  image_ids: [],
})
const policy = reactive({
  minimum_qty: '0',
  enabled: true,
  version: undefined as number | undefined,
})
const rules: FormRules = {
  name: { required: true, message: '请输入物资名称' },
  model_spec: { required: true, message: '请输入型号规格；无型号时填写“无”' },
  unit_name: { required: true, message: '请输入计量单位' },
}

/** 脏判定快照：键序固定，避免 JSON 序列化顺序抖动把回填误判成用户改动。 */
function snapshot(): string {
  return JSON.stringify({
    name: form.name,
    name_id: form.name_id,
    alias: form.alias,
    model_spec: form.model_spec,
    unit_name: form.unit_name,
    remark: form.remark,
    minimum_qty: policy.minimum_qty,
    enabled: policy.enabled,
    image_ids: images.value.map((image) => image.id),
  })
}
const baseline = ref('')

const { requestClose } = useMaskCloseGuard({
  isDirty: () => snapshot() !== baseline.value,
  close: () => {
    showModel.value = false
  },
})

/** `@close` 必须返回 false，否则 naive-ui 会自己把 show 置 false，拦不住「继续编辑」。 */
function handleCloseClick(): false {
  requestClose()
  return false
}

function resetForm() {
  Object.assign(form, {
    name: '',
    name_id: '',
    alias: '',
    model_spec: '',
    unit_name: '',
    remark: '',
    image_ids: [],
    version: undefined,
  })
  Object.assign(policy, { minimum_qty: '0', enabled: true, version: undefined })
  images.value = []
  material.value = null
  balance.value = null
}

function syncForm(value: StockMaterial) {
  Object.assign(form, {
    name: value.name,
    name_id: value.name_id || '',
    alias: value.alias || '',
    model_spec: value.model_spec,
    unit_name: value.unit_name,
    remark: value.remark || '',
    image_ids: value.images.map((image) => image.id),
    version: value.version,
  })
  Object.assign(policy, {
    minimum_qty: value.replenishment_policy?.minimum_qty ?? '0',
    enabled: value.replenishment_policy?.enabled ?? true,
    version: value.replenishment_policy?.version,
  })
  images.value = [...value.images]
}

function replaceMiniProgramCodeUrl(nextUrl = '') {
  if (miniProgramCodeUrl.value) URL.revokeObjectURL(miniProgramCodeUrl.value)
  miniProgramCodeUrl.value = nextUrl
}

async function loadMiniProgramCode(materialId: number) {
  try {
    const code = await inventoryApi.materialMiniProgramCode(materialId)
    replaceMiniProgramCodeUrl(URL.createObjectURL(code))
  } catch (error) {
    replaceMiniProgramCodeUrl()
    message.warning(error instanceof Error ? error.message : '出库小程序码加载失败')
  }
}

async function load() {
  const materialId = props.materialId
  replaceMiniProgramCodeUrl()
  if (materialId === null || materialId === undefined) {
    resetForm()
    baseline.value = snapshot()
    return
  }
  loading.value = true
  try {
    const [nextMaterial, nextBalance] = await Promise.all([
      inventoryApi.material(materialId),
      inventoryApi.balance(materialId),
    ])
    material.value = nextMaterial
    balance.value = nextBalance
    syncForm(nextMaterial)
    baseline.value = snapshot()
    await loadMiniProgramCode(materialId)
  } catch (error) {
    message.error(error instanceof Error ? error.message : '物资档案加载失败')
    // 交给父级清掉 URL 上的 detail 参数
    showModel.value = false
  } finally {
    loading.value = false
  }
}

async function save() {
  if (isEdit.value && !material.value) return
  await formRef.value?.validate()
  if (!isDecimalString(policy.minimum_qty, 1, true)) {
    message.error('最低库存必须为非负数，且最多 1 位小数')
    return
  }

  saving.value = true
  try {
    form.image_ids = images.value.map((image) => image.id)
    const payload = {
      ...form,
      name: form.name.trim(),
      name_id: form.name_id?.trim() || undefined,
      alias: form.alias?.trim() || undefined,
      model_spec: form.model_spec.trim(),
      unit_name: form.unit_name.trim(),
      remark: form.remark?.trim() || undefined,
    }
    const targetId = props.materialId ?? null
    const saved =
      targetId === null
        ? await inventoryApi.createMaterial(payload)
        : await inventoryApi.updateMaterial(targetId, payload)
    await inventoryApi.savePolicy(saved.id, {
      minimum_qty: policy.minimum_qty,
      enabled: policy.enabled,
      version: targetId === null ? undefined : policy.version,
    })
    message.success(targetId === null ? '物资档案已创建' : '物资档案已保存')
    baseline.value = snapshot()
    showModel.value = false
    emit('saved')
  } catch (error) {
    message.error(error instanceof Error ? error.message : '保存失败')
  } finally {
    saving.value = false
  }
}

function confirmDelete() {
  const target = material.value
  if (!target) return
  dialog.warning({
    draggable: true,
    title: '确认删除物资档案',
    content: `确定删除“${target.name}（${target.model_spec}）”吗？删除后无法恢复。`,
    positiveText: '确认删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      deleting.value = true
      try {
        await inventoryApi.deleteMaterial(target.id, target.version)
        message.success('物资档案已删除')
        showModel.value = false
        emit('saved')
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

function goInbound() {
  const id = props.materialId
  if (id === null || id === undefined) return
  showModel.value = false
  void router.push({ name: 'inbound', query: { material_id: String(id) } })
}

function goOutbound() {
  const id = props.materialId
  if (id === null || id === undefined) return
  showModel.value = false
  void router.push({ name: 'outbound', query: { material_id: String(id) } })
}

watch(
  () => [props.show, props.materialId] as const,
  ([show]) => {
    if (!show) {
      // 关闭即释放小程序码 Blob，并清掉上次的数据，避免下次打开闪旧值
      replaceMiniProgramCodeUrl()
      resetForm()
      baseline.value = snapshot()
      return
    }
    void load()
  },
  { immediate: true },
)
</script>

<template>
  <n-modal
    v-model:show="showModel"
    preset="card"
    draggable
    data-detail-modal
    :title="isEdit ? '二级库物资详情' : '新建二级库物资'"
    style="width: min(720px, calc(100vw - 24px))"
    :mask-closable="false"
    :close-on-esc="false"
    @mask-click="requestClose"
    @esc="requestClose"
    @close="handleCloseClick"
  >
    <LoadingMask :show="loading" text="加载中…" />
    <n-form ref="formRef" :model="form" :rules="rules" label-placement="top" :disabled="!canWrite">
      <div class="form-grid">
        <n-form-item label="物资名称" path="name" required>
          <n-input v-model:value="form.name" maxlength="128" />
        </n-form-item>
        <n-form-item label="物资名称（印尼语）" path="name_id">
          <n-input
            v-model:value="form.name_id"
            maxlength="128"
            placeholder="选填；未填写时小程序显示默认物资名称"
          />
        </n-form-item>
        <n-form-item label="别名" path="alias">
          <n-input v-model:value="form.alias" maxlength="128" placeholder="选填，例如：漏保" />
        </n-form-item>
        <n-form-item label="型号规格" path="model_spec" required>
          <n-input v-model:value="form.model_spec" maxlength="255" placeholder="无型号时填写“无”" />
        </n-form-item>
        <n-form-item label="计量单位" path="unit_name" required>
          <n-input v-model:value="form.unit_name" maxlength="32" placeholder="可任意填写" />
        </n-form-item>
        <n-form-item v-if="isEdit" label="当前库存">
          <n-input :value="material?.current_qty ?? '0'" disabled>
            <template #suffix>{{ material?.unit_name }}</template>
          </n-input>
        </n-form-item>
        <n-form-item label="最低库存">
          <QuantityInput v-model:value="policy.minimum_qty" :disabled="!canWrite">
            <template #suffix>{{ material?.unit_name || form.unit_name }}</template>
          </QuantityInput>
        </n-form-item>
        <n-form-item v-if="isEdit" label="建议申购数量">
          <n-input :value="balance?.suggested_purchase_qty ?? '0'" disabled>
            <template #suffix>{{ material?.unit_name }}</template>
          </n-input>
        </n-form-item>
      </div>
      <n-form-item label="低库存预警" class="wide-form-item">
        <div class="switch-field">
          <n-switch v-model:value="policy.enabled" :disabled="!canWrite" />
          <span>{{ policy.enabled ? '已启用' : '已停用' }}</span>
          <span class="muted">库存低于最低库存时进入低库存清单</span>
        </div>
      </n-form-item>
      <n-form-item label="备注" class="wide-form-item">
        <n-input v-model:value="form.remark" type="textarea" maxlength="1000" show-count />
      </n-form-item>
      <n-form-item v-if="isEdit && material" label="出库小程序码" class="wide-form-item">
        <div class="mini-program-code-field">
          <img
            v-if="miniProgramCodeUrl"
            class="mini-program-code-image"
            :src="miniProgramCodeUrl"
            :alt="`${material.name}出库小程序码`"
          />
          <div class="mini-program-code-details">
            <strong>微信扫码直达出库</strong>
            <span class="muted">扫一扫，领料出库快人一步</span>
            <code>{{ material.uuid.toUpperCase() }}</code>
            <n-button
              tag="a"
              secondary
              size="small"
              :href="miniProgramCodeUrl"
              :download="miniProgramCodeFilename"
            >
              下载小程序码
            </n-button>
          </div>
        </div>
      </n-form-item>
      <n-form-item label="图片附件" class="wide-form-item attachment-form-item">
        <ImageUploader
          v-model:files="images"
          v-model:busy="imagesUploading"
          :disabled="!canWrite"
        />
      </n-form-item>
    </n-form>
    <template #footer>
      <n-space justify="space-between" align="center">
        <n-space align="center">
          <template v-if="isEdit && material">
            <span class="muted">最后更新：{{ formatShanghaiTime(material.updated_at) }}</span>
            <n-tag size="small" :type="material.has_operation_records ? 'default' : 'success'">
              {{ material.has_operation_records ? '已有操作记录' : '暂无操作记录' }}
            </n-tag>
            <n-button
              v-if="canWrite && !material.has_operation_records"
              type="error"
              ghost
              :loading="deleting"
              @click="confirmDelete"
            >
              删除
            </n-button>
          </template>
        </n-space>
        <n-space justify="end">
          <template v-if="isEdit && canWrite">
            <n-button secondary @click="goInbound">入库</n-button>
            <n-button secondary @click="goOutbound">出库</n-button>
          </template>
          <n-button @click="requestClose">取消</n-button>
          <n-button
            v-if="canWrite"
            type="primary"
            :loading="saving"
            :disabled="imagesUploading"
            @click="save"
          >
            {{ isEdit ? '保存修改' : '创建' }}
          </n-button>
        </n-space>
      </n-space>
    </template>
  </n-modal>
</template>

<style scoped>
.wide-form-item {
  grid-column: 1 / -1;
}

.switch-field {
  display: flex;
  min-height: 34px;
  align-items: center;
  gap: 10px;
}

.attachment-form-item {
  margin-bottom: 0;
}

.mini-program-code-field {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 24px;
  padding: 20px;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  background: var(--color-surface-soft);
  box-sizing: border-box;
}

.mini-program-code-image {
  width: 168px;
  height: 168px;
  flex: none;
  padding: 8px;
  border-radius: 8px;
  background: var(--color-scan-surface);
  box-shadow: 0 6px 18px var(--shadow-card-strong);
  box-sizing: border-box;
}

.mini-program-code-details {
  display: flex;
  min-width: 0;
  align-items: flex-start;
  flex-direction: column;
  gap: 10px;
}

.mini-program-code-details strong {
  color: var(--color-text-strong);
  font-size: 16px;
}

.mini-program-code-details code {
  max-width: 100%;
  padding: 6px 10px;
  overflow: hidden;
  border-radius: 6px;
  background: var(--color-primary-soft);
  color: var(--color-primary-strong-text);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 640px) {
  .mini-program-code-field {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
