<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useSettingsStore } from '@/stores/settings'
import { resolveLandingRouteName } from '@/utils/navigation'

const router = useRouter()
const settings = useSettingsStore()

/** 回首页 = 当前可见的第一个主 tab（工作台可能已被后台可见功能关闭）。 */
function goHome() {
  void router.push({
    name: resolveLandingRouteName(settings.webFeatures, { isLiteMode: settings.isLiteMode }),
  })
}
</script>

<template>
  <n-result status="404" title="页面不存在" description="请检查访问地址"
    ><template #footer><n-button @click="goHome">返回首页</n-button></template></n-result
  >
</template>
