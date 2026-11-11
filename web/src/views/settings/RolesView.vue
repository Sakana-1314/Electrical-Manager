<script setup lang="ts">
import { computed, h, onMounted, reactive, ref } from 'vue'
import { NButton, NTag, useDialog, useMessage } from 'naive-ui'
import type { PermissionDef, RoleRead } from '@/api/generated'
import { roleApi } from '@/api/dictionaries'
import {
  getTableScrollX,
  preventTableColumnCompression,
  tableColumnWidths,
} from '@/constants/table'

const message = useMessage()
const dialog = useDialog()
// 角色无分页，全量拉取。
const items = ref<RoleRead[]>([])
const loading = ref(false)
async function load() {
  loading.value = true
  try {
    items.value = await roleApi.roles()
  } catch (e) {
    message.error(e instanceof Error ? e.message : '角色加载失败')
  } finally {
    loading.value = false
  }
}
const catalog = ref<PermissionDef[]>([])
onMounted(() => {
  roleApi.permissions().then((defs) => (catalog.value = defs))
})

// 权限目录按模块分组：编辑弹窗里按模块勾选。
const moduleGroups = computed(() => {
  const groups = new Map<string, PermissionDef[]>()
  catalog.value.forEach((def) => {
    const list = groups.get(def.module) ?? []
    list.push(def)
    groups.set(def.module, list)
  })
  return [...groups.entries()].map(([module, defs]) => ({ module, defs }))
})

const show = ref(false)
const editing = ref<RoleRead | null>(null)
const form = reactive({
  name: '',
  description: '',
  permissions: [] as string[],
  version: 0,
})

const columns = preventTableColumnCompression<RoleRead>([
  { title: '角色名', key: 'name', width: tableColumnWidths.name, fixed: 'left' },
  { title: '说明', key: 'description', width: tableColumnWidths.description },
  {
    title: '权限',
    key: 'permissions',
    width: 520,
    render: (r) =>
      h(
        'div',
        { style: 'display:flex;flex-wrap:wrap;gap:4px' },
        (r.permissions ?? []).map((key) => {
          const def = catalog.value.find((item) => item.key === key)
          return h(
            NTag,
            { key, size: 'small', bordered: false },
            { default: () => def?.label ?? key },
          )
        }),
      ),
  },
  {
    title: '用户数',
    key: 'user_count',
    width: 88,
    render: (r) => `${r.user_count}`,
  },
  {
    title: '操作',
    key: 'action',
    width: tableColumnWidths.action,
    render: (r) =>
      h('div', { style: 'display:flex;gap:8px' }, [
        h(
          NButton,
          {
            size: 'small',
            disabled: r.is_system,
            onClick: () => open(r),
          },
          { default: () => (r.is_system ? '内置' : '编辑') },
        ),
        h(
          NButton,
          {
            size: 'small',
            type: 'error',
            secondary: true,
            disabled: r.is_system,
            onClick: () => remove(r),
          },
          { default: () => '删除' },
        ),
      ]),
  },
])
const tableScrollX = getTableScrollX(columns)

function open(row?: RoleRead) {
  editing.value = row || null
  Object.assign(
    form,
    row
      ? {
          name: row.name,
          description: row.description,
          permissions: [...row.permissions],
          version: row.version,
        }
      : { name: '', description: '', permissions: [], version: 0 },
  )
  show.value = true
}

async function save() {
  if (!form.name.trim()) {
    message.error('请填写角色名')
    return
  }
  try {
    const payload = { name: form.name, description: form.description, permissions: form.permissions }
    if (editing.value) {
      await roleApi.updateRole(editing.value.id, { ...payload, version: form.version })
    } else {
      await roleApi.createRole(payload)
    }
    message.success('保存成功')
    show.value = false
    await load()
  } catch (e) {
    message.error(e instanceof Error ? e.message : '保存失败')
  }
}

function remove(row: RoleRead) {
  dialog.warning({
    draggable: true,
    title: '删除角色',
    content: `确认删除角色「${row.name}」吗？仍有用户挂载时无法删除。`,
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        await roleApi.deleteRole(row.id, row.version)
        message.success('角色已删除')
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
        <h1 class="page-title">角色管理</h1>
      </div>
      <div class="page-actions">
        <n-button type="primary" @click="open()">新建角色</n-button>
      </div>
    </div>
    <n-card class="data-card"
      ><n-data-table
        :bordered="false"
        :columns="columns"
        :data="items"
        :loading="loading"
        :scroll-x="tableScrollX"
        :row-key="(r: RoleRead) => r.id" /></n-card
    ><n-modal
      v-model:show="show"
      preset="card"
      draggable
      :title="editing ? '编辑角色' : '新建角色'"
      style="width: min(680px, calc(100vw - 32px))"
      ><n-form label-placement="top"
        ><n-form-item label="角色名" required><n-input v-model:value="form.name" /></n-form-item
        ><n-form-item label="说明"
          ><n-input v-model:value="form.description" /></n-form-item
        ><n-form-item label="权限（用户可挂多个角色，实际权限取并集）"
          ><div class="perm-groups">
            <div v-for="group in moduleGroups" :key="group.module" class="perm-group">
              <div class="perm-group-title">{{ group.module }}</div>
              <n-checkbox-group v-model:value="form.permissions">
                <n-checkbox
                  v-for="def in group.defs"
                  :key="def.key"
                  :value="def.key"
                  :label="def.label"
                />
              </n-checkbox-group>
            </div>
          </div></n-form-item
        ></n-form
      ><template #footer
        ><n-space justify="end"
          ><n-button @click="show = false">取消</n-button
          ><n-button type="primary" @click="save">保存</n-button></n-space
        ></template
      ></n-modal
    >
  </div>
</template>

<style scoped>
.perm-groups {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.perm-group {
  padding: 12px 16px;
  border: 1px solid var(--n-border-color, #efeff5);
  border-radius: 8px;
}
.perm-group-title {
  margin-bottom: 6px;
  color: rgba(0, 0, 0, 0.45);
  font-size: 12px;
}
</style>
