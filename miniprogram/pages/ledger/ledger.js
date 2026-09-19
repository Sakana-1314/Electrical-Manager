const toastModule = require('tdesign-miniprogram/toast/index');
const { request } = require('../../utils/request');
const { buildRedirectQuery } = require('../../utils/navigation');
const { getMessages, setNavigationBarTitle, t } = require('../../utils/i18n');
const { withTheme } = require('../../utils/theme');
const Toast = toastModule.default || toastModule;

const PAGE_SIZE = 15;

/** 列表行装饰：数量与单位合并展示，子项号缺省显示「未设置」。 */
function decorateLedger(item) {
  return {
    ...item,
    quantity_label: `${item.quantity} ${item.unit_name}`,
    subitem_no_label: item.subitem_no || t('notSet'),
  };
}

Page(withTheme({
  data: {
    items: [],
    keyword: '',
    page: 1,
    pageSize: PAGE_SIZE,
    total: 0,
    hasMore: false,
    loading: true,
    loadingMore: false,
    resultCount: '',
    backTopVisible: false,
    i18n: getMessages(),
  },

  async onLoad() {
    setNavigationBarTitle('ledgerTitle');
    try {
      const session = await getApp().globalData.authPromise;
      if (session.account_disabled) return;
      if (session.registration_disabled) return;
      if (session.requires_profile) {
        const redirect = buildRedirectQuery('/pages/ledger/ledger');
        wx.reLaunch({ url: `/pages/bind/bind?redirect=${redirect}` });
        return;
      }
      await this.loadLedger(true);
    } catch (error) {
      this.setData({ loading: false });
      this.showError(error);
    }
    // 首次 onShow 紧随 onLoad，跳过；之后从详情页返回时刷新列表。
    this.skipNextShow = true;
  },

  onShow() {
    if (this.skipNextShow) {
      this.skipNextShow = false;
      return;
    }
    void this.loadLedger(true);
  },

  onUnload() {
    clearTimeout(this.searchTimer);
  },

  async onPullDownRefresh() {
    await this.loadLedger(true);
    wx.stopPullDownRefresh();
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.loadingMore) void this.loadLedger(false);
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
    this.setData({ keyword: event.detail.value });
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => void this.loadLedger(true), 350);
  },

  async loadLedger(reset) {
    if (!reset && (this.data.loading || this.data.loadingMore || !this.data.hasMore)) return;
    const requestId = (this.requestId || 0) + 1;
    this.requestId = requestId;
    const page = reset ? 1 : this.data.page + 1;
    this.setData(reset ? { loading: true } : { loadingMore: true });
    try {
      const data = { page, page_size: this.data.pageSize };
      const keyword = this.data.keyword.trim();
      if (keyword) data.keyword = keyword;
      const result = await request({ url: '/mini-program/ledger-items', data });
      if (requestId !== this.requestId) return;
      const incoming = (result.items || []).map(decorateLedger);
      const items = reset ? incoming : [...this.data.items, ...incoming];
      this.setData({
        items,
        page,
        total: result.total || 0,
        resultCount: t('ledgerResultCount', { count: result.total || 0 }),
        hasMore: items.length < (result.total || 0),
      });
    } catch (error) {
      if (requestId === this.requestId) this.showError(error);
    } finally {
      if (requestId === this.requestId) this.setData({ loading: false, loadingMore: false });
    }
  },

  openDetail(event) {
    wx.navigateTo({
      url: `/pages/ledger-detail/ledger-detail?id=${event.currentTarget.dataset.id}`,
    });
  },

  onShareAppMessage() {
    return {
      title: t('shareLedger'),
      path: '/pages/ledger/ledger',
    };
  },

  showError(error) {
    Toast({
      context: this,
      selector: '#ledger-toast',
      message: error.message || t('ledgerLoadFailed'),
      theme: 'error',
      direction: 'column',
    });
  },
}));
