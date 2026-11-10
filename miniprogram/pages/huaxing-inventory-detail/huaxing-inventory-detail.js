const toastModule = require('tdesign-miniprogram/toast/index');
const { request } = require('../../utils/request');
const { buildRedirectQuery } = require('../../utils/navigation');
const { getMessages, t } = require('../../utils/i18n');
const { withTheme } = require('../../utils/theme');
const Toast = toastModule.default || toastModule;

/** 数量 + 单位：数量为空时不拼出孤立单位。 */
function quantityLabel(item) {
  const quantity = item.quantity != null ? String(item.quantity) : '';
  if (!quantity) return t('notSet');
  return item.unit_name ? `${quantity} ${item.unit_name}` : quantity;
}

/** 首次入库日期：后端给 YYYY-MM-DD，页面统一显示 YYYY/MM/DD。 */
function dateLabel(value) {
  const text = String(value || '').trim();
  return text ? text.replace(/-/g, '/') : t('notSet');
}

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
          `/pages/huaxing-inventory-detail/huaxing-inventory-detail?id=${this.detailId}`,
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
      this.showError(new Error(t('invalidHuaxingInventory')));
      return;
    }
    this.setData({ loading: true, failed: false });
    try {
      const result = await request({ url: `/mini-program/huaxing-inventory/${id}` });
      this.setData({
        detail: {
          ...result,
          quantity_label: quantityLabel(result),
          first_inbound_date_label: dateLabel(result.first_inbound_date),
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

  retry() {
    void this.loadDetail(this.detailId);
  },

  /** 该物料的申购记录改成独立列表页：带上物料编码，列表按编码查申购记录。 */
  openPurchaseRecords() {
    const detail = this.data.detail;
    const code = String((detail && detail.material_code) || '').trim();
    if (!code) {
      this.showError(new Error(t('huaxingInventoryNoMaterialCode')));
      return;
    }
    wx.navigateTo({
      url: `/pages/material-purchase-records/material-purchase-records?material_code=${encodeURIComponent(code)}&name=${encodeURIComponent(detail.name || '')}`,
    });
  },

  copyNameAndCode() {
    const detail = this.data.detail;
    if (!detail) return;
    wx.setClipboardData({
      data: `${detail.name || ''} ${detail.material_code || ''}`.trim(),
      success: () => {
        Toast({
          context: this,
          selector: '#huaxing-inventory-detail-toast',
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
      title: detail ? `${t('shareHuaxingInventoryDetail')} · ${detail.name || detail.material_code}` : t('shareHuaxingInventoryDetail'),
      path: `/pages/huaxing-inventory-detail/huaxing-inventory-detail?id=${this.detailId}`,
    };
  },

  showError(error) {
    Toast({
      context: this,
      selector: '#huaxing-inventory-detail-toast',
      message: error.message || t('huaxingInventoryDetailFailed'),
      theme: 'error',
      direction: 'column',
    });
  },
}));
