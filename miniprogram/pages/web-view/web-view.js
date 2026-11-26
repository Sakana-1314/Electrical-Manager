// 半屏 web-view：把小程序换到的一次性票据地址交给网页版，网页自己完成登录。
//
// 为什么需要这一页：web-view 只能加载配置在业务域名里的地址，且小程序不能直接改网页的
// localStorage；票据地址（`/web-open?ticket=…`）由后端拼好，本页只负责「打开 + 出错兜底」。
const toastModule = require('tdesign-miniprogram/toast/index');
const { buildRedirectQuery } = require('../../utils/navigation');
const { getMessages, t } = require('../../utils/i18n');
const Toast = toastModule.default || toastModule;

/** 只接受 http(s) 地址，避免把奇怪的 scheme 交给 web-view。 */
function safeUrl(raw) {
  let url = '';
  try {
    url = decodeURIComponent(String(raw || '')).trim();
  } catch (_error) {
    return '';
  }
  return /^https?:\/\//i.test(url) ? url : '';
}

Page({
  data: {
    url: '',
    failed: false,
    i18n: getMessages(),
  },

  async onLoad(options = {}) {
    const url = safeUrl(options.url);
    try {
      const session = await getApp().globalData.authPromise;
      if (session.registration_disabled) {
        wx.reLaunch({ url: '/pages/registration-closed/registration-closed' });
        return;
      }
      if (session.requires_profile) {
        const redirect = buildRedirectQuery(
          `/pages/web-view/web-view?url=${encodeURIComponent(url)}`,
        );
        wx.reLaunch({ url: `/pages/bind/bind?redirect=${redirect}` });
        return;
      }
    } catch (_error) {
      // 登录态异常由首页统一处理；这里仍尝试打开（网页会用票据自行校验）。
    }
    if (!url) {
      this.setData({ failed: true });
      return;
    }
    this.setData({ url });
  },

  /** web-view 加载失败（业务域名未配置 / 网络异常）：留在本页给出提示与返回按钮。 */
  onError() {
    this.setData({ failed: true });
    Toast({
      context: this,
      selector: '#web-view-toast',
      message: t('webOpenFailed'),
      theme: 'error',
      direction: 'column',
    });
  },

  goBack() {
    wx.navigateBack({ fail: () => wx.reLaunch({ url: '/pages/profile/profile' }) });
  },
});
