<script setup lang="ts">
import { computed, h, onMounted, reactive, ref } from 'vue'
import { NButton, NTag, useDialog, useMessage } from 'naive-ui'
import type { ManagedUser, RoleRead } from '@/api/generated'
import { dictionaryApi, roleApi } from '@/api/dictionaries'
import {
  getTableScrollX,
  preventTableColumnCompression,
  tableColumnWidths,
} from '@/constants/table'
import { activeBackendUrl } from '@/api/backend'
import { resolveMcpUrl } from '@/config/env'
import { usePagedTable } from '@/composables/usePagedTable'
import { useProjectStore } from '@/stores/project'

// 可选角色列表（RBAC）：用户可挂多个角色，权限取并集；「角色管理」页维护角色本体。
const roleOptions = ref<RoleRead[]>([])

const message = useMessage()
const dialog = useDialog()
const { items, loading, load } = usePagedTable<ManagedUser, Record<string, never>>({
  // 管理端用户无分页，全量拉取
  fetch: (_f, pager) => dictionaryApi.users({ page_size: pager.page_size }),
  initialFilters: () => ({}),
  paginated: false,
  defaultPageSize: 200,
})
const show = ref(false)
const editing = ref<ManagedUser | null>(null)
// 合并账号：从某一行打开「把其他账号并入该账号」的对话框；目标保留资料，角色取并集。
const showMerge = ref(false)
const mergeSourceId = ref<number | null>(null)
const merging = ref(false)
const mergeSource = computed(() => items.value.find((item) => item.id === mergeSourceId.value) ?? null)
const project = useProjectStore()
// MCP 地址带上当前项目：Agent 连上后就按这个项目读写数据（不带则用系统默认项目）
const mcpUrl = computed(() =>
  editing.value?.api_token
    ? resolveMcpUrl(activeBackendUrl(), editing.value.api_token, project.currentProjectId)
    : '',
)
const form = reactive({
  username: '',
  display_name: '',
  department_name: '',
  role_ids: [] as number[],
  enabled: true,
  password: '',
  version: 0,
})
onMounted(() => {
  roleApi.roles().then((roles) => (roleOptions.value = roles))
})
const columns = preventTableColumnCompression<ManagedUser>([
  { title: '用户名', key: 'username', width: tableColumnWidths.identifier },
  { title: '显示名称', key: 'display_name', width: tableColumnWidths.name },
  {
    title: '来源',
    key: 'source',
    width: 92,
    render: (r) =>
      h(
        NTag,
        { size: 'small', type: r.source === 'MANAGE' ? 'info' : 'default', round: true },
        { default: () => (r.source === 'MANAGE' ? '管理端' : '小程序') },
      ),
  },
  {
    title: '微信 OpenID',
    key: 'wechat_openid',
    width: 220,
    ellipsis: { tooltip: true },
    render: (r) => r.wechat_openid || '—',
  },
  {
    title: '角色',
    key: 'roles',
    width: tableColumnWidths.description,
    render: (r) =>
      h(
        'div',
        { style: 'display:flex;flex-wrap:wrap;gap:4px' },
        (r.roles ?? []).map((role) =>
          h(
            NTag,
            { key: role.id, size: 'small', type: role.is_system ? 'info' : 'default', round: true },
            { default: () => role.name },
          ),
        ),
      ),
  },
  {
    title: '状态',
    key: 'enabled',
    width: tableColumnWidths.status,
    render: (r) =>
      h(
        NTag,
        { type: r.enabled ? 'success' : 'default' },
        { default: () => (r.enabled ? '启用' : '停用') },
      ),
  },
])
const tableScrollX = getTableScrollX(columns)
// 表格不再有操作列：整行可点，点开即编辑弹窗（删除 / 合并也在这个弹窗里）。
function rowProps(row: ManagedUser) {
  return {
    style: 'cursor:pointer',
    onClick: () => open(row),
  }
}
function open(row?: ManagedUser): void {
  editing.value = row || null
  Object.assign(
    form,
    row
      ? {
          username: row.username,
          display_name: row.display_name,
          department_name: row.department_name,
          role_ids: (row.roles ?? []).map((role) => role.id),
          enabled: row.enabled,
          password: '',
          version: row.version,
        }
      : {
          username: '',
          display_name: '',
          department_name: '',
          role_ids: [],
          enabled: true,
          password: '',
          version: 0,
        },
  )
  show.value = true
}
async function save() {
  if (!form.username.trim() || !form.display_name.trim() || (!editing.value && !form.password)) {
    message.error('请完整填写用户名、显示名称和初始密码')
    return
  }
  try {
    const payload = {
      username: form.username,
      display_name: form.display_name,
      department_name: form.department_name,
      role_ids: form.role_ids,
      enabled: form.enabled,
      ...(form.password ? { password: form.password } : {}),
    }
    if (editing.value) {
      await dictionaryApi.updateUser(editing.value.id, { ...payload, version: form.version })
    } else {
      await dictionaryApi.createUser({ ...payload, password: form.password })
    }
    message.success('保存成功')
    show.value = false
    await load()
  } catch (e) {
    message.error(e instanceof Error ? e.message : '保存失败')
  }
}
async function copyApiToken() {
  if (!editing.value?.api_token) return
  try {
    await navigator.clipboard.writeText(editing.value.api_token)
    message.success('接口令牌已复制')
  } catch {
    message.error('复制失败，请手动选择令牌')
  }
}
async function copyMcpUrl() {
  if (!mcpUrl.value) return
  try {
    await navigator.clipboard.writeText(mcpUrl.value)
    message.success('MCP 地址已复制')
  } catch {
    message.error('复制失败，请手动选择地址')
  }
}
function regenerateApiToken() {
  if (!editing.value) return
  dialog.warning({
    draggable: true,
    title: '重新生成接口令牌',
    content: `重新生成后，“${editing.value.username}”的旧令牌将立即失效。`,
    positiveText: '重新生成',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        const updated = await dictionaryApi.regenerateUserApiToken(
          editing.value!.id,
          editing.value!.version,
        )
        editing.value = updated
        form.version = updated.version
        const index = items.value.findIndex((item) => item.id === updated.id)
        if (index >= 0) items.value[index] = updated
        message.success('接口令牌已重新生成')
      } catch (e) {
        message.error(e instanceof Error ? e.message : '重新生成失败')
        return false
      }
    },
  })
}
function openMerge(row: ManagedUser) {
  editing.value = row
  mergeSourceId.value = null
  showMerge.value = true
}

