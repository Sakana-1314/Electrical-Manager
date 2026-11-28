<script setup lang="ts">
import { onBeforeUnmount, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useMessage, type FormInst, type FormRules } from 'naive-ui'
import { useAuthStore } from '@/stores/auth'
import { authApi } from '@/api/auth'
import { resolveLandingRouteName } from '@/utils/navigation'
import { LOGO_URL } from '@/constants/branding'
import { activeBackendUrl } from '@/api/backend'
import { deliverSession, handoffRequest, type HandoffRequest } from '@/utils/userscriptHandoff'

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()
const message = useMessage()
const formRef = ref<FormInst | null>(null)
const loading = ref(false)
const model = reactive({ username: '', password: '' })
/**
 * 油猴脚本的交接模式：`?userscript=1&origin=…&nonce=…` 且来源在白名单里。
 * 有值时登录成功不跳转，改为等待用户点「授权」，由本页把登录态 postMessage 回脚本窗口。
 */
const handoff = ref<HandoffRequest | null>(handoffRequest(route.query))
const handoffDelivered = ref(false)
const handoffFailed = ref('')
const pendingSession = ref<{ accessToken: string } | null>(null)

/**
 * 交接模式下浏览器已有登录态（弹窗与本系统同源，共用 localStorage）：直接进授权面板，
 * 不必再登一次。判据是本地令牌而不是 `isAuthenticated`：缓存里的用户快照可能缺失
 * （比如换了发版、权限位新增），此时先按 /auth/me 补齐再进授权面板。
 */
if (handoff.value && auth.token) {
  if (auth.user) {
    pendingSession.value = { accessToken: auth.token }
  } else {
    auth
      .refresh()
      .then(() => {
        pendingSession.value = { accessToken: auth.token ?? '' }
      })
      .catch(() => {
        // 缓存的令牌已失效：清掉半截会话，正常走表单 / 扫码登录。
        auth.logout()
      })
  }
}

/** 交接模式下登录成功：记住令牌并停在授权面板（不跳转，否则弹窗会离开授权页）。 */
async function finishLogin(accessToken: string) {
  if (!handoff.value) {
    await afterLogin()
    return
  }
  pendingSession.value = { accessToken }
}
const rules: FormRules = {
  username: { required: true, message: '请输入用户名', trigger: 'blur' },
  password: { required: true, message: '请输入密码', trigger: 'blur' },
}

type QrStatus = 'idle' | 'loading' | 'ready' | 'expired' | 'error'
const activeTab = ref<'password' | 'qr'>('qr')
const qrStatus = ref<QrStatus>('idle')
const qrImageUrl = ref('')
const qrImageFailed = ref(false)
const qrSessionId = ref('')
let qrPollTimer: number | undefined
let disposed = false

/** 登录成功后的落地页：有回跳目标就回跳，否则落到当前权限下第一个可见主 tab。 */
async function afterLogin() {
  await router.replace(
    route.query.redirect
      ? String(route.query.redirect)
      : {
          name: resolveLandingRouteName((permission) => auth.can(permission)),
        },
  )
}

async function submit() {
  await formRef.value?.validate()
  loading.value = true
  try {
    await auth.login(model)
    await finishLogin(auth.token ?? '')
  } catch (error) {
    message.error(error instanceof Error ? error.message : '登录失败')
  } finally {
    loading.value = false
  }
}

function stopQrPolling() {
  if (qrPollTimer === undefined) return
  window.clearTimeout(qrPollTimer)
  qrPollTimer = undefined
}

/** 创建扫码会话并开始轮询；同一时间只保留一个会话。 */
async function startQrLogin() {
  stopQrPolling()
  qrSessionId.value = ''
  qrImageUrl.value = ''
  qrImageFailed.value = false
  qrStatus.value = 'loading'
  try {
    const session = await authApi.createQrSession()
    if (disposed || activeTab.value !== 'qr') return
    qrSessionId.value = session.session_id
    qrImageUrl.value = authApi.qrCodeUrl(session.session_id)
    qrStatus.value = 'ready'
    void pollQrLogin()
  } catch {
    qrStatus.value = 'error'
  }
}

/** 轮询扫码结果；confirmed 时写入登录态并跳转。网络抖动只等下一轮。 */
async function pollQrLogin() {
  const sessionId = qrSessionId.value
  if (!sessionId || disposed || activeTab.value !== 'qr') return
  try {
    const result = await authApi.qrSession(sessionId)
    if (result.status === 'confirmed') {
      if (result.access_token && result.refresh_token && result.user) {
        auth.adoptSession({
          access_token: result.access_token,
          refresh_token: result.refresh_token,
          user: result.user,
        })
        stopQrPolling()
        await finishLogin(result.access_token)
        return
      }
    }
    if (result.status === 'expired') {
      qrStatus.value = 'expired'
      return
    }
  } catch {
    // 会话创建后偶发网络失败不终止轮询，下一轮继续。
  }
  if (!disposed && activeTab.value === 'qr') {
    qrPollTimer = window.setTimeout(() => void pollQrLogin(), 1500)
  }
}

