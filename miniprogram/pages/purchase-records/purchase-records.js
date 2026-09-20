const toastModule = require('tdesign-miniprogram/toast/index');
const { request } = require('../../utils/request');
const { buildRedirectQuery } = require('../../utils/navigation');
const { buildSharePath, readShareParams, withSharedOption } = require('../../utils/share');
const { getMessages, setNavigationBarTitle, t } = require('../../utils/i18n');
const { withTheme } = require('../../utils/theme');
const Toast = toastModule.default || toastModule;

// 分享链接携带的搜索 / 筛选参数（与页面 data 字段同名，便于直接回填）。
const SHARE_PARAMS = ['keyword', 'status', 'subitemNo'];
const PAGE_ROUTE = '/pages/purchase-records/purchase-records';

function decorateRecord(item) {
  return {
    ...item,
    plan_date_label: String(item.plan_date || '').replace(/-/g, '/'),
    quantity_label: `${item.purchase_qty} ${item.unit_name}`,
    purchase_order_no_label: item.purchase_order_no || t('notSet'),
    status_theme:
      item.status === '已入库'
        ? 'success'
        : item.status === '部分入库'
          ? 'warning'
          : item.status === '已采购'
            ? 'primary'
            : 'default',
  };
}

Page(withTheme({
  data: {
    items: [],
    keyword: '',
    status: '',
    statusOptions: [],
    subitemNo: '',
    subitemNoOptions: [],
    page: 1,
    pageSize: 15,
    total: 0,
    hasMore: false,
    loading: true,
    loadingMore: false,
    resultCount: '',
    backTopVisible: false,
    i18n: getMessages(),
  },

  async onLoad(options = {}) {
    setNavigationBarTitle('purchaseRecordsTitle');
    // 分享链接带来的搜索 / 筛选：先解析，等筛选项加载完再回填（下拉项要靠 options 才能解析出文案）。
    const shared = readShareParams(options, SHARE_PARAMS);
    try {
      const session = await getApp().globalData.authPromise;
      if (session.account_disabled) return;
      if (session.registration_disabled) return;
      if (session.requires_profile) {
        // 带上分享参数回跳，未注册用户绑定后仍落在同一份筛选结果上。
        const redirect = buildRedirectQuery(buildSharePath(PAGE_ROUTE, shared));
        wx.reLaunch({ url: `/pages/bind/bind?redirect=${redirect}` });
        return;
      }
      await this.loadFilterOptions(shared);
      if (Object.keys(shared).length) this.setData(shared);
      await this.loadPlans(true);
    } catch (error) {
      this.setData({ loading: false });
      this.showError(error);
    }
  },

  onUnload() {
    clearTimeout(this.searchTimer);
  },

  async onPullDownRefresh() {
    await this.loadPlans(true);
    wx.stopPullDownRefresh();
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.loadingMore) void this.loadPlans(false);
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
    this.searchTimer = setTimeout(() => void this.loadPlans(true), 350);
  },

  onStatusChange(event) {
    const value = event.detail.value || '';
    this.setData({ status: value });
    void this.loadPlans(true);
  },

  onSubitemNoChange(event) {
    const value = event.detail.value || '';
    this.setData({ subitemNo: value });
    void this.loadPlans(true);
  },

  async loadFilterOptions(shared = {}) {
    let statuses = [];
    let subitemNos = [];
    try {
      const result = await request({ url: '/mini-program/purchase-records/filter-options' });
      statuses = (result.statuses || []).filter(Boolean);
      subitemNos = (result.subitem_nos || []).filter(Boolean);
    } catch (error) {
      // 选项加载失败不阻塞列表，但提示用户，并至少保留「全部状态」选项
      Toast({
        context: this,
        selector: '#purchase-records-toast',
        message: t('purchaseRecordFilterOptionsLoadFailed'),
        theme: 'warning',
      });
    }
    this.setData({
      // 分享带来的筛选值可能已不在选项里：补进选项，避免下拉显示「全部」而列表仍在过滤。
      statusOptions: withSharedOption(
        [
          { label: t('allPurchaseStatuses'), value: '' },
          ...statuses.map((value) => ({ label: value, value })),
        ],
        shared.status,
      ),
      subitemNoOptions: withSharedOption(
        [
          { label: t('allSubitemNos'), value: '' },
          ...subitemNos.map((value) => ({ label: value, value })),
        ],
        shared.subitemNo,
      ),
    });
  },

  async loadPlans(reset) {
    if (!reset && (this.data.loading || this.data.loadingMore || !this.data.hasMore)) return;
    const requestId = (this.requestId || 0) + 1;
    this.requestId = requestId;
    const page = reset ? 1 : this.data.page + 1;
    this.setData(reset ? { loading: true } : { loadingMore: true });
    try {
      const data = { page, page_size: this.data.pageSize };
      const keyword = this.data.keyword.trim();
      if (keyword) data.keyword = keyword;
      const status = this.data.status.trim();
      if (status) data.status = status;
      const subitemNo = this.data.subitemNo.trim();
      if (subitemNo) data.subitem_no = subitemNo;
      const result = await request({ url: '/mini-program/purchase-records', data });
      if (requestId !== this.requestId) return;
      const incoming = (result.items || []).map(decorateRecord);
      const items = reset ? incoming : [...this.data.items, ...incoming];
      this.setData({
        items,
        page,
        total: result.total || 0,
        resultCount: t('purchaseRecordResultCount', { count: result.total || 0 }),
        hasMore: items.length < (result.total || 0),
      });
    } catch (error) {
      if (requestId === this.requestId) this.showError(error);
    } finally {
      if (requestId === this.requestId) this.setData({ loading: false, loadingMore: false });
    }
  },

  /** 分享路径：把当前搜索词与两个筛选值一起带出去。 */
  sharePath() {
    return buildSharePath(PAGE_ROUTE, {
      keyword: this.data.keyword.trim(),
      status: this.data.status,
      subitemNo: this.data.subitemNo,
    });
  },

  onShareAppMessage() {
    return {
      title: t('sharePurchaseRecords'),
      path: this.sharePath(),
    };
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
      selector: '#purchase-records-toast',
      message: error.message || t('purchaseRecordsLoadFailed'),
      theme: 'error',
      direction: 'column',
    });
  },
}));
