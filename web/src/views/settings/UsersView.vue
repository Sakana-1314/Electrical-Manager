<script setup lang="ts">
import PersistentDataTable from '@/components/PersistentDataTable.vue'
import { computed, h, onMounted, reactive, ref } from 'vue'
import { NButton, NTag, NTooltip, useDialog, useMessage } from 'naive-ui'
import type { ManagedUser, PermissionRead } from '@/api/generated'
import { dictionaryApi, permissionApi } from '@/api/dictionaries'
import { systemSettingsApi } from '@/api/systemSettings'
import { getTableScrollX, preventTableColumnCompression } from '@/constants/table'
import { activeBackendUrl } from '@/api/backend'
import { resolveMcpUrl } from '@/config/env'
import { usePagedTable } from '@/composables/usePagedTable'
import { useProjectStore } from '@/stores/project'
import { formatShanghaiTime } from '@/utils/time'

// 权限位目录（GET /permissions）：系统管理 + 各功能读写，勾选后按位存进用户 permissions。
const permissionOptions = ref<PermissionRead[]>([])
// 新建用户时预填高级设置里的默认权限。
const defaultPermissions = ref<string[]>([])
const MODULE_LABELS: Record<string, string> = {
  system: '系统管理',
  warehouse: '二级库',
  lite: '二级库',
  purchase: '申购',
  huaxing: '华星总库存',
  codes: '物料编码库',
  ledger: '台账',
  hazard: '隐患',
  work: '工单',
}
/** 权限勾选项文案：精简二级库的写权限实际是 Excel 导入，用「导入」和标准库的「读写」区分。 */
function permissionItemLabel(item: PermissionRead): string {
  if (item.module === 'lite' && item.action === 'write') return '导入'
  return item.action === 'write' ? '读写' : item.action === 'read' ? '查看' : '可管理'
}
const permissionGroups = computed(() => {
  const groups = new Map<string, PermissionRead[]>()
  for (const item of permissionOptions.value) {
    const list = groups.get(item.module) ?? []
    list.push(item)
    groups.set(item.module, list)
  }
  return Array.from(groups, ([module, items]) => ({
    module,
    label: MODULE_LABELS[module] ?? module,
    items,
  }))
})
// 权限摘要标签：系统管理 / 各模块「读写」「只读」，一眼看出这个账号能做什么。
function permissionTags(perms: string[] | undefined) {
  const list = perms ?? []
  const tags: Array<{ label: string; type: 'info' | 'success' | 'default' }> = []
  if (list.includes('system:admin')) tags.push({ label: '系统管理', type: 'info' })
  for (const group of permissionGroups.value) {
    if (group.module === 'system') continue
    const prefix = `${group.module}:`
    if (list.includes(`${prefix}write`)) tags.push({ label: `${group.label}读写`, type: 'info' })
    else if (list.includes(`${prefix}read`))
      tags.push({ label: `${group.label}只读`, type: 'default' })
  }
  if (tags.length === 0) tags.push({ label: '未分配权限', type: 'default' })
  return tags
}

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
// 合并账号：从某一行打开「把其他账号并入该账号」的对话框；目标保留资料，权限位取并集。
const showMerge = ref(false)
const mergeSourceId = ref<number | null>(null)
const merging = ref(false)
const mergeSource = computed(
  () => items.value.find((item) => item.id === mergeSourceId.value) ?? null,
)
// 概览：绑定小程序的人数（列表顶部一眼看出整体绑定情况）。
const boundCount = computed(() => items.value.filter((item) => item.wechat_openid).length)
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
  permissions: [] as string[],
  enabled: true,
  password: '',
  version: 0,
})
onMounted(() => {
  permissionApi
    .list()
    .then((options) => (permissionOptions.value = options))
    .catch((e) => message.error(e instanceof Error ? e.message : '权限目录加载失败'))
  systemSettingsApi
    .advancedSettings()
    .then((settings) => (defaultPermissions.value = [...settings.default_permissions]))
    .catch(() => undefined)
})

