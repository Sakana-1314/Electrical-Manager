<script setup lang="ts">
import { onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { useLoadingBar } from 'naive-ui'

/**
 * 路由切换进度条：页面组件都是按需加载的，首次进入某个菜单要先下载该页的代码块，
 * 弱网下点击后会有一段「没反应」的空档。这里在导航开始时启动顶部进度条、结束或失败时收起。
 * 同路由内只改 query（翻页、筛选写回 URL）不算页面切换，不触发进度条。
 * 无渲染输出，必须放在 n-loading-bar-provider 内。
 */
const router = useRouter()
const loadingBar = useLoadingBar()
let active = false

const removeBefore = router.beforeEach((to, from) => {
  if (from.matched.length && to.path === from.path) return
  active = true
  loadingBar.start()
})
// 被守卫重定向 / 取消的导航（如未登录跳登录页）也算正常结束，只有代码块加载失败才标红。
const removeAfter = router.afterEach(() => {
  if (!active) return
  active = false
  loadingBar.finish()
})
const removeError = router.onError(() => {
  if (!active) return
  active = false
  loadingBar.error()
})

onBeforeUnmount(() => {
  removeBefore()
  removeAfter()
  removeError()
})
</script>

<template>
  <span hidden />
</template>
