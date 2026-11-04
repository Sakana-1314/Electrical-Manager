const toastModule = require('tdesign-miniprogram/toast/index');
const { request, requestCached } = require('../../utils/request');
const { buildRedirectQuery } = require('../../utils/navigation');
const { buildSharePath, readShareParams } = require('../../utils/share');
const { getMessages, setNavigationBarTitle, t } = require('../../utils/i18n');
const { withTheme } = require('../../utils/theme');
const { hasActiveFilter, normalizeFilters, sameFilters } = require('../../utils/filters');
const Toast = toastModule.default || toastModule;

// 分享链接携带的搜索 / 筛选参数（与页面 data 字段同名，便于直接回填）。
const SHARE_PARAMS = ['keyword', 'status', 'subitemNo', 'category', 'salesperson', 'actualDemandPerson'];
// 筛选面板的分区（key 即分享参数名），选项在拿到 filter-options 后填充。
const FILTER_SECTIONS = ['status', 'category', 'subitemNo', 'salesperson', 'actualDemandPerson'];
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
    // 当前生效的筛选值：key 与分享参数同名，空串表示不限。
    filters: {
      status: '',
      subitemNo: '',
      category: '',
      salesperson: '',
      actualDemandPerson: '',
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
    setNavigationBarTitle('purchaseRecordsTitle');
    // 分享链接带来的搜索 / 筛选：先解析，等筛选项加载完再回填（面板要靠选项才能解析出文案）。
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

  async loadFilterOptions(shared = {}) {
    let statuses = [];
    let subitemNos = [];
    let categories = [];
    let salespersons = [];
    let persons = [];
    try {
      const result = await requestCached({ url: '/mini-program/purchase-records/filter-options' });
      statuses = (result.statuses || []).filter(Boolean);
      subitemNos = (result.subitem_nos || []).filter(Boolean);
      categories = (result.categories || []).filter(Boolean);
      salespersons = (result.salespersons || []).filter(Boolean);
      persons = (result.actual_demand_persons || []).filter(Boolean);
    } catch (_error) {
      // 选项加载失败不阻塞列表，但提示用户，并至少保留「全部」选项
      Toast({
        context: this,
        selector: '#purchase-records-toast',
        message: t('purchaseRecordFilterOptionsLoadFailed'),
        theme: 'warning',
        direction: 'column',
      });
    }
    this.setData({
      filterSections: [
        this.buildSection('status', t('filterStatus'), statuses, shared.status),
        this.buildSection('category', t('filterCategory'), categories, shared.category),
        this.buildSection('subitemNo', t('filterSubitemNo'), subitemNos, shared.subitemNo),
        this.buildSection('salesperson', t('filterSalesperson'), salespersons, shared.salesperson),
        this.buildSection(
          'actualDemandPerson',
          t('filterActualDemandPerson'),
          persons,
          shared.actualDemandPerson,
        ),
      ],
    });
  },

  /** 组装一个筛选分区：首项固定「全部」；分享值缺失时补一项，避免面板显示成原值。 */
  buildSection(key, title, values, sharedValue) {
    const list = [{ label: t('all'), value: '' }].concat(
      values.map((value) => ({ label: value, value })),
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
      if (filters.status) data.status = filters.status;
      if (filters.subitemNo) data.subitem_no = filters.subitemNo;
      if (filters.category) data.category = filters.category;
      if (filters.salesperson) data.salesperson = filters.salesperson;
      if (filters.actualDemandPerson) data.actual_demand_person = filters.actualDemandPerson;
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

  /** 分享路径：把当前搜索词与全部筛选值一起带出去。 */
  sharePath() {
    const filters = this.data.filters;
    return buildSharePath(PAGE_ROUTE, {
      keyword: this.data.keyword.trim(),
      status: filters.status,
      subitemNo: filters.subitemNo,
      category: filters.category,
      salesperson: filters.salesperson,
      actualDemandPerson: filters.actualDemandPerson,
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
