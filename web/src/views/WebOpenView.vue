<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { authApi } from '@/api/auth'
import { useAuthStore } from '@/stores/auth'
import { useProjectStore } from '@/stores/project'

/**
 * 小程序「进入网页版」的入口页（公开路由）。
 *
 * 小程序先换取一次性票据，再用半屏 web-view 打开 `#/web-open?ticket=…&path=…`；
 * 本页用票据换回登录令牌（票据只能换一次、2 分钟过期），写入本地会话与当前项目，
 * 然后跳到目标路由。兑换失败（票据被用过 / 过期）显示提示与「重新登录」。
 *
 * 只放在公开路由里，不参与登录态判断，也不做权限拦截（兑换后的落地页由路由守卫按权限推导）。
 */
const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const project = useProjectStore()

const loading = ref(true)
const failed = ref('')

function queryValue(raw: unknown): string {
  return String(raw ?? '').trim()
}

/** 只接受站内相对路径，避免令牌被用来把用户推到外站。 */
function targetPath(raw: unknown, fallback: string): string {
  const path = queryValue(raw) || fallback
  return path.startsWith('/') && !path.startsWith('//') ? path : '/'
}

/**
 * 小程序直传的网页令牌只用于本次登录：地址栏里的 token 越快清掉越好，
 * 避免被浏览器历史、Referer 或截图带出去。页面本身仍用内存里的会话工作。
 */
function stripTokenFromAddressBar() {
  const url = new URL(window.location.href)
  if (!url.searchParams.has('token')) return
  url.searchParams.delete('token')
  window.history.replaceState({}, '', url.toString())
}

/** 当前项目跟着小程序会话走：守卫随后拉取项目列表时以它为准。 */
function applyProject(raw: unknown) {
  const id = Number(raw)
  if (!Number.isInteger(id) || id <= 0) return
  localStorage.setItem('current_project_id', String(id))
  project.currentProjectId = id
}

onMounted(async () => {
  const token = queryValue(route.query.token)
  const ticket = queryValue(route.query.ticket)

  // 新链路：小程序把登录响应里的网页令牌（management_access）直接带过来，不再换票。
  if (token) {
    // 先丢掉浏览器里可能残留的旧会话，避免旧用户的权限快照混进来。
    auth.logout()
    project.clear()
    stripTokenFromAddressBar()
    try {
      await auth.adoptAccessToken(token)
      applyProject(route.query.project_id)
      loading.value = false
      await router.replace(targetPath(route.query.path, '/'))
    } catch (error) {
      failed.value =
        error instanceof Error ? error.message : '登录令牌无效或已过期，请回到小程序重新进入'
      loading.value = false
    }
    return
  }

  if (!ticket) {
    failed.value = '缺少登录令牌，请从小程序重新进入'
    loading.value = false
    return
  }

  // 兼容链路：旧版小程序（或后端未配置 APP_WEB_BASE_URL 时）仍用一次性票据兑换。
  try {
    project.clear()
    const session = await authApi.redeemWebOpenTicket({ ticket }, { skipAuthRedirect: true })
    auth.adoptSession(session)
    applyProject(session.project_id)
    loading.value = false
    await router.replace(targetPath(route.query.path, session.path || '/'))
  } catch (error) {
    failed.value = error instanceof Error ? error.message : '票据兑换失败，请从小程序重新进入'
    loading.value = false
  }
})

function goLogin() {
  void router.replace({ name: 'login' })
}
</script>

<template>
  <div class="web-open-page">
    <div class="web-open-card">
      <n-spin :show="loading">
        <div v-if="failed" class="web-open-failed">
          <n-result status="error" title="无法进入网页版" :description="failed">
            <template #footer>
              <n-button type="primary" @click="goLogin">用账号密码登录</n-button>
            </template>
          </n-result>
        </div>
        <div v-else class="web-open-loading">
          <p>正在用小程序身份登录…</p>
        </div>
      </n-spin>
    </div>
  </div>
</template>

<style scoped>
.web-open-page {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: 24px;
  background: var(--color-surface-muted);
}

.web-open-card {
  width: min(420px, 100%);
  padding: 28px 24px;
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-card);
  background: var(--color-surface);
}

.web-open-loading {
  color: var(--color-text-muted);
  font-size: var(--list-body-size);
  text-align: center;
}
</style>
