import { mount, type VueWrapper } from '@vue/test-utils'
import { NDialogProvider } from 'naive-ui'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { useMaskCloseGuard } from './useMaskCloseGuard'

/**
 * 遮罩关闭守卫：点遮罩 / ESC / × 三条路径都走 `requestClose`。
 * 有未保存修改时必须先二次确认，避免误触遮罩丢掉整张单据；无修改时直接关。
 *
 * 两个测试细节（都实测过）：
 * - 命令式弹窗不是同步挂载的，`requestClose()` 之后要 `await nextTick()` 才查得到 `.n-dialog`；
 * - 每个用例必须卸载并清空 body，否则上一个用例留下的弹窗会被 `buttonByText` 先命中，
 *   点到的是别人家的按钮。
 */
let wrapper: VueWrapper | null = null

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  document.body.innerHTML = ''
})

function setup(dirty: boolean) {
  const close = vi.fn()
  const isDirty = vi.fn(() => dirty)
  let requestClose: (() => void) | null = null

  wrapper = mount(NDialogProvider, {
    attachTo: document.body,
    slots: {
      default: () =>
        h(
          defineComponent({
            setup() {
              requestClose = useMaskCloseGuard({ isDirty, close }).requestClose
              return () => h('div')
            },
          }),
        ),
    },
  })

  return { close, isDirty, requestClose: () => requestClose?.() }
}

function dialogEl(): HTMLElement | null {
  return document.querySelector<HTMLElement>('.n-dialog')
}

function buttonByText(text: string): HTMLElement | undefined {
  return [...document.querySelectorAll<HTMLElement>('.n-dialog .n-button')].find(
    (element) => element.textContent?.trim() === text,
  )
}

describe('useMaskCloseGuard', () => {
  it('无未保存修改时直接关闭，不弹确认', async () => {
    const { close, requestClose } = setup(false)

    requestClose()
    await nextTick()

    expect(close).toHaveBeenCalledTimes(1)
    expect(dialogEl()).toBeNull()
  })

  it('有未保存修改时先弹确认，未确认前不关闭', async () => {
    const { close, requestClose } = setup(true)

    requestClose()
    await nextTick()

    expect(close).not.toHaveBeenCalled()
    const dialog = dialogEl()
    expect(dialog).not.toBeNull()
    expect(dialog?.textContent).toContain('放弃未保存的修改？')
    expect(dialog?.textContent).toContain('放弃修改')
    expect(dialog?.textContent).toContain('继续编辑')
  })

  it('点「放弃修改」才真正关闭', async () => {
    const { close, requestClose } = setup(true)

    requestClose()
    await nextTick()
    buttonByText('放弃修改')?.click()
    await nextTick()

    expect(close).toHaveBeenCalledTimes(1)
  })

  it('点「继续编辑」不关闭', async () => {
    const { close, requestClose } = setup(true)

    requestClose()
    await nextTick()
    buttonByText('继续编辑')?.click()
    await nextTick()

    expect(close).not.toHaveBeenCalled()
  })

  it('脏判定每次都由调用方实时求值（不是打开时算一次）', async () => {
    const { close, isDirty, requestClose } = setup(false)

    requestClose()
    await nextTick()
    isDirty.mockReturnValue(true)
    requestClose()
    await nextTick()

    // 第一次直接关（脏判定为 false），第二次因变脏而只弹确认，不再关闭
    expect(isDirty).toHaveBeenCalledTimes(2)
    expect(close).toHaveBeenCalledTimes(1)
  })
})
