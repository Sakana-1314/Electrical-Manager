const toastModule = require('tdesign-miniprogram/toast/index');
const { request } = require('../../utils/request');
const { buildRedirectQuery } = require('../../utils/navigation');
const { buildSharePath, readShareParams, withSharedOption } = require('../../utils/share');
const { getMessages, setNavigationBarTitle, t } = require('../../utils/i18n');
const { withTheme } = require('../../utils/theme');
const Toast = toastModule.default || toastModule;

// 分享链接携带的搜索 / 筛选参数（与页面 data 字段同名，便于直接回填）。
const SHARE_PARAMS = ['keyword', 'actualDemandPerson', 'subitemNo'];
const PAGE_ROUTE = '/pages/purchase-plans/purchase-plans';

function decoratePlan(item) {
  return {
    ...item,
    plan_date_label: String(item.plan_date || '').replace(/-/g, '/'),
    quantity_label: `${item.planned_qty} ${item.unit_name}`,
    urgency_theme: item.urgency === '紧急' ? 'warning' : 'default',
  };
}

Page(withTheme({
  data: {
    items: [],
    keyword: '',
    actualDemandPerson: '',
    subitemNo: '',
    actualDemandPersonOptions: [],
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
    setNavigationBarTitle('purchasePlansTitle');
    // 分享链接带来的搜索 / 筛选：先解析出来，等筛选项加载完再回填——
    // 下拉项要靠 options 才能把当前值解析成文案，早于选项写入会显示成「全部××」。
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
      const displayName = session.user?.display_name || '';
      await this.loadFilterOptions(displayName, shared);
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

  onActualDemandPersonChange(event) {
    const value = event.detail.value || '';
    this.setData({ actualDemandPerson: value });
    void this.loadPlans(true);
  },

  onSubitemNoChange(event) {
    const value = event.detail.value || '';
    this.setData({ subitemNo: value });
    void this.loadPlans(true);
  },

  async loadFilterOptions(displayName, shared = {}) {
    let persons = [];
    let subitemNos = [];
    try {
      const result = await request({ url: '/mini-program/purchase-plans/filter-options' });
      persons = (result.actual_demand_persons || []).filter(Boolean);
      subitemNos = (result.subitem_nos || []).filter(Boolean);
    } catch (error) {
      // 选项加载失败不阻塞列表，但提示用户，并至少保留「全部」选项
      Toast({
        context: this,
        selector: '#purchase-plans-toast',
        message: t('purchasePlanFilterOptionsLoadFailed'),
        theme: 'warning',
      });
    }
    // 当前用户固定置顶，方便快速切换到自己
    if (displayName) {
      persons = persons.filter((value) => value !== displayName);
      persons.unshift(displayName);
    }
    const currentUserSuffix = t('currentUserSuffix');
    this.setData({
      // 分享带来的筛选值可能已不在选项里（如那人名下已无在途计划）：
      // 补进选项，避免下拉显示「全部」而列表其实还在按该值过滤。
      actualDemandPersonOptions: withSharedOption(
        [
          { label: t('allActualDemandPersons'), value: '' },
          ...persons.map((value) => ({
            label: value === displayName ? `${value}${currentUserSuffix}` : value,
            value,
          })),
        ],
        shared.actualDemandPerson,
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
      const actualDemandPerson = this.data.actualDemandPerson.trim();
      if (actualDemandPerson) data.actual_demand_person = actualDemandPerson;
      const subitemNo = this.data.subitemNo.trim();
      if (subitemNo) data.subitem_no = subitemNo;
      const result = await request({ url: '/mini-program/purchase-plans', data });
      if (requestId !== this.requestId) return;
      const incoming = (result.items || []).map(decoratePlan);
      const items = reset ? incoming : [...this.data.items, ...incoming];
      this.setData({
        items,
        page,
        total: result.total || 0,
        resultCount: t('purchasePlanResultCount', { count: result.total || 0 }),
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
      url: `/pages/purchase-plan-detail/purchase-plan-detail?id=${event.currentTarget.dataset.id}`,
    });
  },

  /** 分享路径：把当前搜索词与两个筛选值一起带出去。 */
  sharePath() {
    return buildSharePath(PAGE_ROUTE, {
      keyword: this.data.keyword.trim(),
      actualDemandPerson: this.data.actualDemandPerson,
      subitemNo: this.data.subitemNo,
    });
  },

  onShareAppMessage() {
    return {
      title: t('sharePurchasePlans'),
      path: this.sharePath(),
    };
  },

  showError(error) {
    Toast({
      context: this,
      selector: '#purchase-plans-toast',
      message: error.message || t('purchasePlansLoadFailed'),
      theme: 'error',
      direction: 'column',
    });
  },
}));
