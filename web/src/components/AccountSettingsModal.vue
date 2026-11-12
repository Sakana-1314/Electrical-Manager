<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useMessage } from 'naive-ui'
import { authApi } from '@/api/auth'
import { activeBackendUrl } from '@/api/backend'
import type { UserApiTokenRead } from '@/api/generated'
import { resolveMcpUrl } from '@/config/env'
import { useAuthStore } from '@/stores/auth'
import { useProjectStore } from '@/stores/project'

const props = defineProps<{ show: boolean }>()
const emit = defineEmits<{ 'update:show': [value: boolean] }>()

const auth = useAuthStore()
const project = useProjectStore()
const message = useMessage()

const visible = computed({
  get: () => props.show,
  set: (value: boolean) => emit('update:show', value),
})
const tokenInfo = ref<UserApiTokenRead | null>(null)
const loadingToken = ref(false)
const saving = ref(false)
const form = reactive({
  current_password: '',
  new_password: '',
  confirm_password: '',
})
const user = computed(() => auth.user)
const mcpUrl = computed(() => {
  const token = tokenInfo.value?.api_token
  if (!token) return ''
  return resolveMcpUrl(activeBackendUrl(), token, project.currentProjectId)
})
const tokenText = computed(() => {
  if (tokenInfo.value?.api_token) return tokenInfo.value.api_token
  if (loadingToken.value) return '正在加载…'
  return tokenInfo.value ? '（旧版令牌无法回显，请联系管理员重新生成）' : '（暂不可用）'
})

function resetPasswordForm() {
  form.current_password = ''
  form.new_password = ''
  form.confirm_password = ''
}

async function loadToken() {
  loadingToken.value = true
  try {
    tokenInfo.value = await authApi.myApiToken()
  } catch (error) {
    message.error(error instanceof Error ? error.message : 'MCP 令牌加载失败')
  } finally {
    loadingToken.value = false
  }
}

async function copy(value: string, label: string) {
  if (!value) return
  try {
    await navigator.clipboard.writeText(value)
    message.success(`${label}已复制`)
  } catch {
    message.error(`复制失败，请手动选择${label}`)
  }
}

async function savePassword() {
  if (!form.new_password || form.new_password.length < 6) {
    message.error('新密码至少 6 位')
    return
  }
  if (form.new_password !== form.confirm_password) {
    message.error('两次输入的新密码不一致')
    return
  }
  saving.value = true
  try {
    await authApi.changeMyPassword({
      ...(form.current_password ? { current_password: form.current_password } : {}),
      new_password: form.new_password,
    })
    resetPasswordForm()
    message.success('密码已修改，下次登录请使用新密码')
    void auth.refresh().catch(() => undefined)
  } catch (error) {
    message.error(error instanceof Error ? error.message : '密码修改失败')
  } finally {
    saving.value = false
  }
}

watch(
  () => props.show,
  (show) => {
    if (!show) {
      tokenInfo.value = null
      resetPasswordForm()
      return
    }
    resetPasswordForm()
    void loadToken()
  },
)
</script>

<template>
  <n-modal
    v-model:show="visible"
    preset="card"
    title="用户设置"
    style="width: min(540px, calc(100vw - 32px))"
  >
    <n-form label-placement="top">
      <n-form-item label="账号">
        <div class="account-summary">
          <span class="account-name">{{ user?.display_name || user?.username || '—' }}</span>
          <span class="account-meta">
            @{{ user?.username || '—' }}
            <template v-if="user?.department_name"> · {{ user.department_name }}</template>
          </span>
          <span class="account-hint">个人资料由管理员维护，这里只能修改密码。</span>
        </div>
      </n-form-item>
      <n-form-item label="MCP 地址">
        <n-input-group>
          <n-input :value="mcpUrl || '（令牌加载后生成）'" readonly />
          <n-button :disabled="!mcpUrl" @click="copy(mcpUrl, 'MCP 地址')">复制地址</n-button>
        </n-input-group>
      </n-form-item>
      <n-form-item label="MCP 令牌">
        <n-input-group>
          <n-input :value="tokenText" readonly />
          <n-button
            :disabled="!tokenInfo?.api_token"
            @click="copy(tokenInfo?.api_token ?? '', 'MCP 令牌')"
          >
            复制令牌
          </n-button>
        </n-input-group>
      </n-form-item>
      <p class="token-hint">MCP 地址已包含令牌，请勿公开分享；令牌仅供本人使用。</p>
      <n-divider />
      <div class="section-title">修改密码</div>
      <n-form-item label="当前密码">
        <n-input
          v-model:value="form.current_password"
          type="password"
          show-password-on="click"
          placeholder="未设置过密码的账号可留空"
        />
      </n-form-item>
      <n-form-item label="新密码">
        <n-input
          v-model:value="form.new_password"
          type="password"
          show-password-on="click"
          placeholder="至少 6 位"
        />
      </n-form-item>
      <n-form-item label="确认新密码">
        <n-input
          v-model:value="form.confirm_password"
          type="password"
          show-password-on="click"
          placeholder="再次输入新密码"
        />
      </n-form-item>
    </n-form>
    <template #footer>
      <n-space justify="end">
        <n-button @click="visible = false">关闭</n-button>
        <n-button type="primary" :loading="saving" @click="savePassword">修改密码</n-button>
      </n-space>
    </template>
  </n-modal>
</template>

<style scoped>
.account-summary {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.account-name {
  color: var(--color-text-strong);
  font-size: 14px;
  font-weight: 600;
}
.account-meta {
  color: var(--color-text-muted);
  font-size: 12px;
  word-break: break-all;
}
.account-hint {
  margin-top: 2px;
  color: var(--color-text-muted);
  font-size: 12px;
}
.token-hint {
  margin: -4px 0 0;
  color: var(--color-text-muted);
  font-size: 12px;
}
.section-title {
  margin-bottom: 4px;
  color: var(--color-text-strong);
  font-size: 13px;
  font-weight: 600;
}
</style>
