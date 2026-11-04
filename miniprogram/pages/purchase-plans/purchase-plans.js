const toastModule = require('tdesign-miniprogram/toast/index');
const { request, requestCached } = require('../../utils/request');
const { buildRedirectQuery } = require('../../utils/navigation');
const { buildSharePath, readShareParams } = require('../../utils/share');
const { getMessages, setNavigationBarTitle, t } = require('../../utils/i18n');
const { withTheme } = require('../../utils/theme');
const { hasActiveFilter, normalizeFilters, sameFilters } = require('../../utils/filters');
const Toast = toastModule.default || toastModule;

// 分享链接携带的搜索 / 筛选参数（与页面 data 字段同名，便于直接回填）。
const SHARE_PARAMS = ['keyword', 'actualDemandPerson', 'subitemNo', 'urgency', 'category'];
// 筛选面板的分区（key 即分享参数名），选项在拿到 filter-options 后填充。
const FILTER_SECTIONS = ['urgency', 'category', 'actualDemandPerson', 'subitemNo'];
const PAGE_ROUTE = '/pages/purchase-plans/purchase-plans';

function decoratePlan(item) {
  return {
    ...item,
    plan_date_label: String(item.plan_date || '').replace(/-/g, '/'),
    quantity_label: `${item.planned_qty} ${item.unit_name}`,
    // 紧急程度三档：非常紧急用危险色，紧急用警告色，正常不额外强调。
    urgency_theme:
      item.urgency === '非常紧急' ? 'danger' : item.urgency === '紧急' ? 'warning' : 'default',
  };
}

Page(withTheme({
  data: {
    items: [],
    keyword: '',
    // 当前生效的筛选值：key 与分享参数同名，空串表示不限。
    filters: {
      actualDemandPerson: '',
      subitemNo: '',
      urgency: '',
      category: '',
    },
    filterSections: [],
    /** 是否有生效的筛选（空态文案据此区分「本来为空」与「筛空了」）。 */
    filtered: false,
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
    // 面板里的选项要靠 options 才能把当前值解析成文案，早于选项写入会显示成原值。
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
      await this.loadFilterOptions(shared, displayName);
      this.applyShared(shared);
      await this.loadPlans(true);
    } catch (error) {
      this.setData({ loading: false });
      this.showError(error);
    }
  },

  /** 把分享 / 回跳带来的参数并进当前筛选状态（只认 FILTER_SECTIONS 与 keyword）。 */
  applyShared(shared) {
    const filters = { ...this.data.filters };
    let changed = false;
    FILTER_SECTIONS.forEach((key) => {
      if (shared[key] !== undefined) {
        filters[key] = shared[key];
        changed = true;
      }
    });
    const patch = {};
    if (changed) {
      patch.filters = filters;
      patch.filtered = hasActiveFilter(filters, FILTER_SECTIONS);
    }
    if (shared.keyword !== undefined) patch.keyword = shared.keyword;
    if (Object.keys(patch).length) this.setData(patch);
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

  /** 筛选面板确认：整体替换筛选值后重新取第一页。 */
  onFilterChange(event) {
    const values = (event.detail && event.detail.values) || {};
    const filters = normalizeFilters(values, FILTER_SECTIONS);
    // 面板点「确定」但条件没变（含「全部」原地确认）：不重复请求。
    if (sameFilters(this.data.filters, filters, FILTER_SECTIONS)) {
      return;
    }
    this.setData({ filters, filtered: hasActiveFilter(filters, FILTER_SECTIONS) });
    void this.loadPlans(true);
  },

  /**
   * 加载筛选选项。
   *
   * 提报员工选项把「当前用户」固定置顶（value 用哨兵值，避免与真实姓名冲突），
   * 分享带来的值若已不在候选里也补进选项，保证面板能看到「筛了什么」。
   */
  async loadFilterOptions(shared = {}, displayName = '') {
    let persons = [];
    let subitemNos = [];
    let urgencies = [];
    let categories = [];
    try {
      const result = await requestCached({ url: '/mini-program/purchase-plans/filter-options' });
      persons = (result.actual_demand_persons || []).filter(Boolean);
      subitemNos = (result.subitem_nos || []).filter(Boolean);
      urgencies = (result.urgencies || []).filter(Boolean);
      categories = (result.categories || []).filter(Boolean);
    } catch (_error) {
      // 选项加载失败不阻塞列表，但提示用户，并至少保留「全部」选项
      Toast({
        context: this,
        selector: '#purchase-plans-toast',
        message: t('purchasePlanFilterOptionsLoadFailed'),
        theme: 'warning',
        direction: 'column',
      });
    }
    const currentUserSuffix = t('currentUserSuffix');
    if (displayName) {
      persons = persons.filter((value) => value !== displayName);
      persons.unshift(displayName);
    }
    this.setData({
      filterSections: [
        this.buildSection('urgency', t('filterUrgency'), urgencies, shared.urgency),
        this.buildSection('category', t('filterCategory'), categories, shared.category),
        this.buildSection(
          'actualDemandPerson',
          t('filterActualDemandPerson'),
          persons,
          shared.actualDemandPerson,
          // 当前用户固定置顶，且标出「当前用户」方便快速切到自己。
          (value) => (value === displayName ? `${value}${currentUserSuffix}` : value),
        ),
        this.buildSection('subitemNo', t('filterSubitemNo'), subitemNos, shared.subitemNo),
      ],
    });
  },

  /**
   * 组装一个筛选分区：首项「全部」+ 传入的候选值（字符串）。
   * sharedValue 不在候选里时补一项，保证面板能看到「筛了什么」；labelOf 用于个别项的展示改写。
   */
  buildSection(key, title, values, sharedValue, labelOf = (value) => value) {
    const list = [{ label: t('all'), value: '' }].concat(
      values.map((value) => ({ label: labelOf(value), value })),
    );
    if (sharedValue && !list.some((option) => option.value === sharedValue)) {
      list.splice(1, 0, { label: sharedValue, value: sharedValue });
    }
    return { key, title, options: list };
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
      const filters = this.data.filters;
      if (filters.actualDemandPerson) data.actual_demand_person = filters.actualDemandPerson;
      if (filters.subitemNo) data.subitem_no = filters.subitemNo;
      if (filters.urgency) data.urgency = filters.urgency;
      if (filters.category) data.category = filters.category;
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

  /** 分享路径：把当前搜索词与全部筛选值一起带出去。 */
  sharePath() {
    const filters = this.data.filters;
    return buildSharePath(PAGE_ROUTE, {
      keyword: this.data.keyword.trim(),
      actualDemandPerson: filters.actualDemandPerson,
      subitemNo: filters.subitemNo,
      urgency: filters.urgency,
      category: filters.category,
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