/** 勾选权限：写权限自动带上同模块读权限；取消读权限时同时取消写权限。 */
function togglePermission(key: string, checked: boolean) {
  const next = new Set(form.permissions)
  if (checked) {
    next.add(key)
    if (key.endsWith(':write')) next.add(`${key.slice(0, -':write'.length)}:read`)
  } else {
    next.delete(key)
    if (key.endsWith(':read')) next.delete(`${key.slice(0, -':read'.length)}:write`)
  }
  form.permissions = [...next]
}
const columns = preventTableColumnCompression<ManagedUser>([
  {
    title: '用户',
    key: 'user',
    width: 240,
    render: (r) =>
      h('div', { class: 'user-cell' }, [
        h('div', { class: 'user-name-row' }, [
          h('span', { class: 'user-name' }, r.display_name || r.username),
        ]),
        h('div', { class: 'user-username' }, `@${r.username}`),
      ]),
  },
  {
    title: '部门',
    key: 'department_name',
    width: 160,
    ellipsis: { tooltip: true },
    render: (r) => r.department_name || '—',
  },
  {
    title: '最近登录',
    key: 'last_used_at',
    width: 156,
    render: (r) => formatShanghaiTime(r.last_used_at ?? undefined),
  },
  {
    title: '首次登录',
    key: 'created_at',
    width: 156,
    render: (r) => formatShanghaiTime(r.created_at),
  },
  {
    title: '小程序绑定',
    key: 'wechat_binding',
    width: 116,
    render: (r) =>
      r.wechat_openid
        ? h(
            NTooltip,
            { trigger: 'hover' },
            {
              trigger: () =>
                h(
                  NTag,
                  { size: 'small', type: 'success', round: true },
                  { default: () => '已绑定' },
                ),
              default: () => `OpenID：${r.wechat_openid}`,
            },
          )
        : h(NTag, { size: 'small', round: true, bordered: false }, { default: () => '未绑定' }),
  },
  {
    title: '权限',
    key: 'permissions',
    width: 100,
    render: (r) => {
      const count = r.permissions?.length ?? 0
      return h(
        NTag,
        { size: 'small', round: true, bordered: false, type: count > 0 ? 'info' : 'default' },
        { default: () => `${count} 项权限` },
      )
    },
  },
  {
    title: '状态',
    key: 'enabled',
    width: 80,
    render: (r) =>
      h(
        NTag,
        { size: 'small', type: r.enabled ? 'success' : 'default' },
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
          permissions: [...(row.permissions ?? [])],
          enabled: row.enabled,
          password: '',
          version: row.version,
        }
      : {
          username: '',
          display_name: '',
          department_name: '',
          permissions: [...defaultPermissions.value],
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
      permissions: form.permissions,
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
        <div class="title-row">
          <h1 class="page-title">用户管理</h1>
          <n-tag round size="small" type="info">{{ items.length }} 位</n-tag>
          <n-tag
            round
            size="small"
            :type="items.length > 0 && boundCount === items.length ? 'success' : 'default'"
          >
            已绑定小程序 {{ boundCount }} 位
          </n-tag>
        </div>
      </div>
      <div class="page-actions">
        <n-button type="primary" @click="open()">新建用户</n-button>
      </div>
    </div>
    <n-card class="data-card"
      ><PersistentDataTable
        storage-key="settings/users"
        class="compact-table"
        size="small"
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
      class="user-edit-modal"
      :title="editing ? '用户详情' : '新建用户'"
      style="width: min(660px, calc(100vw - 32px))"
      ><n-form label-placement="left" label-width="84" size="small" :show-feedback="false"
        ><div class="form-grid-2">
          <n-form-item label="用户名" required
            ><n-input v-model:value="form.username" /></n-form-item
          ><n-form-item label="显示名称" required
            ><n-input v-model:value="form.display_name"
          /></n-form-item>
        </div>
        <div class="form-grid-2">
          <n-form-item label="部门单位"
            ><n-input v-model:value="form.department_name" /></n-form-item
          ><n-form-item label="账号状态">
            <div class="status-control">
              <n-switch v-model:value="form.enabled" size="small" />
              <span>{{ form.enabled ? '启用' : '停用' }}</span>
            </div></n-form-item
          >
        </div>
        <n-form-item v-if="!editing" label="初始密码" required
          ><n-input v-model:value="form.password" type="password" show-password-on="click"
        /></n-form-item>
        <div v-if="editing" class="login-strip">
          <div class="login-item login-item--openid">
            <span class="login-label">OpenID</span>
            <span class="login-value login-mono" :title="editing.wechat_openid || ''">
              {{ editing.wechat_openid || '—' }}
            </span>
          </div>
          <div class="login-item">
            <span class="login-label">首次登录</span>
            <span class="login-value">{{ formatShanghaiTime(editing.created_at) }}</span>
          </div>
          <div class="login-item">
            <span class="login-label">最近登录</span>
            <span class="login-value">{{
              formatShanghaiTime(editing.last_used_at ?? undefined)
            }}</span>
          </div>
        </div>
        <div class="form-section">
          <div class="section-title">权限</div>
          <div class="permission-grid">
            <div v-for="group in permissionGroups" :key="group.module" class="permission-group">
              <div class="permission-group-label">{{ group.label }}</div>
              <div class="permission-group-items">
                <n-checkbox
                  v-for="item in group.items"
                  :key="item.key"
                  size="small"
                  :checked="form.permissions.includes(item.key)"
                  :label="permissionItemLabel(item)"
                  @update:checked="togglePermission(item.key, $event)"
                />
              </div>
            </div>
          </div>
        </div>
        <div v-if="editing" class="form-section">
          <div class="section-title">安全与接入</div>
          <n-form-item label="重置密码"
            ><n-input
              v-model:value="form.password"
              type="password"
              show-password-on="click"
              placeholder="留空表示不修改" /></n-form-item
          ><n-form-item label="接口令牌"
            ><n-input-group>
              <n-input
                :value="
                  editing.api_token ??
                  '（旧版令牌将在其下次接口调用后自动回显；点击重新生成立即可见）'
                "
                readonly
              />
              <n-button size="small" :disabled="!editing.api_token" @click="copyApiToken"
                >复制</n-button
              ><n-button size="small" @click="regenerateApiToken">重新生成</n-button></n-input-group
            ></n-form-item
          ><n-form-item label="MCP 地址"
            ><n-input-group>
              <n-input :value="mcpUrl || '（接口令牌回显后可复制 MCP 地址）'" readonly />
              <n-button
                size="small"
                type="primary"
                secondary
                :disabled="!mcpUrl"
                @click="copyMcpUrl"
                >复制</n-button
              ></n-input-group
            ></n-form-item
          >
        </div></n-form
      ><template #header-extra>
        <n-tag
          v-if="editing"
          :type="editing.wechat_openid ? 'success' : 'default'"
          size="small"
          round
        >
          {{ editing.wechat_openid ? '小程序已绑定' : '未绑定小程序' }}
        </n-tag> </template
      ><template #footer
        ><n-space justify="space-between" style="width: 100%"
          ><n-space v-if="editing"
            ><n-button size="small" type="error" secondary @click="remove(editing)">删除</n-button
            ><n-button size="small" secondary @click="openMerge(editing)"
              >合并账号</n-button
            ></n-space
          ><n-space justify="end"
            ><n-button size="small" @click="show = false">取消</n-button
            ><n-button size="small" type="primary" @click="save">保存</n-button></n-space
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
            <div class="merge-target-name">
              {{ editing?.display_name }}（{{ editing?.username }}）
            </div>
            <div class="merge-target-roles">
              <n-tag
                v-for="tag in permissionTags(editing?.permissions)"
                :key="tag.label"
                size="small"
                :type="tag.type"
                bordered
                round
                >{{ tag.label }}</n-tag
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
                  label: `${item.display_name}（${item.username}）`,
                }))
            " /></n-form-item
        ><n-alert v-if="mergeSource" type="warning" :show-icon="true"
          >将把「{{
            mergeSource.display_name
          }}」的微信身份并入目标账号，权限位取两个账号的并集；来源账号随后删除。</n-alert
        ></n-form
      ><template #footer
        ><n-space justify="end"
          ><n-button @click="closeMerge">取消</n-button
          ><n-button type="primary" :loading="merging" @click="saveMerge"
            >确认合并</n-button
          ></n-space
        ></template
      ></n-modal
    >
  </div>
</template>

<style scoped>
/* 紧凑版式：用户格两行（姓名 + 用户名），单元格上下留白压到 6px，一屏能多看三成行。 */
.title-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}
.compact-table :deep(.n-data-table-th),
.compact-table :deep(.n-data-table-td) {
  padding-top: 8px;
  padding-bottom: 8px;
}
.user-cell {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}
.user-name-row {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}
.user-name {
  overflow: hidden;
  color: var(--color-text-strong);
  font-size: 13px;
  font-weight: 600;
  line-height: 1.35;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.user-username {
  overflow: hidden;
  color: var(--color-text-muted);
  font-size: 11px;
  line-height: 1.25;
  text-overflow: ellipsis;
  white-space: nowrap;
}
/* ===== 用户详情弹窗：左标签 + 双列 + 小控件，整体高度压到一屏内 ===== */
.form-grid-2 {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0 18px;
}
.status-control {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--color-text);
  font-size: 13px;
}
/* 登录信息：浅底三列，避免一行小字挤在输入框下面 */
.login-strip {
  display: grid;
  grid-template-columns: 1.5fr 1fr 1fr;
  gap: 6px 14px;
  margin: 2px 0 0;
  padding: 8px 12px;
  border-radius: 10px;
  background: var(--color-panel);
}
.login-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.login-label {
  color: var(--color-text-muted);
  font-size: 11px;
}
.login-value {
  color: var(--color-text);
  font-size: 12px;
  line-height: 1.4;
}
.login-item--openid .login-value {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.login-mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 11px;
}
/* 分区：细分割线 + 小标题，给权限 / 安全区留出呼吸感 */
.form-section {
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px solid var(--color-border-subtle);
}
.section-title {
  margin-bottom: 8px;
  color: var(--color-text-strong);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.02em;
}
.permission-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px 8px;
}
.permission-group {
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 30px;
  padding: 4px 8px;
  border-radius: 8px;
  background: var(--color-panel);
}
.permission-group-label {
  flex: none;
  width: 64px;
  color: var(--color-text-strong);
  font-size: 12px;
  font-weight: 600;
}
.permission-group-items {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 12px;
}
@media (max-width: 560px) {
  .form-grid-2 {
    grid-template-columns: minmax(0, 1fr);
  }
  .permission-grid {
    grid-template-columns: minmax(0, 1fr);
  }
  .login-strip {
    grid-template-columns: minmax(0, 1fr);
  }
}
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
