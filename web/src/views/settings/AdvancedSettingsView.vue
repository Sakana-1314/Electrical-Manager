<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useMessage } from 'naive-ui'
import type { PermissionRead } from '@/api/generated'
import { permissionApi } from '@/api/dictionaries'
import { systemSettingsApi } from '@/api/systemSettings'
import LoadingMask from '@/components/LoadingMask.vue'

const message = useMessage()
const loading = ref(false)
const saving = ref(false)
const permissionOptions = ref<PermissionRead[]>([])
const MODULE_LABELS: Record<string, string> = {
  system: '系统管理',
  warehouse: '二级库',
  lite: '二级库',
  purchase: '申购',
  huaxing: '华星总库存',
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
const form = reactive({
  mini_program_registration_enabled: true,
  default_permissions: [] as string[],
  version: 0,
})

async function load() {
  loading.value = true
  try {
    const [data, permissions] = await Promise.all([
      systemSettingsApi.advancedSettings(),
      permissionApi.list(),
    ])
    permissionOptions.value = permissions
    form.mini_program_registration_enabled = data.mini_program_registration_enabled
    form.default_permissions = [...data.default_permissions]
    form.version = data.version
  } catch (error) {
    message.error(error instanceof Error ? error.message : '加载配置失败')
  } finally {
    loading.value = false
  }
}

/** 默认权限勾选：写权限自动带上同模块读权限；取消读权限时同时取消写权限。 */
function togglePermission(key: string, checked: boolean) {
  const next = new Set(form.default_permissions)
  if (checked) {
    next.add(key)
    if (key.endsWith(':write')) next.add(`${key.slice(0, -':write'.length)}:read`)
  } else {
    next.delete(key)
    if (key.endsWith(':read')) next.delete(`${key.slice(0, -':read'.length)}:write`)
  }
  form.default_permissions = [...next]
}

async function save() {
  saving.value = true
  try {
    const data = await systemSettingsApi.updateAdvancedSettings({
      mini_program_registration_enabled: form.mini_program_registration_enabled,
      default_permissions: form.default_permissions,
      version: form.version,
    })
    form.version = data.version
    message.success('高级设置已保存')
    // 权限目录影响侧栏 / 用户管理，保存后整页刷新立即生效。
    window.setTimeout(() => window.location.reload(), 600)
  } catch (error) {
    message.error(error instanceof Error ? error.message : '保存失败')
  } finally {
    saving.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="page advanced-settings-page">
    <div class="page-header settings-header">
      <h1 class="page-title">高级设置</h1>
      <n-button type="primary" :loading="saving" :disabled="loading" @click="save">
        保存配置
      </n-button>
    </div>

    <div class="settings-grid">
      <LoadingMask :show="loading" text="加载中…" />
      <n-card class="settings-card" title="小程序注册" :bordered="false">
        <n-form label-placement="left" label-width="160">
          <n-form-item label="新用户绑定">
            <div class="switch-control">
              <n-switch v-model:value="form.mini_program_registration_enabled" />
              <span>{{ form.mini_program_registration_enabled ? '允许' : '关闭' }}</span>
            </div>
          </n-form-item>
        </n-form>
      </n-card>

      <n-card class="settings-card" title="默认用户权限" :bordered="false">
        <div class="permission-grid">
          <div v-for="group in permissionGroups" :key="group.module" class="permission-group">
            <div class="permission-group-label">{{ group.label }}</div>
            <div class="permission-group-items">
              <n-checkbox
                v-for="item in group.items"
                :key="item.key"
                :checked="form.default_permissions.includes(item.key)"
                :label="permissionItemLabel(item)"
                @update:checked="togglePermission(item.key, $event)"
              />
            </div>
          </div>
        </div>
      </n-card>
    </div>
  </div>
</template>

<style scoped>
.advanced-settings-page {
  max-width: 860px;
}

.settings-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
}

.settings-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 18px;
  /* 作为局部加载遮罩（LoadingMask）的定位上下文 */
  position: relative;
}

.settings-card {
  border: 1px solid var(--color-border-subtle);
  border-radius: 14px;
  box-shadow: 0 10px 28px rgb(30 64 175 / 5%);
}

.switch-control {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  color: var(--color-text);
  font-size: 13px;
}

.permission-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px 18px;
  width: 100%;
}

.permission-group {
  display: flex;
  align-items: baseline;
  gap: 10px;
  min-width: 0;
  padding: 6px 10px;
  border: 1px solid var(--color-border-subtle);
  border-radius: 8px;
}

.permission-group-label {
  flex: none;
  width: 74px;
  color: var(--color-text-strong);
  font-size: 13px;
  font-weight: 600;
}

.permission-group-items {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 14px;
}

@media (max-width: 900px) {
  .permission-grid {
    grid-template-columns: 1fr;
  }
}

:deep(.n-card-header) {
  padding: 20px 22px 14px;
}

:deep(.n-card__content) {
  padding: 12px 22px 20px;
}

:deep(.n-form-item:last-child) {
  margin-bottom: 0;
}
</style>
