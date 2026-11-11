<script setup lang="ts">
import { computed, watch } from 'vue'
import { zhCN, dateZhCN } from 'naive-ui'
import { themeOverrides } from '@/theme'
import { useThemeStore } from '@/stores/theme'
import { useAuthStore } from '@/stores/auth'
import { loadNaiveDarkTheme, naiveDarkTheme } from '@/utils/naiveDarkTheme'
import RouteProgress from '@/components/RouteProgress.vue'

const theme = useThemeStore()
const auth = useAuthStore()
// 登录态存在时启动即刷新用户：权限并集（user.permissions）是菜单与写入口的门禁依据，
// 旧版本缓存的用户快照没有该字段，重新拉取 /auth/me 补齐，避免部署后菜单消失或要求重登。
if (auth.isAuthenticated) void auth.refresh()
// 解析后的外观：auto 跟随系统，light / dark 用用户选择。深色必须同时给 Naive UI 的 darkTheme，
// 否则组件仍按内置浅色变量渲染；业务色令牌由 theme.ts 里对应的一组覆盖值提供。
// darkTheme 按需异步加载（见 utils/naiveDarkTheme.ts），切到深色时才拉取。
watch(
  () => theme.isDark,
  (dark) => {
    if (dark) void loadNaiveDarkTheme()
  },
  { immediate: true },
)
const naiveTheme = computed(() => (theme.isDark ? naiveDarkTheme.value : null))
const overrides = computed(() => themeOverrides(theme.isDark ? 'dark' : 'light'))
</script>

<template>
  <n-config-provider
    :locale="zhCN"
    :date-locale="dateZhCN"
    :theme="naiveTheme"
    :theme-overrides="overrides"
  >
    <n-loading-bar-provider>
      <RouteProgress />
      <n-dialog-provider>
        <n-notification-provider>
          <n-message-provider>
            <router-view />
          </n-message-provider>
        </n-notification-provider>
      </n-dialog-provider>
    </n-loading-bar-provider>
  </n-config-provider>
</template>
