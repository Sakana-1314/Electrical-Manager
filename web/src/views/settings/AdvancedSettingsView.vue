<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useMessage } from 'naive-ui'
import { aiSearchApi } from '@/api/aiSearch'
import { systemSettingsApi } from '@/api/systemSettings'
import LoadingMask from '@/components/LoadingMask.vue'
import type { SecondaryWarehouseMode, WebhookEventType, WebhookPlatform } from '@/api/generated'

const message = useMessage()
const loading = ref(false)
const saving = ref(false)
const testing = ref(false)
const testingWebhook = ref<WebhookPlatform | null>(null)
const webhookEventOptions: Array<{ label: string; value: WebhookEventType }> = [
  { label: '出库事件', value: 'stock.outbound.created' },
  { label: '入库事件', value: 'stock.inbound.created' },
  { label: '新用户绑定事件', value: 'mini_program.user.bound' },
]
const webhookPlatforms: WebhookPlatform[] = ['FEISHU', 'DINGTALK']
const codeEnvOptions = [
  { label: '体验版', value: 'trial' },
  { label: '正式版', value: 'release' },
]
const secondaryWarehouseModeOptions: Array<{ label: string; value: SecondaryWarehouseMode }> = [
  { label: '完整模式', value: 'full' },
  { label: '精简模式', value: 'lite' },
]
const form = reactive({
  endpoint: '',
  api_key: '',
  model: '',
  enabled: true,
  mini_program_code_env: 'release' as 'trial' | 'release',
  mini_program_code_app_id: '',
  mini_program_app_ids: [] as string[],
  mini_program_registration_enabled: true,
  mini_program_new_user_enabled: true,
  image_acceleration_server_url: '',
  secondary_warehouse_mode: 'full' as SecondaryWarehouseMode,
  version: 0,
})
const miniProgramAppOptions = computed(() =>
  form.mini_program_app_ids.map((appId) => ({ label: appId, value: appId })),
)
interface WebhookChannelForm {
  platform: WebhookPlatform
  enabled: boolean
  webhook_url: string
  secret: string
  subscribed_events: WebhookEventType[]
  webhook_configured: boolean
  secret_configured: boolean
  version: number
}
const webhookForms = reactive<Record<WebhookPlatform, WebhookChannelForm>>({
  FEISHU: {
    platform: 'FEISHU',
    enabled: false,
    webhook_url: '',
    secret: '',
    subscribed_events: [],
    webhook_configured: false,
    secret_configured: false,
    version: 0,
  },
  DINGTALK: {
    platform: 'DINGTALK',
    enabled: false,
    webhook_url: '',
    secret: '',
    subscribed_events: [],
    webhook_configured: false,
    secret_configured: false,
    version: 0,
  },
})

function platformName(platform: WebhookPlatform) {
  return platform === 'FEISHU' ? '飞书' : '钉钉'
}

async function load() {
  loading.value = true
  try {
    const [data, webhookChannels] = await Promise.all([
      aiSearchApi.settings(),
      systemSettingsApi.webhooks(),
    ])
    Object.assign(form, data)
    for (const channel of webhookChannels) {
      Object.assign(webhookForms[channel.platform], channel)
    }
  } catch (error) {
    message.error(error instanceof Error ? error.message : '加载配置失败')
  } finally {
    loading.value = false
  }
}

async function save() {
  if (form.enabled && (!form.endpoint.trim() || !form.model.trim() || !form.api_key.trim())) {
    message.error('请填写端点、模型和 API Key')
    return
  }
  for (const platform of webhookPlatforms) {
    const channel = webhookForms[platform]
    if (channel.enabled && !channel.webhook_url.trim()) {
      message.error(`请填写${platformName(platform)} Webhook 地址`)
      return
    }
    if (channel.enabled && channel.subscribed_events.length === 0) {
      message.error(`请至少选择一个${platformName(platform)}推送事件`)
      return
    }
  }
  saving.value = true
  try {
    const data = await aiSearchApi.updateSettings({
      endpoint: form.endpoint.trim(),
      api_key: form.api_key.trim(),
      model: form.model.trim(),
      enabled: form.enabled,
      mini_program_code_env: form.mini_program_code_env,
      mini_program_code_app_id: form.mini_program_code_app_id,
      mini_program_registration_enabled: form.mini_program_registration_enabled,
      mini_program_new_user_enabled: form.mini_program_new_user_enabled,
      image_acceleration_server_url: form.image_acceleration_server_url.trim(),
      secondary_warehouse_mode: form.secondary_warehouse_mode,
      version: form.version,
    })
    Object.assign(form, data)
    const webhookResults = await Promise.all(
      webhookPlatforms.map((platform) => {
        const channel = webhookForms[platform]
        return systemSettingsApi.updateWebhook(platform, {
          enabled: channel.enabled,
          webhook_url: channel.webhook_url.trim(),
          secret: channel.secret.trim(),
          subscribed_events: channel.subscribed_events,
          version: channel.version,
        })
      }),
    )
    for (const channel of webhookResults) {
      Object.assign(webhookForms[channel.platform], channel)
    }
    message.success('高级设置已保存')
    // 二级库模式等系统级配置在应用启动时读取，保存后强制刷新页面以立即生效（菜单/路由按模式切换）。
    window.setTimeout(() => window.location.reload(), 600)
  } catch (error) {
    message.error(error instanceof Error ? error.message : '保存失败')
  } finally {
    saving.value = false
  }
}

