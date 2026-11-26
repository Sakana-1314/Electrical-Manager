<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useMessage } from 'naive-ui'
import type { PermissionRead } from '@/api/generated'
import { permissionApi } from '@/api/dictionaries'
import { systemSettingsApi } from '@/api/systemSettings'
import LoadingMask from '@/components/LoadingMask.vue'
import PermissionMatrix from '@/components/PermissionMatrix.vue'

const message = useMessage()
const loading = ref(false)
const saving = ref(false)
const permissionOptions = ref<PermissionRead[]>([])
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
    <div class="page-header">
      <div class="page-actions">
        <n-button type="primary" :loading="saving" :disabled="loading" @click="save">
          保存配置
        </n-button>
      </div>
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
        <PermissionMatrix v-model="form.default_permissions" :options="permissionOptions" />
      </n-card>
    </div>
  </div>
</template>

<style scoped>
.advanced-settings-page {
  max-width: 860px;
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
</style>