watch(activeTab, (tab) => {
  if (tab === 'qr') {
    void startQrLogin()
  } else {
    stopQrPolling()
    qrStatus.value = 'idle'
  }
})

// 默认页签就是扫码登录，mount 时 watch 不会触发，这里主动创建一次会话。
void startQrLogin()

/**
 * 把登录态交给发起授权的油猴脚本。
 *
 * 只回传令牌、接口地址与用户的权限键；回传目标 origin 由 `handoffRequest` 白名单校验，
 * 非白名单 / 非弹窗场景 `handoff` 为 null，本函数不会被调用。
 */
function authorizeUserscript() {
  if (!handoff.value || !pendingSession.value || !auth.user) return
  const ok = deliverSession(
    handoff.value,
    { accessToken: pendingSession.value.accessToken, user: auth.user },
    activeBackendUrl(),
  )
  handoffDelivered.value = ok
  if (!ok) handoffFailed.value = '发起窗口已关闭，授权未送达；请回到脚本重新打开授权窗口。'
}

/** 授权后关闭弹窗（脚本自己也会在收到消息后关窗，两处都做以防浏览器限制）。 */
function closeHandoffWindow() {
  window.close()
}

onBeforeUnmount(() => {
  disposed = true
  stopQrPolling()
})
</script>

<template>
  <main class="login-page">
    <section class="login-intro">
      <div class="intro-content">
        <img class="login-logo" :src="LOGO_URL" alt="系统 Logo" />
        <span class="eyebrow">ELECTRICAL WORKSHOP</span>
        <h1>HXNI<br />电气无忧</h1>
      </div>
    </section>
    <section class="login-panel">
      <n-card class="login-card" :bordered="false">
        <!-- 油猴脚本的授权模式：登录后停在本页，等用户点一次授权把登录态交回脚本窗口。 -->
        <template v-if="handoff">
          <h2>{{ handoffDelivered ? '已授权' : '授权登录' }}</h2>
          <p class="handoff-hint">
            油猴脚本正在请求使用你的登录态来同步采购数据。登录成功后点「授权」即可，令牌只回传给发起窗口。
          </p>
          <div v-if="handoffDelivered" class="handoff-result">
            <n-alert type="success" :show-icon="true">已把登录态交给脚本，可以关闭本窗口。</n-alert>
            <n-button block size="large" type="primary" @click="closeHandoffWindow"
              >关闭窗口</n-button
            >
          </div>
          <div v-else-if="pendingSession" class="handoff-result">
            <n-alert v-if="handoffFailed" type="error" :show-icon="true">{{
              handoffFailed
            }}</n-alert>
            <n-button block size="large" type="primary" @click="authorizeUserscript">
              授权脚本使用我的登录态
            </n-button>
          </div>
          <template v-else>
            <n-tabs v-model:value="activeTab" type="segment" animated>
              <n-tab-pane name="qr" tab="小程序扫码">
                <div class="qr-login">
                  <div v-if="qrStatus === 'loading'" class="qr-state">
                    <n-spin size="small" />
                    <span>正在生成二维码…</span>
                  </div>
                  <template v-else-if="qrStatus === 'ready' && !qrImageFailed">
                    <img
                      class="qr-image"
                      :src="qrImageUrl"
                      alt="小程序扫码登录二维码"
                      @error="qrImageFailed = true"
                    />
                    <p class="qr-hint">请使用微信扫一扫，在小程序中确认登录</p>
                  </template>
                  <div v-else class="qr-state qr-error">
                    <p>二维码暂时不可用，请使用账号密码登录。</p>
                    <n-button size="small" @click="startQrLogin">重试</n-button>
                  </div>
                </div>
              </n-tab-pane>
              <n-tab-pane name="password" tab="账号密码">
                <n-form
                  ref="formRef"
                  :model="model"
                  :rules="rules"
                  size="large"
                  @submit.prevent="submit"
                >
                  <n-form-item label="用户名" path="username"
                    ><n-input v-model:value="model.username" placeholder="用户名"
                  /></n-form-item>
                  <n-form-item label="密码" path="password"
                    ><n-input
                      v-model:value="model.password"
                      type="password"
                      show-password-on="click"
                      placeholder="密码"
                      @keyup.enter="submit"
                  /></n-form-item>
                  <n-button type="primary" block size="large" :loading="loading" @click="submit"
                    >登录</n-button
                  >
                </n-form>
              </n-tab-pane>
            </n-tabs>
          </template>
        </template>
        <template v-else>
          <h2>欢迎登录</h2>
          <n-tabs v-model:value="activeTab" type="segment" animated>
            <n-tab-pane name="password" tab="账号密码">
              <n-form
                ref="formRef"
                :model="model"
                :rules="rules"
                size="large"
                @submit.prevent="submit"
              >
                <n-form-item label="用户名" path="username"
                  ><n-input v-model:value="model.username" placeholder="用户名"
                /></n-form-item>
                <n-form-item label="密码" path="password"
                  ><n-input
                    v-model:value="model.password"
                    type="password"
                    show-password-on="click"
                    placeholder="密码"
                    @keyup.enter="submit"
                /></n-form-item>
                <n-button type="primary" block size="large" :loading="loading" @click="submit"
                  >登录</n-button
                >
              </n-form>
            </n-tab-pane>
            <n-tab-pane name="qr" tab="小程序扫码">
              <div class="qr-login">
                <div v-if="qrStatus === 'loading'" class="qr-state">
                  <n-spin size="small" />
                  <span>正在生成二维码…</span>
                </div>
                <template v-else-if="qrStatus === 'ready' && !qrImageFailed">
                  <img
                    class="qr-image"
                    :src="qrImageUrl"
                    alt="小程序扫码登录二维码"
                    @error="qrImageFailed = true"
                  />
                  <p class="qr-hint">请使用微信扫一扫，在小程序中确认登录</p>
                  <p class="qr-subhint">二维码 5 分钟内有效</p>
                </template>
                <div v-else-if="qrStatus === 'ready'" class="qr-state qr-error">
                  <p>二维码生成失败，请重试或使用账号密码登录。</p>
                  <n-button size="small" @click="startQrLogin">重新生成</n-button>
                </div>
                <div v-else-if="qrStatus === 'expired'" class="qr-state qr-error">
                  <p>二维码已过期</p>
                  <n-button size="small" type="primary" secondary @click="startQrLogin"
                    >刷新二维码</n-button
                  >
                </div>
                <div v-else-if="qrStatus === 'error'" class="qr-state qr-error">
                  <p>扫码登录暂时不可用，请使用账号密码登录。</p>
                  <n-button size="small" @click="startQrLogin">重试</n-button>
                </div>
              </div>
            </n-tab-pane>
          </n-tabs>
        </template>
      </n-card>
    </section>
  </main>