async function testWebhook(platform: WebhookPlatform) {
  const channel = webhookForms[platform]
  if (!channel.webhook_url.trim()) {
    message.error(`请填写${platformName(platform)} Webhook 地址`)
    return
  }
  testingWebhook.value = platform
  try {
    const result = await systemSettingsApi.testWebhook(platform, {
      webhook_url: channel.webhook_url.trim(),
      secret: channel.secret.trim(),
    })
    message.success(result.message)
  } catch (error) {
    message.error(error instanceof Error ? error.message : '测试推送失败')
  } finally {
    testingWebhook.value = null
  }
}

async function testModel() {
  if (!form.endpoint.trim() || !form.model.trim() || !form.api_key.trim()) {
    message.error('请填写端点、模型和 API Key')
    return
  }
  testing.value = true
  try {
    const result = await aiSearchApi.testSettings({
      endpoint: form.endpoint.trim(),
      api_key: form.api_key.trim(),
      model: form.model.trim(),
    })
    message.success(`模型连接正常：${result.original} → ${result.expanded}`)
  } catch (error) {
    message.error(error instanceof Error ? error.message : '模型连接失败')
  } finally {
    testing.value = false
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
      <n-card class="settings-card model-card" title="模型服务" :bordered="false">
        <template #header-extra>
          <div class="switch-control">
            <span>{{ form.enabled ? '已启用' : '已停用' }}</span>
            <n-switch v-model:value="form.enabled" />
          </div>
        </template>
        <n-form label-placement="top">
          <div class="model-fields">
            <n-form-item label="兼容端点" :required="form.enabled">
              <n-input
                v-model:value="form.endpoint"
                placeholder="https://api.openai.com/v1"
                :disabled="!form.enabled"
              />
            </n-form-item>
            <n-form-item label="模型" :required="form.enabled">
              <n-input
                v-model:value="form.model"
                placeholder="gpt-4.1-mini"
                :disabled="!form.enabled"
              />
            </n-form-item>
            <n-form-item class="api-key-field" label="API Key" :required="form.enabled">
              <n-input
                v-model:value="form.api_key"
                type="password"
                show-password-on="click"
                placeholder="请输入 API Key"
                autocomplete="off"
                :disabled="!form.enabled"
              />
            </n-form-item>
          </div>
          <div class="model-actions">
            <n-button secondary :loading="testing" :disabled="loading" @click="testModel">
              测试模型
            </n-button>
          </div>
        </n-form>
      </n-card>

      <n-card class="settings-card" title="小程序" :bordered="false">
        <n-form label-placement="left" label-width="132">
          <n-form-item label="小程序码应用">
            <n-select
              v-model:value="form.mini_program_code_app_id"
              :options="miniProgramAppOptions"
              :disabled="miniProgramAppOptions.length === 0"
              :placeholder="
                miniProgramAppOptions.length === 0 ? '未配置小程序 AppID' : '请选择小程序'
              "
            />
          </n-form-item>
          <n-form-item label="小程序码版本">
            <n-select v-model:value="form.mini_program_code_env" :options="codeEnvOptions" />
          </n-form-item>
          <n-form-item label="新用户绑定">
            <div class="switch-control">
              <n-switch v-model:value="form.mini_program_registration_enabled" />
              <span>{{ form.mini_program_registration_enabled ? '允许' : '关闭' }}</span>
            </div>
          </n-form-item>
          <n-form-item label="新用户默认状态">
            <div class="switch-control">
              <n-switch v-model:value="form.mini_program_new_user_enabled" />
              <span>{{
                form.mini_program_new_user_enabled
                  ? '默认只读（各功能查看权限）'
                  : '默认禁用（待管理员审核启用）'
              }}</span>
            </div>
          </n-form-item>
        </n-form>
      </n-card>

      <n-card class="settings-card image-card" title="图片加速" :bordered="false">
        <n-form label-placement="left" label-width="132">
          <n-form-item label="加速服务器地址">
            <n-input
              v-model:value="form.image_acceleration_server_url"
              placeholder="http://192.168.1.10"
              clearable
            />
          </n-form-item>
        </n-form>
      </n-card>

      <n-card class="settings-card feature-status-card" title="二级库运行模式" :bordered="false">
        <n-form label-placement="left" label-width="132">
          <n-form-item label="运行模式">
            <n-select
              v-model:value="form.secondary_warehouse_mode"
              :options="secondaryWarehouseModeOptions"
            />
          </n-form-item>
          <p class="feature-hint">
            完整模式提供物资 / 出入库 / 流水；精简模式只提供 Excel
            导入与只读查询，小程序同步禁用出库。
            功能是否展示与可写由「用户管理」里的权限位决定，不再有功能开关配置。
          </p>
        </n-form>
      </n-card>

      <n-card class="settings-card webhook-card" title="Webhook 事件推送" :bordered="false">
        <div class="webhook-platforms">
          <section v-for="platform in webhookPlatforms" :key="platform" class="webhook-platform">
            <div class="webhook-platform-header">
              <h2>{{ platformName(platform) }}</h2>
              <div class="switch-control">
                <span>{{ webhookForms[platform].enabled ? '已启用' : '已停用' }}</span>
                <n-switch v-model:value="webhookForms[platform].enabled" />
              </div>
            </div>
            <n-form label-placement="top">
              <n-form-item label="Webhook 地址" :required="webhookForms[platform].enabled">
                <n-input
                  v-model:value="webhookForms[platform].webhook_url"
                  type="password"
                  show-password-on="click"
                  :placeholder="`请输入${platformName(platform)}机器人 Webhook 地址`"
                  autocomplete="off"
                />
              </n-form-item>
              <n-form-item label="签名密钥">
                <n-input
                  v-model:value="webhookForms[platform].secret"
                  type="password"
                  show-password-on="click"
                  placeholder="可选，建议开启机器人签名校验"
                  autocomplete="off"
                />
              </n-form-item>
              <n-form-item label="推送事件" :required="webhookForms[platform].enabled">
                <n-checkbox-group v-model:value="webhookForms[platform].subscribed_events">
                  <n-space>
                    <n-checkbox
                      v-for="option in webhookEventOptions"
                      :key="option.value"
                      :value="option.value"
                      :label="option.label"
                    />
                  </n-space>
                </n-checkbox-group>
              </n-form-item>
              <div class="webhook-actions">
                <n-button
                  secondary
                  :loading="testingWebhook === platform"
                  :disabled="saving || !webhookForms[platform].webhook_url.trim()"
                  @click="testWebhook(platform)"
                >
                  测试推送
                </n-button>
              </div>
            </n-form>
          </section>
        </div>
      </n-card>
    </div>
  </div>
</template>

<style scoped>
.advanced-settings-page {
  max-width: 1180px;
}

.settings-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
}

.settings-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.7fr) minmax(300px, 1fr);
  gap: 18px;
  /* 作为局部加载遮罩（LoadingMask）的定位上下文 */
  position: relative;
}

