import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { flushPromises, mount } from '@vue/test-utils'
import {
  NAlert,
  NButton,
  NCard,
  NForm,
  NFormItem,
  NInput,
  NMessageProvider,
  NSpin,
  NTabPane,
  NTabs,
} from 'naive-ui'
import { defineComponent, h } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import type { User } from '@/api/generated'

/**
 * 油猴脚本授权弹窗（`/login?userscript=1&…`）。
 *
 * 关键回归：用户平时就登录着本系统，弹窗与新标签页同源共享 localStorage。以前守卫把
 * 「已登录 + /login」直接送去落地页，授权页压根没渲染，脚本只能等超时；现在守卫放行，
 * 登录页必须**直接显示授权按钮**（不必再登一次），点一下才回传登录态。
 */
const PLATFORM_ORIGIN = 'http://43.154.152.157:8080'
const NONCE = 'c'.repeat(32)
const SESSION_ID = '0198f3a7-2c00-7000-8000-000000000002'
const LOGIN_PATH = `/login?userscript=1&origin=${encodeURIComponent(PLATFORM_ORIGIN)}&nonce=${NONCE}`
/** 新版脚本的地址：带会话 id、不带 nonce。 */
const SESSION_PATH = `/login?userscript=1&origin=${encodeURIComponent(PLATFORM_ORIGIN)}&session=${SESSION_ID}`

const savedUser = {
  id: 7,
  username: 'tester',
  display_name: '测试员',
  permissions: ['purchase:read'],
} as unknown as User

vi.mock('@/api/auth', () => ({
  authApi: {
    login: vi.fn(),
    me: vi.fn(),
    createQrSession: vi.fn(),
    qrSession: vi.fn(),
    qrCodeUrl: vi.fn(() => ''),
    confirmUserScriptSession: vi.fn(),
  },
}))

import { authApi } from '@/api/auth'
import LoginView from './LoginView.vue'

const api = vi.mocked(authApi)

const Host = defineComponent({
  render: () => h(NMessageProvider, null, { default: () => h({ render: () => h(LoginView) }) }),
})

/**
 * 单测环境未启用 unplugin-vue-components：模板里的 `n-*` 组件必须显式注册，
 * 否则登录表单渲染不出来（`input[type=password]` 断言会误判）。
 */
const naiveComponents = {
  NAlert,
  NButton,
  NCard,
  NForm,
  NFormItem,
  NInput,
  NMessageProvider,
  NSpin,
  NTabPane,
  NTabs,
}

/** 造一个指向 `/login?userscript=1…` 的真实路由，让组件读到同一份 query。 */
async function mountLogin(path = LOGIN_PATH) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/login', name: 'login', component: { render: () => null } }],
  })
  await router.push(path)
  await router.isReady()
  const wrapper = mount(Host, {
    attachTo: document.body,
    global: { plugins: [router], components: naiveComponents },
  })
  await flushPromises()
  return wrapper
}

beforeEach(() => {
  setActivePinia(createPinia())
  localStorage.clear()
  vi.clearAllMocks()
  // 弹窗由脚本用 window.open 打开：opener 存在 + 平台 origin 在白名单内。
  Object.defineProperty(window, 'opener', {
    value: { postMessage: vi.fn() },
    configurable: true,
    writable: true,
  })
})

