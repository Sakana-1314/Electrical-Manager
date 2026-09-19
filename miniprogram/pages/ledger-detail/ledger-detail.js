const toastModule = require('tdesign-miniprogram/toast/index');
const { request } = require('../../utils/request');
const { imageUrl } = require('../../utils/inventory');
const { buildRedirectQuery } = require('../../utils/navigation');
const { getMessages, setNavigationBarTitle, t } = require('../../utils/i18n');
const { withTheme } = require('../../utils/theme');
const Toast = toastModule.default || toastModule;

/** 空值统一显示占位文案，避免详情页出现空白行。 */
function present(value, fallback) {
  const text = String(value ?? '').trim();
  return text && !['\\', '/', '-', '—'].includes(text) ? text : fallback;
}

Page(withTheme({
  data: {
    record: null,
    loading: true,
    failed: false,
    i18n: getMessages(),
  },

  async onLoad(options) {
    setNavigationBarTitle('ledgerDetailTitle');
    this.recordId = Number(options.id || 0);
    try {
      const session = await getApp().globalData.authPromise;
      if (session.account_disabled) return;
      if (session.registration_disabled) return;
      if (session.requires_profile) {
        const redirect = buildRedirectQuery(
          `/pages/ledger-detail/ledger-detail?id=${this.recordId}`,
        );
        wx.reLaunch({ url: `/pages/bind/bind?redirect=${redirect}` });
        return;
      }
      await getApp().globalData.imageSettingsPromise;
      await this.loadRecord(this.recordId);
    } catch (error) {
      this.setData({ loading: false, failed: true });
      this.showError(error);
    }
  },

  async loadRecord(id) {
    if (!Number.isInteger(id) || id <= 0) {
      this.setData({ loading: false, failed: true });
      this.showError(new Error(t('invalidLedger')));
      return;
    }
    this.setData({ loading: true, failed: false });
    try {
      const result = await request({ url: `/mini-program/ledger-items/${id}` });
      const tags = result.tags || [];
      const images = result.images || [];
      this.setData({
        record: {
          ...result,
          quantity_label: `${result.quantity} ${result.unit_name}`,
          subitem_no_label: present(result.subitem_no, t('notSet')),
          usage: present(result.usage, t('notSet')),
          remark_label: present(result.remark, t('noRemark')),
          tags,
          tag_count_label: t('tagCount', { count: tags.length }),
          image_count_label: t('imageCount', { count: images.length }),
          images: images.map((image) => ({
            ...image,
            preview_url: imageUrl(image.id, 192),
            original_url: imageUrl(image.id),
          })),
        },
      });
      wx.pageScrollTo({ scrollTop: 0, duration: 0 });
    } catch (error) {
      this.setData({ failed: true });
      this.showError(error);
    } finally {
      this.setData({ loading: false });
    }
  },

  previewImage(event) {
    const urls = this.data.record.images.map((image) => image.original_url);
    wx.previewImage({ current: urls[event.currentTarget.dataset.index], urls });
  },

  onShareAppMessage() {
    const record = this.data.record;
    return {
      title: record ? `${t('shareLedgerDetail')} · ${record.name}` : t('shareLedgerDetail'),
      path: `/pages/ledger-detail/ledger-detail?id=${this.recordId}`,
    };
  },

  retry() {
    void this.loadRecord(this.recordId);
  },

  showError(error) {
    Toast({
      context: this,
      selector: '#ledger-detail-toast',
      message: error.message || t('ledgerDetailFailed'),
      theme: 'error',
      direction: 'column',
    });
  },
}));
