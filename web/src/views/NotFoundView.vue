<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { resolveLandingRouteName } from '@/utils/navigation'

const router = useRouter()
const auth = useAuthStore()

/** 回首页 = 当前权限下可见的第一个主 tab。 */
function goHome() {
  void router.push({
    name: resolveLandingRouteName((permission) => auth.can(permission)),
  })
}
</script>

<template>
  <n-result status="404" title="页面不存在" description="请检查访问地址"
    ><template #footer><n-button @click="goHome">返回首页</n-button></template></n-result
  >
</template>
