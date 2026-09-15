<script setup lang="ts">
/** 隐患类型：一行一个「大类 + 小类」组合，支持按大类筛选，整行点击编辑。 */
import { computed, h, ref } from 'vue'
import {
  NButton,
  NCard,
  NDataTable,
  NForm,
  NFormItem,
  NInput,
  NModal,
  NSelect,
  NTag,
  useDialog,
  useMessage,
  type FormInst,
  type FormRules,
  type SelectOption,
} from 'naive-ui'
import { hazardApi } from '@/api/hazards'
import type { HazardType } from '@/api/generated'
import { getTableScrollX, preventTableColumnCompression } from '@/constants/table'
import { usePagedTable } from '@/composables/usePagedTable'
import { useAuthStore } from '@/stores/auth'
import { createTableRowClickGuard } from '@/utils/tableRowNavigation'

const auth = useAuthStore()
const message = useMessage()
const dialog = useDialog()
const canWrite = computed(() => auth.can('hazard:write'))
const rowClickGuard = createTableRowClickGuard()

const { items, loading, load } = usePagedTable<HazardType, Record<string, never>>({
  fetch: () =>
    hazardApi
      .types()
      .then((rows) => ({ items: rows, page: 1, page_size: 200, total: rows.length })),
  initialFilters: () => ({}),
  paginated: false,
  defaultPageSize: 200,
  onError: (error) => message.error(error instanceof Error ? error.message : '隐患类型加载失败'),
})

const showModal = ref(false)
const saving = ref(false)
const deleting = ref(false)
const editing = ref<HazardType | null>(null)
const formRef = ref<FormInst | null>(null)
const form = ref({ major: '', minor: '' })
const majorFilter = ref<string | null>(null)

/** 已有大类（去重）作为下拉候选，新增时也可直接输入新大类。 */
const majorOptions = computed<SelectOption[]>(() => {
  const seen = new Set<string>()
  const options: SelectOption[] = []
  for (const item of items.value) {
    if (item.major && !seen.has(item.major)) {
      seen.add(item.major)
      options.push({ label: item.major, value: item.major })
    }
  }
  return options
})

/** 按大类筛选后的展示列表（未选则全量）。 */
const filteredItems = computed(() =>
  majorFilter.value ? items.value.filter((item) => item.major === majorFilter.value) : items.value,
)

const rules: FormRules = {
  major: { required: true, message: '请输入或选择大类', trigger: ['input', 'blur', 'change'] },
  minor: { required: true, message: '请输入小类', trigger: ['input', 'blur'] },
}

const columns = computed(() =>
  preventTableColumnCompression<HazardType>([
    {
      title: '大类',
      key: 'major',
      minWidth: 200,
      render: (row) =>
        h(NTag, { size: 'small', type: 'info', bordered: false }, { default: () => row.major }),
    },
    { title: '小类', key: 'minor', minWidth: 220 },
  ]),
)
const tableScrollX = computed(() => getTableScrollX(columns.value))

function openCreate(): void {
  editing.value = null
  form.value = { major: majorFilter.value ?? '', minor: '' }
  showModal.value = true
}

function openEdit(row: HazardType): void {
  editing.value = row
  form.value = { major: row.major, minor: row.minor }
  showModal.value = true
}

function rowProps(row: HazardType) {
  return {
    style: 'cursor: pointer',
    onMousedown: rowClickGuard.onMouseDown,
    onClick: (event: MouseEvent) => {
      if (!rowClickGuard.shouldIgnore(event)) openEdit(row)
    },
  }
}

async function handleSave(): Promise<void> {
  try {
    await formRef.value?.validate()
  } catch {
    return
  }
  saving.value = true
  try {
    const payload = { major: form.value.major.trim(), minor: form.value.minor.trim() }
    if (editing.value) {
      await hazardApi.updateType(editing.value.id, {
        ...payload,
        version: editing.value.version,
      })
      message.success('保存成功')
    } else {
      await hazardApi.createType(payload)
      message.success('新增成功')
    }
    showModal.value = false
    await load()
  } catch (error) {
    message.error(error instanceof Error ? error.message : '保存失败')
  } finally {
    saving.value = false
  }
}

function confirmDelete(): void {
  const current = editing.value
  if (!current) return
  dialog.warning({
    draggable: true,
    title: '确认删除隐患类型',
    content: `确定删除“${current.major} / ${current.minor}”吗？已被隐患记录引用的类型无法删除，只能修改。`,
    positiveText: '确认删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      deleting.value = true
      try {
        await hazardApi.deleteType(current.id, current.version)
        message.success('隐患类型已删除')
        showModal.value = false
        await load()
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
  <div class="page">
    <div class="page-header">
      <div>
        <h1 class="page-title">隐患类型</h1>
      </div>
      <div class="page-actions">
        <n-button v-if="canWrite" type="primary" @click="openCreate">新增隐患类型</n-button>
      </div>
    </div>

    <n-card class="filter-card" :bordered="false">
      <div class="filter-heading">
        <div class="filter-title">筛选条件</div>
      </div>
      <div class="filter-grid">
        <label class="filter-field">
          <span>大类</span>
          <n-select
            v-model:value="majorFilter"
            :options="majorOptions"
            placeholder="不限"
            clearable
            filterable
          />
        </label>
      </div>
    </n-card>

    <n-card class="data-card" :bordered="false">
      <n-data-table
        :columns="columns"
        :data="filteredItems"
        :loading="loading"
        :bordered="false"
        :row-key="(row: HazardType) => row.id"
        :row-props="rowProps"
        :scroll-x="tableScrollX"
      />
    </n-card>

    <n-modal
      v-model:show="showModal"
      preset="card"
      draggable
      :title="editing ? '编辑隐患类型' : '新增隐患类型'"
      style="width: min(520px, calc(100vw - 24px))"
      :mask-closable="false"
    >
      <n-form ref="formRef" :model="form" :rules="rules" label-placement="top">
        <n-form-item label="大类" path="major">
          <n-select
            v-model:value="form.major"
            :options="majorOptions"
            placeholder="可下拉选择已有大类，也可直接输入新大类"
            filterable
            tag
            clearable
          />
        </n-form-item>
        <n-form-item label="小类" path="minor">
          <n-input v-model:value="form.minor" placeholder="如：线路老化" />
        </n-form-item>
      </n-form>
      <template #footer>
        <div class="modal-footer">
          <div class="modal-footer-left">
            <n-button v-if="editing" type="error" ghost :loading="deleting" @click="confirmDelete">
              删除
            </n-button>
          </div>
          <div class="modal-footer-right">
            <n-button @click="showModal = false">取消</n-button>
            <n-button type="primary" :loading="saving" @click="handleSave">保存</n-button>
          </div>
        </div>
      </template>
    </n-modal>
  </div>
</template>

<style scoped>
/* 筛选区标题：与其它列表页同一套页面级样式（全局 styles.css 不提供这条）。 */
.filter-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 18px;
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
