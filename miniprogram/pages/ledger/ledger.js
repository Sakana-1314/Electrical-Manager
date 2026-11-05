const toastModule = require('tdesign-miniprogram/toast/index');
const { request, requestCached } = require('../../utils/request');
const { buildRedirectQuery } = require('../../utils/navigation');
const { buildSharePath, readShareParams } = require('../../utils/share');
const { getMessages, setNavigationBarTitle, t } = require('../../utils/i18n');
const { withTheme } = require('../../utils/theme');
const Toast = toastModule.default || toastModule;

// 分享链接携带的搜索词与标签筛选（与页面 data 字段同名，便于直接回填）。
const SHARE_PARAMS = ['keyword', 'tagId'];
// 筛选面板的分区：网页端台账只有「关键字 + 标签」两项，这里保持一致。
const FILTER_SECTIONS = ['tagId'];
const FILTER_SPEC = { tagId: { kind: 'single', param: 'tag_ids' } };
const PAGE_ROUTE = '/pages/ledger/ledger';

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
    filters: { tagId: '' },
    /** 标签候选没拉到时为 true：面板里显示一行「重新加载」。 */
    optionsFailed: false,
    filterSections: [],
    filtered: false,
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

  async onLoad(options = {}) {
    // 必须在第一个 await 之前置位：onShow 紧随 onLoad 同步触发（见 hazards.js 同名注释）。
    this.skipNextShow = true;
    setNavigationBarTitle('ledgerTitle');
    // 分享链接带来的搜索词：解析后立刻回填，列表与搜索框都按它渲染。
    const shared = readShareParams(options, SHARE_PARAMS);
    try {
      const session = await getApp().globalData.authPromise;
      if (session.account_disabled) return;
      if (session.registration_disabled) return;
      if (session.requires_profile) {
        // 带上分享参数回跳，未注册用户绑定后仍落在同一份搜索结果上。
        const redirect = buildRedirectQuery(buildSharePath(PAGE_ROUTE, shared));
        wx.reLaunch({ url: `/pages/bind/bind?redirect=${redirect}` });
        return;
      }
      if (Object.keys(shared).length) this.setData(shared);
      await this.loadFilterOptions(shared);
      // 分享带来的标签回填到筛选状态（面板据此显示已选）。
      if (shared.tagId) this.setData({ filters: { tagId: shared.tagId }, filtered: true });
      await this.loadLedger(true);
    } catch (error) {
      this.setData({ loading: false });
      this.showError(error);
    }
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

  /** 筛选面板确认：标签单选，条件没变时不重复请求。 */
  onFilterChange(event) {
    const values = (event.detail && event.detail.values) || {};
    const tagId = values.tagId || '';
    if (tagId === this.data.filters.tagId) return;
    this.setData({ filters: { tagId }, filtered: !!tagId });
    void this.loadLedger(true);
  },

  /** 面板上的「重新加载」：重拉标签候选值（不重新登录、不重查列表）。 */
  onRetryOptions() {
    void this.loadFilterOptions(this.lastShared || {});
  },

  /** 标签候选值：平铺 + 层级路径（手机上不画树）。 */
  async loadFilterOptions(shared = {}) {
    this.lastShared = shared;
    let tags = [];
    let optionsFailed = false;
    try {
      const result = await requestCached({ url: '/mini-program/ledger-items/tag-options' });
      tags = (result || []).filter((tag) => tag && tag.id);
    } catch (_error) {
      // 列表照常可用，只有标签候选拿不到：交给面板里的一行「重新加载」兜底。
      optionsFailed = true;
    }
    const options = [{ label: t('all'), value: '' }].concat(
      tags.map((tag) => ({ label: tag.path || tag.name, value: String(tag.id) })),
    );
    if (shared.tagId && !options.some((option) => option.value === shared.tagId)) {
      options.splice(1, 0, { label: shared.tagId, value: shared.tagId });
    }
    this.setData({
      optionsFailed,
      filterSections: [{ key: 'tagId', title: t('filterLedgerTag'), kind: 'single', options }],
    });
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
      if (this.data.filters.tagId) data.tag_ids = this.data.filters.tagId;
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

  /** 分享路径：把当前搜索词与标签筛选一起带出去。 */
  sharePath() {
    return buildSharePath(PAGE_ROUTE, {
      keyword: this.data.keyword.trim(),
      tagId: this.data.filters.tagId,
    });
  },

  onShareAppMessage() {
    return {
      title: t('shareLedger'),
      path: this.sharePath(),
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
