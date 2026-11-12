const toastModule = require('tdesign-miniprogram/toast/index');
const { request } = require('../../utils/request');
const { buildRedirectQuery } = require('../../utils/navigation');
const { getMessages, t } = require('../../utils/i18n');
const Toast = toastModule.default || toastModule;

/** 小程序码 scene / 链接参数里的 session 值：可能是 URL 编码的紧凑 UUID。 */
function readSessionId(options = {}) {
  const raw = options.scene || options.session || '';
  try {
    return decodeURIComponent(String(raw)).trim();
  } catch (_error) {
    return '';
  }
}

Page({
  data: {
    i18n: getMessages(),
    loading: true,
    invalid: false,
    confirming: false,
    confirmed: false,
    user: null,
  },

  async onLoad(options = {}) {
    const sessionId = readSessionId(options);
    this.sessionId = sessionId;
    if (!sessionId) {
      this.setData({ loading: false, invalid: true });
      return;
    }
    try {
      const app = getApp();
      const session = await app.globalData.authPromise;
      if (session.account_disabled || session.registration_disabled) {
        return;
      }
      if (session.requires_profile) {
        const redirect = buildRedirectQuery(
          `/pages/web-login/web-login?scene=${encodeURIComponent(sessionId)}`,
        );
        wx.reLaunch({ url: `/pages/bind/bind?redirect=${redirect}` });
        return;
      }
      this.setData({
        loading: false,
        user: session.user || app.globalData.user,
      });
    } catch (error) {
      this.setData({ loading: false, invalid: true });
      this.showError(error);
    }
  },

  async confirm() {
    if (this.data.confirming || this.data.confirmed) return;
    if (!this.sessionId) {
      this.setData({ invalid: true });
      return;
    }
    this.setData({ confirming: true });
    try {
      await request({
        url: '/mini-program/qr-login/confirm',
        method: 'POST',
        data: { session_id: this.sessionId },
      });
      this.setData({ confirmed: true });
      Toast({
        context: this,
        selector: '#web-login-toast',
        message: t('webLoginSuccess'),
        theme: 'success',
        direction: 'column',
      });
    } catch (error) {
      this.showError(error);
    } finally {
      this.setData({ confirming: false });
    }
  },

  showError(error) {
    Toast({
      context: this,
      selector: '#web-login-toast',
      message: error.message || t('webLoginFailed'),
      theme: 'error',
      direction: 'column',
    });
  },
});
