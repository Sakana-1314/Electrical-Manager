import { shallowReadonly, shallowRef } from 'vue'
import type { GlobalTheme } from 'naive-ui'

/**
 * Naive UI 深色主题按需加载。
 *
 * `import { darkTheme } from 'naive-ui'` 会把全部组件（含本项目没用到的 Transfer、ColorPicker、
 * Calendar 等）的深色样式一并打进入口包；浅色用户永远用不到这部分。这里改为首次需要深色时
 * 再异步加载 `naive-ui/es/themes/dark`，并缓存同一个 Promise，多处调用只发一次请求。
 * 启动时若已解析为深色，main.ts 会在 mount 前等它加载完，首屏不闪浅色组件。
 */
const theme = shallowRef<GlobalTheme | null>(null)
let pending: Promise<GlobalTheme> | null = null

export function loadNaiveDarkTheme(): Promise<GlobalTheme> {
  pending ??= import('naive-ui/es/themes/dark').then((module) => {
    theme.value = module.darkTheme
    return module.darkTheme
  })
  return pending
}

/** 已加载的深色主题；未加载时为 null。 */
export const naiveDarkTheme = shallowReadonly(theme)
