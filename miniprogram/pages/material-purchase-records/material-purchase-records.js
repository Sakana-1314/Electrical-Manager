const toastModule = require('tdesign-miniprogram/toast/index');
const { request } = require('../../utils/request');
const { buildRedirectQuery } = require('../../utils/navigation');
const { getMessages, t } = require('../../utils/i18n');
const { decoratePurchaseRecord } = require('../../utils/purchase');
const Toast = toastModule.default || toastModule;

Page({
  data: {
    materialCode: '',
    materialName: '',
    items: [],
    page: 1,
    pageSize: 15,
    total: 0,
    hasMore: false,
    loading: true,
    loadingMore: false,
    backTopVisible: false,
    failed: false,
    resultCount: '',
    i18n: getMessages(),
  },

  async onLoad(options = {}) {
    const materialCode = decodeURIComponent(options.material_code || '');
    const materialName = decodeURIComponent(options.name || '');
    this.setData({ materialCode, materialName });
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
          `/pages/material-purchase-records/material-purchase-records?material_code=${encodeURIComponent(materialCode)}&name=${encodeURIComponent(materialName)}`,
        );
        wx.reLaunch({ url: `/pages/bind/bind?redirect=${redirect}` });
        return;
      }
      await this.loadRecords(true);
    } catch (error) {
      this.setData({ loading: false, failed: true });
      this.showError(error);
    }
  },

  async onPullDownRefresh() {
    await this.loadRecords(true);
    wx.stopPullDownRefresh();
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.loadingMore) void this.loadRecords(false);
  },

  onPageScroll(event) {
    const scrollTop = event.scrollTop || 0;
    if (scrollTop > 400 && !this.data.backTopVisible) {
      this.setData({ backTopVisible: true });
    } else if (scrollTop <= 400 && this.data.backTopVisible) {
      this.setData({ backTopVisible: false });
    }
  },

  scrollToTop() {
    wx.pageScrollTo({ scrollTop: 0, duration: 300 });
  },

  async loadRecords(reset) {
    if (!this.data.materialCode) {
      this.setData({ loading: false, failed: false, items: [], resultCount: '' });
      return;
    }
    if (!reset && (this.data.loading || this.data.loadingMore || !this.data.hasMore)) return;
    const requestId = (this.requestId || 0) + 1;
    this.requestId = requestId;
    const page = reset ? 1 : this.data.page + 1;
    this.setData(reset ? { loading: true, failed: false } : { loadingMore: true });
    try {
      const result = await request({
        url: '/mini-program/purchase-records',
        data: {
          material_code: this.data.materialCode,
          page,
          page_size: this.data.pageSize,
        },
      });
      if (requestId !== this.requestId) return;
      const incoming = (result.items || []).map(decoratePurchaseRecord);
      const items = reset ? incoming : [...this.data.items, ...incoming];
      this.setData({
        items,
        page,
        total: result.total || 0,
        resultCount: t('purchaseRecordResultCount', { count: result.total || 0 }),
        hasMore: items.length < (result.total || 0),
      });
    } catch (error) {
      if (requestId === this.requestId) {
        this.setData({ failed: true });
        this.showError(error);
      }
    } finally {
      if (requestId === this.requestId) this.setData({ loading: false, loadingMore: false });
    }
  },

  retry() {
    void this.loadRecords(true);
  },

  goDetail(event) {
    const item = this.data.items[event.currentTarget.dataset.index];
    if (!item) return;
    wx.navigateTo({
      url: `/pages/purchase-record-detail/purchase-record-detail?line_id=${item.line_id}`,
    });
  },

  showError(error) {
    Toast({
      context: this,
      selector: '#material-purchase-records-toast',
      message: error.message || t('purchaseRecordsLoadFailed'),
      theme: 'error',
      direction: 'column',
    });
  },
});
