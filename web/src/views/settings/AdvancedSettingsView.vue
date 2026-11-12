<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useMessage } from 'naive-ui'
import { systemSettingsApi } from '@/api/systemSettings'
import LoadingMask from '@/components/LoadingMask.vue'

const message = useMessage()
const loading = ref(false)
const saving = ref(false)
const form = reactive({
  mini_program_registration_enabled: true,
  mini_program_new_user_enabled: true,
  secondary_warehouse_lite: false,
  version: 0,
})
// 服务端仍用 full / lite 枚举，页面只暴露一个「精简模式」开关。
const secondaryWarehouseMode = computed(() => (form.secondary_warehouse_lite ? 'lite' : 'full'))

async function load() {
  loading.value = true
  try {
    const data = await systemSettingsApi.advancedSettings()
    form.mini_program_registration_enabled = data.mini_program_registration_enabled
    form.mini_program_new_user_enabled = data.mini_program_new_user_enabled
    form.secondary_warehouse_lite = data.secondary_warehouse_mode === 'lite'
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
      mini_program_new_user_enabled: form.mini_program_new_user_enabled,
      secondary_warehouse_mode: secondaryWarehouseMode.value,
      version: form.version,
    })
    form.secondary_warehouse_lite = data.secondary_warehouse_mode === 'lite'
    form.version = data.version
    message.success('高级设置已保存')
    // 二级库模式影响侧栏 / 路由与小程序，保存后整页刷新立即生效。
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
          <n-form-item label="新用户默认状态">
            <div class="switch-control">
              <n-switch v-model:value="form.mini_program_new_user_enabled" />
              <span>
                {{
                  form.mini_program_new_user_enabled
                    ? '默认启用（各功能只读权限）'
                    : '默认禁用（待管理员审核）'
                }}
              </span>
            </div>
          </n-form-item>
        </n-form>
      </n-card>

      <n-card class="settings-card" title="二级库运行模式" :bordered="false">
        <n-form label-placement="left" label-width="160">
          <n-form-item label="使用精简模式">
            <div class="switch-control">
              <n-switch v-model:value="form.secondary_warehouse_lite" />
              <span>{{ form.secondary_warehouse_lite ? '精简模式' : '完整模式' }}</span>
            </div>
          </n-form-item>
          <p class="settings-hint">
            完整模式提供物资 / 出入库 / 流水；精简模式只提供 Excel
            导入与只读查询，小程序同步禁用出库。
          </p>
        </n-form>
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

.settings-hint {
  max-width: 680px;
  margin: 0;
  color: var(--color-text-muted);
  font-size: 12px;
  line-height: 1.6;
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