/** 合并对话框关闭：回到该用户的编辑弹窗（从编辑弹窗进入的场景），删掉后则整体关闭。 */
function closeMerge() {
  showMerge.value = false
  mergeSourceId.value = null
}

async function saveMerge() {
  const target = editing.value
  const source = mergeSource.value
  if (!target || !source) {
    message.error('请选择要并入的来源账号')
    return
  }
  merging.value = true
  try {
    await dictionaryApi.mergeUser(target.id, {
      source_user_id: source.id,
      source_version: source.version,
      target_version: target.version,
    })
    message.success(`已将「${source.display_name}」合并到「${target.display_name}」`)
    showMerge.value = false
    show.value = false
    editing.value = null
    await load()
  } catch (e) {
    message.error(e instanceof Error ? e.message : '账号合并失败')
  } finally {
    merging.value = false
  }
}

function remove(row: ManagedUser) {
  dialog.warning({
    draggable: true,
    title: '删除用户',
    content: `确认删除用户“${row.username}”吗？已有操作记录或业务数据关联的用户不能删除。`,
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        await dictionaryApi.deleteUser(row.id)
        message.success('用户已删除')
        show.value = false
        editing.value = null
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
        <h1 class="page-title">用户管理</h1>
      </div>
      <div class="page-actions">
        <n-button type="primary" @click="open()">新建用户</n-button>
      </div>
    </div>
    <n-card class="data-card"
      ><n-data-table
        :bordered="false"
        :columns="columns"
        :data="items"
        :loading="loading"
        :scroll-x="tableScrollX"
        :row-key="(r: ManagedUser) => r.id"
        :row-props="rowProps" /></n-card
    ><n-modal
      v-model:show="show"
      preset="card"
      draggable
      :title="editing ? '编辑用户' : '新建用户'"
      style="width: min(620px, calc(100vw - 32px))"
      ><n-form label-placement="top"
        ><n-form-item label="用户名" required><n-input v-model:value="form.username" /></n-form-item
        ><n-form-item label="显示名称" required
          ><n-input v-model:value="form.display_name" /></n-form-item
        ><n-form-item label="部门单位"
          ><n-input v-model:value="form.department_name" /></n-form-item
        ><n-form-item label="角色（可多选，权限取并集）"
          ><n-select
            v-model:value="form.role_ids"
            multiple
            clearable
            :options="roleOptions.map((role) => ({ value: role.id, label: role.name }))" /></n-form-item
        ><n-form-item
          :label="editing ? '重置密码（不修改可留空）' : '初始密码'"
          :required="!editing"
          ><n-input
            v-model:value="form.password"
            type="password"
            show-password-on="click" /></n-form-item
        ><n-form-item v-if="editing" label="接口令牌"
          ><n-input-group>
            <n-input
              :value="
                editing.api_token ??
                '（旧版令牌将在其下次接口调用后自动回显；点击重新生成立即可见）'
              "
              readonly
            />
            <n-button :disabled="!editing.api_token" @click="copyApiToken">复制令牌</n-button>
            <n-button @click="regenerateApiToken">重新生成</n-button>
          </n-input-group></n-form-item
        ><n-form-item v-if="editing" label="MCP 地址"
          ><n-input-group>
            <n-input :value="mcpUrl || '（接口令牌回显后可复制 MCP 地址）'" readonly />
            <n-button type="primary" secondary :disabled="!mcpUrl" @click="copyMcpUrl"
              >复制地址</n-button
            >
          </n-input-group></n-form-item
        ><n-form-item label="启用"><n-switch v-model:value="form.enabled" /></n-form-item></n-form
      ><template #footer
        ><n-space justify="space-between" style="width: 100%"
          ><n-space v-if="editing"
            ><n-button type="error" secondary @click="remove(editing)">删除</n-button
            ><n-button secondary @click="openMerge(editing)">合并账号</n-button></n-space
          ><n-space justify="end"
            ><n-button @click="show = false">取消</n-button
            ><n-button type="primary" @click="save">保存</n-button></n-space
          ></n-space
        ></template
      ></n-modal
    ><n-modal
      v-model:show="showMerge"
      preset="card"
      draggable
      title="合并账号"
      style="width: min(560px, calc(100vw - 32px))"
      ><n-form label-placement="top"
        ><n-form-item label="目标账号（保留姓名与部门）">
          <div class="merge-target">
            <div class="merge-target-name">{{ editing?.display_name }}（{{ editing?.username }}）</div>
            <div class="merge-target-roles">
              <n-tag
                v-for="role in editing?.roles ?? []"
                :key="role.id"
                size="small"
                type="info"
                round
                >{{ role.name }}</n-tag
              >
            </div>
          </div></n-form-item
        ><n-form-item label="要并入的来源账号" required
          ><n-select
            v-model:value="mergeSourceId"
            filterable
            placeholder="选择要被合并的账号（合并后删除）"
            :options="
              items
                .filter((item) => item.id !== editing?.id)
                .map((item) => ({
                  value: item.id,
                  label: `${item.display_name}（${item.username}｜${
                    item.source === 'MANAGE' ? '管理端' : '小程序'
                  }）`,
                }))
            " /></n-form-item
        ><n-alert v-if="mergeSource" type="warning" :show-icon="true"
          >将把「{{ mergeSource.display_name }}」的微信身份并入目标账号，角色取两个账号的并集；来源账号随后删除。</n-alert
        ></n-form
      ><template #footer
        ><n-space justify="end"
          ><n-button @click="closeMerge">取消</n-button
          ><n-button type="primary" :loading="merging" @click="saveMerge">确认合并</n-button></n-space
        ></template
      ></n-modal>
  </div>
</template>

<style scoped>
.merge-target {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.merge-target-name {
  font-weight: 600;
}
.merge-target-roles {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
</style>
