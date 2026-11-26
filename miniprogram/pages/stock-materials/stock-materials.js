const toastModule = require('tdesign-miniprogram/toast/index');
const { request } = require('../../utils/request');
const { buildRedirectQuery } = require('../../utils/navigation');
const { hasPermission } = require('../../utils/features');
const { getMessages, t } = require('../../utils/i18n');
const Toast = toastModule.default || toastModule;

/** 库存列表行的状态标签主题（与库存页同一套口径）。 */
const STATUS_THEMES = { out_of_stock: 'danger', low_stock: 'warning', normal: 'success' };
const STATUS_LABELS = { out_of_stock: '无库存', low_stock: '低库存', normal: '正常' };

Page({
  data: {
    items: [],
    keyword: '',
    page: 1,
    pageSize: 15,
    total: 0,
    hasMore: false,
    loading: true,
    loadingMore: false,
    canWrite: false,
    resultCount: '',
    backTopVisible: false,
    i18n: getMessages(),
  },

  async onLoad() {
    try {
      const session = await getApp().globalData.authPromise;
      if (session.registration_disabled) return;
      if (session.requires_profile) {
        const redirect = buildRedirectQuery('/pages/stock-materials/stock-materials');
        wx.reLaunch({ url: `/pages/bind/bind?redirect=${redirect}` });
        return;
      }
      this.setData({ canWrite: hasPermission('warehouse:write') });
      await this.loadMaterials(true);
    } catch (error) {
      this.setData({ loading: false });
      this.showError(error);
    }
  },

  onShow() {
    // 从新建 / 编辑页返回时刷新一次，保证列表里的名称与数量是保存后的值。
    if (this.loadedOnce) void this.loadMaterials(true);
    this.loadedOnce = true;
  },

  onUnload() {
    clearTimeout(this.searchTimer);
  },

  async onPullDownRefresh() {
    await this.loadMaterials(true);
    wx.stopPullDownRefresh();
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.loadingMore) void this.loadMaterials(false);
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

  onSearchChange(event) {
    this.setData({ keyword: (event.detail && event.detail.value) || '' });
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => void this.loadMaterials(true), 350);
  },

  async loadMaterials(reset) {
    if (!reset && (this.data.loading || this.data.loadingMore || !this.data.hasMore)) return;
    const requestId = (this.requestId || 0) + 1;
    this.requestId = requestId;
    const page = reset ? 1 : this.data.page + 1;
    this.setData(reset ? { loading: true } : { loadingMore: true });
    try {
      const keyword = this.data.keyword.trim();
      const result = await request({
        url: '/mini-program/stock-materials',
        data: { page, page_size: this.data.pageSize, ...(keyword ? { keyword } : {}) },
      });
      if (requestId !== this.requestId) return;
      const incoming = (result.items || []).map((item) => ({
        ...item,
        stock_status_label: STATUS_LABELS[item.stock_status] || '',
        stock_status_theme: STATUS_THEMES[item.stock_status] || 'default',
      }));
      const items = reset ? incoming : [...this.data.items, ...incoming];
      this.setData({
        items,
        page,
        total: result.total || 0,
        resultCount: t('stockMaterialResultCount', { count: result.total || 0 }),
        hasMore: items.length < (result.total || 0),
      });
    } catch (error) {
      if (requestId === this.requestId) this.showError(error);
    } finally {
      if (requestId === this.requestId) this.setData({ loading: false, loadingMore: false });
    }
  },

  openDetail(event) {
    const item = this.data.items[event.currentTarget.dataset.index];
    if (!item) return;
    wx.navigateTo({
      url: `/pages/stock-material-form/stock-material-form?uuid=${item.uuid}&id=${item.id}`,
    });
  },

  openCreate() {
    wx.navigateTo({ url: '/pages/stock-material-form/stock-material-form' });
  },

  openInbound() {
    wx.navigateTo({ url: '/pages/stock-inbound/stock-inbound' });
  },

  showError(error) {
    Toast({
      context: this,
      selector: '#stock-materials-toast',
      message: (error && error.message) || t('stockMaterialLoadFailed'),
      theme: 'error',
      direction: 'column',
    });
  },
});
