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

onMounted(async () => {
  const ticket = String(route.query.ticket || '').trim()
  if (!ticket) {
    failed.value = '缺少登录票据，请从小程序重新进入'
    loading.value = false
    return
  }
  try {
    const session = await authApi.redeemWebOpenTicket({ ticket })
    auth.adoptSession(session)
    // 项目跟着票据走：票据里带的是小程序当前项目，直接写本地，守卫随后拉取项目列表时以它为准。
    if (session.project_id) {
      localStorage.setItem('current_project_id', String(session.project_id))
      project.currentProjectId = session.project_id
    }
    const path = String(route.query.path || session.path || '/')
    loading.value = false
    // 只用站内相对路径，避免票据被用来把用户推到外站。
    if (path.startsWith('/') && !path.startsWith('//')) await router.replace(path)
    else await router.replace({ name: 'dashboard' })
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
