<script setup lang="ts">
import { computed } from 'vue'
import { darkTheme, zhCN, dateZhCN } from 'naive-ui'
import { themeOverrides } from '@/theme'
import { useThemeStore } from '@/stores/theme'

const theme = useThemeStore()
// 解析后的外观：auto 跟随系统，light / dark 用用户选择。深色必须同时给 Naive UI 的 darkTheme，
// 否则组件仍按内置浅色变量渲染；业务色令牌由 theme.ts 里对应的一组覆盖值提供。
const naiveTheme = computed(() => (theme.isDark ? darkTheme : null))
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
