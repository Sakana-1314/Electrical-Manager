<script setup lang="ts">
import { h, reactive, ref } from 'vue'
import { NButton, NTag, useDialog, useMessage } from 'naive-ui'
import type { Project } from '@/api/generated'
import { projectApi } from '@/api/projects'
import {
  getTableScrollX,
  preventTableColumnCompression,
  tableColumnWidths,
} from '@/constants/table'
import { usePagedTable } from '@/composables/usePagedTable'

const message = useMessage()
const dialog = useDialog()
const { items, loading, load } = usePagedTable<Project, Record<string, never>>({
  // 项目数量少，无分页，全量拉取（含停用项目，便于管理端查看与恢复）
  fetch: () =>
    projectApi
      .list()
      .then((rows) => ({ items: rows, page: 1, page_size: 200, total: rows.length })),
  initialFilters: () => ({}),
  paginated: false,
  defaultPageSize: 200,
  onError: (error) => message.error(error instanceof Error ? error.message : '项目列表加载失败'),
})
const show = ref(false)
const editing = ref<Project | null>(null)
/** 项目编码规则与后端一致：2–32 位大写字母/数字/下划线/短横线，提交前统一转大写。 */
const CODE_PATTERN = /^[A-Z0-9][A-Z0-9_-]{1,31}$/
const form = reactive({
  code: '',
  name: '',
  enabled: true,
  is_default: false,
  remark: '',
  version: 0,
})
const columns = preventTableColumnCompression<Project>([
  { title: '编码', key: 'code', width: tableColumnWidths.code },
  { title: '名称', key: 'name', width: tableColumnWidths.name },
  {
    title: '启用',
    key: 'enabled',
    width: tableColumnWidths.status,
    render: (r) =>
      h(
        NTag,
        { size: 'small', type: r.enabled ? 'success' : 'default' },
        { default: () => (r.enabled ? '启用' : '停用') },
      ),
  },
  {
    title: '默认项目',
    key: 'is_default',
    width: tableColumnWidths.status,
    render: (r) =>
      r.is_default ? h(NTag, { size: 'small', type: 'info' }, { default: () => '默认项目' }) : '—',
  },
  { title: '备注', key: 'remark', width: tableColumnWidths.text, render: (r) => r.remark || '—' },
  {
    title: '操作',
    key: 'action',
    width: tableColumnWidths.action,
    render: (r) =>
      h('div', { style: 'display:flex;gap:8px' }, [
        h(NButton, { size: 'small', onClick: () => open(r) }, { default: () => '编辑' }),
        h(
          NButton,
          { size: 'small', type: 'error', secondary: true, onClick: () => remove(r) },
          { default: () => '删除' },
        ),
      ]),
  },
])
const tableScrollX = getTableScrollX(columns)
function open(row?: Project) {
  editing.value = row || null
  Object.assign(
    form,
    row
      ? {
          code: row.code,
          name: row.name,
          enabled: row.enabled,
          is_default: row.is_default,
          remark: row.remark ?? '',
          version: row.version,
        }
      : {
          code: '',
          name: '',
          enabled: true,
          is_default: false,
          remark: '',
          version: 0,
        },
  )
  show.value = true
}
async function save() {
  const code = form.code.trim().toUpperCase()
  const name = form.name.trim()
  if (!CODE_PATTERN.test(code)) {
    message.error('项目编码需为 2–32 位大写字母、数字、下划线或短横线，如 P05')
    return
  }
  if (!name) {
    message.error('请填写项目名称')
    return
  }
  try {
    const payload = {
      code,
      name,
      enabled: form.enabled,
      is_default: form.is_default,
      remark: form.remark.trim() || null,
    }
    if (editing.value) {
      await projectApi.update(editing.value.id, { ...payload, version: form.version })
      message.success('保存成功')
    } else {
      await projectApi.create(payload)
      message.success('项目已创建')
    }
    show.value = false
    await load()
  } catch (e) {
    // 「当前项目不能修改」「默认项目不能停用」等由服务端给出明确原因，这里直接提示
    message.error(e instanceof Error ? e.message : '保存失败')
  }
}
function remove(row: Project) {
  dialog.warning({
    draggable: true,
    title: '删除项目',
    content: `确认删除项目“${row.code} ${row.name}”吗？默认项目或项目下已有数据的项目不能删除。`,
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        await projectApi.remove(row.id, row.version)
        message.success('项目已删除')
        await load()
      } catch (e) {
        message.error(e instanceof Error ? e.message : '删除失败')
        return false
      }
    },
  })
}
</script>

<template>
  <div class="page">
    <div class="page-header">
      <div>
        <h1 class="page-title">项目管理</h1>
      </div>
      <div class="page-actions">
        <n-button type="primary" @click="open()">新建项目</n-button>
      </div>
    </div>
    <n-card class="data-card">
      <n-data-table
        :bordered="false"
        :columns="columns"
        :data="items"
        :loading="loading"
        :scroll-x="tableScrollX"
        :row-key="(r: Project) => r.id"
      />
    </n-card>
    <n-modal
      v-model:show="show"
      preset="card"
      draggable
      :title="editing ? '编辑项目' : '新建项目'"
      style="width: min(560px, calc(100vw - 32px))"
    >
      <n-form label-placement="top">
        <n-form-item label="编码" required>
          <n-input
            v-model:value="form.code"
            placeholder="2–32 位大写字母、数字、下划线或短横线，如 P05"
          />
        </n-form-item>
        <n-form-item label="名称" required>
          <n-input v-model:value="form.name" placeholder="如 P05 项目" />
        </n-form-item>
        <n-form-item label="启用">
          <n-switch v-model:value="form.enabled" />
        </n-form-item>
        <n-form-item label="设为默认项目">
          <div class="form-switch-row">
            <n-switch v-model:value="form.is_default" />
            <span class="form-hint">默认项目用于小程序 / MCP 未指定项目时的兜底归属</span>
          </div>
        </n-form-item>
        <n-form-item label="备注">
          <n-input v-model:value="form.remark" type="textarea" :rows="3" placeholder="可留空" />
        </n-form-item>
      </n-form>
      <template #footer>
        <n-space justify="end">
          <n-button @click="show = false">取消</n-button>
          <n-button type="primary" @click="save">保存</n-button>
        </n-space>
      </template>
    </n-modal>
  </div>
</template>

<style scoped>
.form-switch-row {
  display: flex;
  align-items: center;
  gap: 12px;
}
/* 开关旁的说明文字：与用户/高级设置页的次要说明同一套弱化样式 */
.form-hint {
  color: var(--color-text-muted);
  font-size: 12px;
}
</style>
