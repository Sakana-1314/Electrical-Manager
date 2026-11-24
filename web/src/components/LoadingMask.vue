<script setup lang="ts">
import { NSpin } from 'naive-ui'

defineProps<{
  /** 是否展示遮罩 */
  show: boolean
  /** 遮罩中的提示文案，缺省时只显示 loading */
  text?: string
}>()
</script>

<template>
  <!--
    局部（元素内）加载遮罩：模糊宿主元素背后的内容 + 居中 loading。
    使用绝对定位，遮罩范围仅限宿主元素，不覆盖整页；宿主元素需要有定位上下文
    （.page 与各卡片类已提供 position: relative）。
  -->
  <Transition name="loading-mask">
    <div
      v-if="show"
      class="loading-mask"
      role="status"
      aria-live="polite"
      aria-busy="true"
      :aria-label="text || '加载中'"
    >
      <div class="loading-mask__body">
        <NSpin size="medium" />
        <p v-if="text" class="loading-mask__text">{{ text }}</p>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.loading-mask {
  position: absolute;
  inset: 0;
  z-index: 6;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-card);
  background: var(--color-mask-surface);
  backdrop-filter: blur(3px);
  -webkit-backdrop-filter: blur(3px);
}

.loading-mask__body {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 16px 22px;
  border-radius: 12px;
  background: var(--color-surface);
  box-shadow: var(--shadow-card);
}

.loading-mask__text {
  margin: 0;
  color: var(--color-text);
  font-size: var(--list-body-size);
  line-height: var(--list-body-line-height);
}

.loading-mask-enter-active,
.loading-mask-leave-active {
  transition: opacity 0.2s ease;
}

.loading-mask-enter-from,
.loading-mask-leave-to {
  opacity: 0;
}
</style>