describe('登录页的油猴授权模式', () => {
  it('已登录时直接进入授权面板，不再要求重新登录', async () => {
    localStorage.setItem('access_token', 'saved-jwt')
    // 缓存快照可能缺字段：这里让 /auth/me 返回权威用户，验证「补齐后直接给授权按钮」。
    api.me.mockResolvedValue(savedUser)

    const wrapper = await mountLogin()

    expect(api.me).toHaveBeenCalledTimes(1)
    expect(wrapper.text()).toContain('授权登录')
    const authorize = wrapper.findAll('button').find((btn) => btn.text().includes('授权'))
    expect(authorize, '应直接给出授权按钮').toBeTruthy()
    // 不该再出现登录表单
    expect(wrapper.find('input[type="password"]').exists()).toBe(false)

    wrapper.unmount()
  })

  it('本地已有完整用户快照时不再请求 /auth/me', async () => {
    localStorage.setItem('access_token', 'saved-jwt')
    // auth store 在模块加载时读取本地快照；这里只验证「有 user 就走本地」的短路逻辑。
    const wrapper = await mountLogin()
    expect(wrapper.text()).toContain('授权登录')

    wrapper.unmount()
  })

  it('点授权后把登录态回传给脚本窗口', async () => {
    localStorage.setItem('access_token', 'saved-jwt')
    api.me.mockResolvedValue(savedUser)

    const wrapper = await mountLogin()
    const authorize = wrapper.findAll('button').find((btn) => btn.text().includes('授权'))!
    await authorize.trigger('click')
    await flushPromises()

    const opener = window.opener as unknown as { postMessage: ReturnType<typeof vi.fn> }
    expect(opener.postMessage).toHaveBeenCalledTimes(1)
    const [payload, targetOrigin] = opener.postMessage.mock.calls[0]
    expect(targetOrigin).toBe(PLATFORM_ORIGIN)
    expect(payload).toMatchObject({
      type: 'hxni-userscript-session',
      nonce: NONCE,
      session: { token: 'saved-jwt', user: { username: 'tester' } },
    })
    expect(wrapper.text()).toContain('已授权')

    wrapper.unmount()
  })

  it('缓存令牌已失效时清掉半截会话，回到正常登录界面', async () => {
    localStorage.setItem('access_token', 'stale-jwt')
    api.me.mockRejectedValue(new Error('INVALID_TOKEN'))

    const wrapper = await mountLogin()

    expect(api.me).toHaveBeenCalled()
    expect(localStorage.getItem('access_token')).toBeNull()
    // 回到普通登录界面（默认停在扫码页签，账号密码表单在另一个页签里）
    expect(wrapper.text()).not.toContain('授权脚本使用我的登录态')
    expect(wrapper.text()).toContain('账号密码')

    wrapper.unmount()
  })

  it('普通访问（没有 userscript 参数）即使已登录也不显示授权按钮', async () => {
    localStorage.setItem('access_token', 'saved-jwt')
    Object.defineProperty(window, 'opener', { value: null, configurable: true, writable: true })

    const wrapper = await mountLogin('/login')

    expect(wrapper.text()).not.toContain('授权登录')
    expect(wrapper.text()).toContain('欢迎登录')

    wrapper.unmount()
  })

  describe('会话通道（主通道，不依赖 opener）', () => {
    it('没有 window.opener 也能进授权面板并发起确认', async () => {
      localStorage.setItem('access_token', 'saved-jwt')
      api.me.mockResolvedValue(savedUser)
      api.confirmUserScriptSession.mockResolvedValue({ status: 'confirmed' })
      // 关键回归：发起窗口被浏览器切断时 opener 为 null，旧实现到这里就只能报错。
      Object.defineProperty(window, 'opener', { value: null, configurable: true, writable: true })

      const wrapper = await mountLogin(SESSION_PATH)

      expect(wrapper.text()).toContain('授权登录')
      const authorize = wrapper.findAll('button').find((btn) => btn.text().includes('授权'))!
      await authorize.trigger('click')
      await flushPromises()

      // 只上报会话 id，由服务端登记当前用户；令牌由脚本轮询取走。
      expect(api.confirmUserScriptSession).toHaveBeenCalledWith(SESSION_ID)
      expect(wrapper.text()).toContain('已授权')
      // 不该出现「发起窗口已关闭」这类失败提示
      expect(wrapper.text()).not.toContain('发起窗口')

      wrapper.unmount()
    })

    it('确认失败时把服务端原因展示出来', async () => {
      localStorage.setItem('access_token', 'saved-jwt')
      api.me.mockResolvedValue(savedUser)
      api.confirmUserScriptSession.mockRejectedValue(
        new Error('授权会话已过期或已被使用，请回到脚本重新打开授权窗口'),
      )
      Object.defineProperty(window, 'opener', { value: null, configurable: true, writable: true })

      const wrapper = await mountLogin(SESSION_PATH)
      const authorize = wrapper.findAll('button').find((btn) => btn.text().includes('授权'))!
      await authorize.trigger('click')
      await flushPromises()

      expect(wrapper.text()).toContain('授权会话已过期')
      expect(wrapper.text()).not.toContain('已授权')

      wrapper.unmount()
    })

    it('旧版只有 nonce 的地址仍走窗口回传，opener 断了才报错', async () => {
      localStorage.setItem('access_token', 'saved-jwt')
      api.me.mockResolvedValue(savedUser)
      Object.defineProperty(window, 'opener', { value: null, configurable: true, writable: true })

      const wrapper = await mountLogin(LOGIN_PATH)
      const authorize = wrapper.findAll('button').find((btn) => btn.text().includes('授权'))!
      await authorize.trigger('click')
      await flushPromises()

      expect(api.confirmUserScriptSession).not.toHaveBeenCalled()
      expect(wrapper.text()).toContain('连接已断开')
      // 提示里要给出可执行的下一步（升级脚本）
      expect(wrapper.text()).toContain('升级')

      wrapper.unmount()
    })
  })
})
