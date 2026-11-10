const toastModule = require('tdesign-miniprogram/toast/index');
const { request } = require('../../utils/request');
const { buildRedirectQuery } = require('../../utils/navigation');
const { getMessages, t } = require('../../utils/i18n');
const { withTheme } = require('../../utils/theme');
const Toast = toastModule.default || toastModule;

Page(withTheme({
  data: {
    detail: null,
    loading: true,
    failed: false,
    i18n: getMessages(),
  },

  async onLoad(options = {}) {
    this.detailId = Number(options.id || 0);
    try {
      const session = await getApp().globalData.authPromise;
      if (session.account_disabled) {
        wx.reLaunch({ url: '/pages/disabled/disabled' });
        return;
      }
      if (session.registration_disabled) {
        wx.reLaunch({ url: '/pages/registration-closed/registration-closed' });
        return;
      }
      if (session.requires_profile) {
        const redirect = buildRedirectQuery(
          `/pages/material-code-detail/material-code-detail?id=${this.detailId}`,
        );
        wx.reLaunch({ url: `/pages/bind/bind?redirect=${redirect}` });
        return;
      }
      await this.loadDetail(this.detailId);
    } catch (error) {
      this.setData({ loading: false, failed: true });
      this.showError(error);
    }
  },

  async loadDetail(id) {
    if (!Number.isInteger(id) || id <= 0) {
      this.setData({ loading: false, failed: true });
      this.showError(new Error(t('invalidMaterialCode')));
      return;
    }
    this.setData({ loading: true, failed: false });
    try {
      const result = await request({ url: `/mini-program/material-codes/${id}` });
      this.setData({ detail: result });
      wx.pageScrollTo({ scrollTop: 0, duration: 0 });
    } catch (error) {
      this.setData({ failed: true });
      this.showError(error);
    } finally {
      this.setData({ loading: false });
    }
  },

  retry() {
    void this.loadDetail(this.detailId);
  },

  copyMaterialCode() {
    const detail = this.data.detail;
    if (!detail) return;
    wx.setClipboardData({
      data: detail.material_code || '',
      success: () => {
        Toast({
          context: this,
          selector: '#material-code-detail-toast',
          message: t('copied'),
          theme: 'success',
          direction: 'column',
        });
      },
    });
  },

  onShareAppMessage() {
    const detail = this.data.detail;
    return {
      title: detail ? `${t('shareMaterialCodeDetail')} · ${detail.name || detail.material_code}` : t('shareMaterialCodeDetail'),
      path: `/pages/material-code-detail/material-code-detail?id=${this.detailId}`,
    };
  },

  showError(error) {
    Toast({
      context: this,
      selector: '#material-code-detail-toast',
      message: error.message || t('materialCodeDetailFailed'),
      theme: 'error',
      direction: 'column',
    });
  },
}));
