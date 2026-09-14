<script setup lang="ts">
/** 责任单位：单位与责任人一一对应，行内开关启停，整行点击编辑。 */
import { computed, h, ref } from 'vue'
import {
  NButton,
  NCard,
  NDataTable,
  NForm,
  NFormItem,
  NInput,
  NModal,
  NSwitch,
  useDialog,
  useMessage,
  type FormInst,
  type FormRules,
} from 'naive-ui'
import { hazardApi } from '@/api/hazards'
import type { HazardUnit } from '@/api/generated'
import {
  getTableScrollX,
  preventTableColumnCompression,
  tableColumnWidths,
} from '@/constants/table'
import { usePagedTable } from '@/composables/usePagedTable'
import { useAuthStore } from '@/stores/auth'
import { createTableRowClickGuard } from '@/utils/tableRowNavigation'

const auth = useAuthStore()
const message = useMessage()
const dialog = useDialog()
const canWrite = computed(() => auth.can('hazard:write'))
const rowClickGuard = createTableRowClickGuard()

const { items, loading, load } = usePagedTable<HazardUnit, Record<string, never>>({
  fetch: () =>
    hazardApi
      .units()
      .then((rows) => ({ items: rows, page: 1, page_size: 200, total: rows.length })),
  initialFilters: () => ({}),
  paginated: false,
  defaultPageSize: 200,
  onError: (error) => message.error(error instanceof Error ? error.message : '责任单位加载失败'),
})

const showModal = ref(false)
const saving = ref(false)
const deleting = ref(false)
const togglingId = ref<number | null>(null)
const editing = ref<HazardUnit | null>(null)
const formRef = ref<FormInst | null>(null)
const form = ref({ name: '', person: '', remark: '', enabled: true })

const rules: FormRules = {
  name: { required: true, message: '请输入单位名称', trigger: ['input', 'blur'] },
  person: {
    required: true,
    message: '请输入责任人（与单位一一对应）',
    trigger: ['input', 'blur'],
  },
}

const columns = computed(() =>
  preventTableColumnCompression<HazardUnit>([
    { title: '单位名称', key: 'name', width: tableColumnWidths.name, ellipsis: { tooltip: true } },
    { title: '责任人', key: 'person', width: tableColumnWidths.person },
    {
      title: '备注',
      key: 'remark',
      minWidth: tableColumnWidths.text,
      ellipsis: { tooltip: true },
      render: (row) => row.remark || '—',
    },
    {
      title: '状态',
      key: 'enabled',
      width: tableColumnWidths.status,
      render: (row) =>
        h(
          NSwitch,
          {
            value: row.enabled,
            size: 'small',
            disabled: !canWrite.value || togglingId.value === row.id,
            // 阻止冒泡：点开关只切启停，不打开编辑弹窗
            onClick: (event: MouseEvent) => event.stopPropagation(),
            onUpdateValue: (value: boolean) => void toggleEnabled(row, value),
          },
          { checked: () => '启用', unchecked: () => '停用' },
        ),
    },
  ]),
)
const tableScrollX = computed(() => getTableScrollX(columns.value))

function openCreate(): void {
  editing.value = null
  form.value = { name: '', person: '', remark: '', enabled: true }
  showModal.value = true
}

function openEdit(row: HazardUnit): void {
  editing.value = row
  form.value = {
    name: row.name,
    person: row.person,
    remark: row.remark ?? '',
    enabled: row.enabled,
  }
  showModal.value = true
}

function rowProps(row: HazardUnit) {
  return {
    style: 'cursor: pointer',
    onMousedown: rowClickGuard.onMouseDown,
    onClick: (event: MouseEvent) => {
      if (!rowClickGuard.shouldIgnore(event)) openEdit(row)
    },
  }
}

async function toggleEnabled(row: HazardUnit, value: boolean): Promise<void> {
  togglingId.value = row.id
  try {
    await hazardApi.updateUnit(row.id, { enabled: value, version: row.version })
    message.success(value ? '已启用' : '已停用')
    await load()
  } catch (error) {
    message.error(error instanceof Error ? error.message : '状态切换失败')
  } finally {
    togglingId.value = null
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
    const payload = {
      name: form.value.name.trim(),
      person: form.value.person.trim(),
      remark: form.value.remark.trim() || null,
      enabled: form.value.enabled,
    }
    if (editing.value) {
      await hazardApi.updateUnit(editing.value.id, {
        ...payload,
        version: editing.value.version,
      })
      message.success('保存成功')
    } else {
      await hazardApi.createUnit(payload)
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
    title: '确认删除责任单位',
    content: `确定删除“${current.name}”吗？已被隐患记录引用的单位无法删除。`,
    positiveText: '确认删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      deleting.value = true
      try {
        await hazardApi.deleteUnit(current.id, current.version)
        message.success('责任单位已删除')
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
        <h1 class="page-title">责任单位</h1>
      </div>
      <div class="page-actions">
        <n-button v-if="canWrite" type="primary" @click="openCreate">新增单位</n-button>
      </div>
    </div>

    <n-card class="data-card" :bordered="false">
      <n-data-table
        :columns="columns"
        :data="items"
        :loading="loading"
        :bordered="false"
        :row-key="(row: HazardUnit) => row.id"
        :row-props="rowProps"
        :scroll-x="tableScrollX"
      />
    </n-card>

    <n-modal
      v-model:show="showModal"
      preset="card"
      draggable
      :title="editing ? '编辑责任单位' : '新增责任单位'"
      style="width: min(560px, calc(100vw - 24px))"
      :mask-closable="false"
    >
      <n-form ref="formRef" :model="form" :rules="rules" label-placement="top">
        <n-form-item label="单位名称" path="name">
          <n-input v-model:value="form.name" placeholder="如：电气车间" />
        </n-form-item>
        <n-form-item label="责任人" path="person">
          <n-input v-model:value="form.person" placeholder="与该单位一一对应" />
        </n-form-item>
        <n-form-item label="备注">
          <n-input
            v-model:value="form.remark"
            type="textarea"
            :autosize="{ minRows: 2, maxRows: 5 }"
            placeholder="可选，补充单位职责、联系方式等说明"
          />
        </n-form-item>
        <n-form-item label="启用">
          <n-switch v-model:value="form.enabled" />
          <span class="switch-hint">
            {{ form.enabled ? '启用：登记隐患时可选择该单位' : '停用：登记隐患时不可选' }}
          </span>
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
.switch-hint {
  margin-left: 10px;
  color: var(--color-text-muted);
  font-size: 12px;
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