.settings-card {
  border: 1px solid var(--color-border-subtle);
  border-radius: 14px;
  box-shadow: 0 10px 28px rgb(30 64 175 / 5%);
}

/* 图片加速：单行配置独占整行（自己不跨列，也不去凑别的高度） */
.image-card {
  grid-column: 1 / -1;
}

.image-card :deep(.n-input) {
  max-width: 520px;
}

/* 二级库运行模式：单卡片横跨整行，说明文字跟在表单下面 */
.feature-status-card {
  grid-column: 1 / -1;
}

.feature-hint {
  max-width: 720px;
  margin: 0;
  color: var(--color-text-muted);
  font-size: 12px;
  line-height: 1.6;
}

.webhook-card {
  grid-column: 1 / -1;
}

.webhook-platforms {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0;
  border: 1px solid var(--color-border-subtle);
  border-radius: 8px;
  overflow: hidden;
}

.webhook-platform {
  padding: 18px 20px;
}

.webhook-platform + .webhook-platform {
  border-left: 1px solid var(--color-border-subtle);
}

.webhook-platform-header,
.webhook-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.webhook-platform-header {
  margin-bottom: 16px;
}

.webhook-platform-header h2 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.webhook-actions {
  justify-content: flex-end;
}

.model-fields {
  display: grid;
  grid-template-columns: minmax(0, 1.6fr) minmax(180px, 0.8fr);
  gap: 4px 18px;
}

.api-key-field {
  grid-column: 1 / -1;
}

.model-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 8px;
}

.switch-control {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  color: var(--color-text);
  font-size: 13px;
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

@media (max-width: 900px) {
  .settings-grid {
    grid-template-columns: 1fr;
  }

  .webhook-platforms {
    grid-template-columns: 1fr;
  }

  .webhook-platform + .webhook-platform {
    border-top: 1px solid var(--color-border-subtle);
    border-left: 0;
  }
}

@media (max-width: 640px) {
  .model-fields {
    grid-template-columns: 1fr;
  }

  .api-key-field {
    grid-column: auto;
  }
}
</style>
