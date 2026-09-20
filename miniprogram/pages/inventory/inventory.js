const toastModule = require('tdesign-miniprogram/toast/index');
const { request } = require('../../utils/request');
const { decorateStock } = require('../../utils/inventory');
const { buildRedirectQuery } = require('../../utils/navigation');
const { buildSharePath, isAllowedShareValue, readShareParams } = require('../../utils/share');
const { SECONDARY_WAREHOUSE_LITE } = require('../../utils/features');
const { getMessages, setNavigationBarTitle, t } = require('../../utils/i18n');
const { withTheme } = require('../../utils/theme');
const Toast = toastModule.default || toastModule;

// 分享链接携带的搜索词与库存状态（与页面 data 字段同名，便于直接回填）。
const SHARE_PARAMS = ['keyword', 'stockStatus'];
const PAGE_ROUTE = '/pages/inventory/inventory';
// 库存状态页签是固定三档（与页面上的 t-tabs 一致）：非法值直接忽略，不凭空造页签。
const STOCK_STATUSES = ['all', 'out_of_stock', 'low_stock'];

Page(withTheme({
  data: {
    items: [],
    keyword: '',
    stockStatus: 'all',
    liteMode: false,
    page: 1,
    pageSize: 15,
    total: 0,
    hasMore: false,
    loading: true,
    loadingMore: false,
    resultCount: '',
    i18n: getMessages(),
  },

  async onLoad(options = {}) {
    setNavigationBarTitle('inventoryTitle');
    // 分享链接带来的搜索词 / 库存状态；精简模式下没有库存状态页签，忽略该参数。
    const shared = readShareParams(options, SHARE_PARAMS);
    try {
      const [session, featureModes] = await Promise.all([
        getApp().globalData.authPromise,
        getApp().globalData.featureSettingsPromise,
      ]);
      if (session.account_disabled) {
        wx.reLaunch({ url: '/pages/disabled/disabled' });
        return;
      }
      if (session.registration_disabled) {
        wx.reLaunch({ url: '/pages/registration-closed/registration-closed' });
        return;
      }
      if (session.requires_profile) {
        // 带上分享参数回跳，未注册用户绑定后仍落在同一份筛选结果上。
        const redirect = buildRedirectQuery(buildSharePath(PAGE_ROUTE, shared));
        wx.reLaunch({ url: `/pages/bind/bind?redirect=${redirect}` });
        return;
      }
      // 精简模式：二级库独立表 + 只读，调用精简接口且无库存状态/详情。
      const liteMode = featureModes.secondary_warehouse_mode === SECONDARY_WAREHOUSE_LITE;
      const restored = { ...shared };
      if (liteMode || !isAllowedShareValue(restored.stockStatus, STOCK_STATUSES)) {
        delete restored.stockStatus;
      }
      this.setData({ liteMode, ...restored });
      await this.loadInventory(true);
    } catch (error) {
      this.setData({ loading: false });
      this.showError(error);
    }
  },

  onUnload() {
    clearTimeout(this.searchTimer);
  },

  async onPullDownRefresh() {
    await this.loadInventory(true);
    wx.stopPullDownRefresh();
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.loadingMore) {
      void this.loadInventory(false);
    }
  },

  onSearchChange(event) {
    const keyword = event.detail.value;
    this.setData({ keyword });
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => {
      void this.loadInventory(true);
    }, 350);
  },

  onStatusChange(event) {
    if (this.data.liteMode) {
      return;
    }
    const stockStatus = event.detail.value;
    if (stockStatus === this.data.stockStatus) {
      return;
    }
    this.setData({ stockStatus });
    void this.loadInventory(true);
  },

  async loadInventory(reset) {
    if (!reset && (this.data.loading || this.data.loadingMore || !this.data.hasMore)) {
      return;
    }
    const requestId = (this.requestId || 0) + 1;
    this.requestId = requestId;
    const page = reset ? 1 : this.data.page + 1;
    this.setData(reset ? { loading: true } : { loadingMore: true });
    try {
      const query = {
        page,
        page_size: this.data.pageSize,
      };
      const keyword = this.data.keyword.trim();
      if (keyword) {
        query.keyword = keyword;
      }
      if (!this.data.liteMode && this.data.stockStatus !== 'all') {
        query.stock_status = this.data.stockStatus;
      }
      const url = this.data.liteMode
        ? '/mini-program/lite-inventory'
        : '/mini-program/inventory';
      const result = await request({ url, data: query });
      if (requestId !== this.requestId) {
        return;
      }
      // 精简条目无 uuid/库存状态：统一补 current_qty 与行键，仅展示数量。
      const incoming = this.data.liteMode
        ? (result.items || []).map((item) => ({
            ...item,
            key: item.id,
            current_qty: item.quantity,
            is_lite: true,
          }))
        : (result.items || []).map((item) => ({ ...item, key: item.uuid, is_lite: false, ...decorateStock(item) }));
      const items = reset ? incoming : [...this.data.items, ...incoming];
      this.setData({
        items,
        page,
        total: result.total || 0,
        resultCount: t('resultCount', { count: result.total || 0 }),
        hasMore: items.length < (result.total || 0),
      });
    } catch (error) {
      if (requestId === this.requestId) {
        this.showError(error);
      }
    } finally {
      if (requestId === this.requestId) {
        this.setData({ loading: false, loadingMore: false });
      }
    }
  },

  openDetail(event) {
    const uuid = event.currentTarget.dataset.uuid;
    if (!uuid) {
      return;
    }
    wx.navigateTo({
      url: `/pages/material-detail/material-detail?uuid=${uuid}`,
    });
  },

  /** 分享路径：把当前搜索词与库存状态页签一起带出去（精简模式没有页签，不带该参数）。 */
  sharePath() {
    return buildSharePath(PAGE_ROUTE, {
      keyword: this.data.keyword.trim(),
      stockStatus: this.data.liteMode ? '' : this.data.stockStatus,
    });
  },

  onShareAppMessage() {
    return {
      title: t('shareInventory'),
      path: this.sharePath(),
    };
  },

  showError(error) {
    Toast({
      context: this,
      selector: '#inventory-toast',
      message: error.message || t('inventoryLoadFailed'),
      theme: 'error',
      direction: 'column',
    });
  },
}));