</template>

<style scoped>
.login-page {
  min-height: 100vh;
  display: grid;
  grid-template-columns: 1.15fr 1fr;
  background: var(--color-bg);
}
.login-intro {
  background:
    radial-gradient(circle at 18% 20%, rgb(255 255 255 / 14%), transparent 24%),
    var(--gradient-brand);
  color: white;
  display: grid;
  place-items: center;
  position: relative;
  overflow: hidden;
}
.login-intro::after {
  content: '';
  position: absolute;
  width: 480px;
  height: 480px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 50%;
  right: -120px;
  bottom: -160px;
  box-shadow:
    0 0 0 80px rgba(255, 255, 255, 0.04),
    0 0 0 160px rgba(255, 255, 255, 0.03);
}
.intro-content {
  z-index: 1;
  max-width: 500px;
  padding: 48px;
}
.eyebrow {
  letter-spacing: 3px;
  opacity: 0.75;
}
.login-logo {
  display: block;
  width: 88px;
  height: 88px;
  margin-bottom: 24px;
  object-fit: contain;
}
h1 {
  font-size: 48px;
  line-height: 1.25;
  margin: 20px 0 0;
}
.login-panel {
  display: grid;
  place-items: center;
  padding: 48px;
  /* 与业务页共用一个页面底色光晕令牌（浅色几乎不可见，深色下是氛围底色） */
  background: var(--page-glow), var(--color-bg);
}
.login-card {
  width: 420px;
  border: 1px solid var(--color-border-subtle);
  box-shadow: var(--shadow-card-strong);
}
h2 {
  font-size: 28px;
  margin: 0 0 22px;
}
.qr-login {
  display: flex;
  min-height: 292px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 8px 0 4px;
}
.qr-image {
  width: 220px;
  height: 220px;
  padding: 6px;
  border: 1px solid var(--color-border-subtle);
  border-radius: 12px;
  /* 小程序码是白底图片，深色模式下也保持白底以保证可扫描 */
  background: #fff;
}
.qr-state {
  display: flex;
  min-height: 220px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: var(--color-text-muted);
  font-size: 13px;
  text-align: center;
}
.qr-error p {
  margin: 0;
  line-height: 1.6;
}
.qr-hint {
  margin: 6px 0 0;
  color: var(--color-text);
  font-size: 14px;
  text-align: center;
}
.qr-subhint {
  margin: 0;
  color: var(--color-text-muted);
  font-size: 12px;
}
@media (max-width: 768px) {
  .login-page {
    grid-template-columns: minmax(0, 1fr);
  }
  .login-intro {
    min-height: 220px;
    place-items: center;
  }
  .login-intro::after {
    display: none;
  }
  .intro-content {
    max-width: 100%;
    padding: 28px 24px;
    text-align: center;
  }
  .login-logo {
    width: 60px;
    height: 60px;
    margin: 0 auto 16px;
  }
  h1 {
    font-size: 28px;
    margin: 12px 0 0;
  }
  .login-panel {
    padding: 28px 16px 40px;
  }
  .login-card {
    width: 100%;
    max-width: 420px;
  }
}
</style>
