import { useDialog } from 'naive-ui'

/**
 * 详情弹窗的统一关闭入口：点遮罩、按 ESC、点右上角 × 三条路径都走 `requestClose`。
 *
 * 为什么需要它：naive-ui 的 `mask-closable="true"` 会直接 `doUpdateShow(false)`，
 * 完全绕过 `onClose`；`close-on-esc` 同理（`Modal.handleEsc` 里直接关闭）。弹窗表单里
 * 往往已经填了半张单据，误触遮罩就丢掉整单数据，所以详情弹窗统一写
 * `:mask-closable="false"` + `:close-on-esc="false"`，再由 `@mask-click` / `@esc` /
 * `@close` 显式调用本 composable。
 *
 * 脏判定交给调用方（`isDirty`）：各页面用「打开时快照 vs 当前值」比对，而不是 `watch(deep)`，
 * 避免 `syncForm` 回填时被 watcher 的刷新时序误判成用户改动。
 *
 * 注意 `@close` 的处理函数**必须返回 `false`**：`Modal.handleCloseClick` 只在返回值不为
 * `false` 时关闭，这样「继续编辑」才拦得住；真正关闭由 `close()` 改 `show` 完成。
 */
export interface MaskCloseGuardOptions {
  /** 是否有未保存的修改 */
  isDirty: () => boolean
  /** 真正关闭弹窗（改 show / 清 URL 参数 / 复位表单） */
  close: () => void
  /** 确认弹窗标题，默认「放弃未保存的修改？」 */
  title?: string
  /** 确认弹窗正文 */
  content?: string
}

export function useMaskCloseGuard(options: MaskCloseGuardOptions): {
  requestClose: () => void
} {
  const dialog = useDialog()

  function requestClose() {
    if (!options.isDirty()) {
      options.close()
      return
    }
    dialog.warning({
      draggable: true,
      title: options.title ?? '放弃未保存的修改？',
      content: options.content ?? '关闭后本次填写的内容不会保存。',
      positiveText: '放弃修改',
      negativeText: '继续编辑',
      onPositiveClick: () => {
        options.close()
        return true
      },
    })
  }

  return { requestClose }
}
