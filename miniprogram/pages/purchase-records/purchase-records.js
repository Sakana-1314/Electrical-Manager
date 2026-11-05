const toastModule = require('tdesign-miniprogram/toast/index');
const { request, requestCached } = require('../../utils/request');
const { buildRedirectQuery } = require('../../utils/navigation');
const { buildSharePath, readShareParams } = require('../../utils/share');
const { getMessages, setNavigationBarTitle, t } = require('../../utils/i18n');
const { withTheme } = require('../../utils/theme');
const {
  buildFieldQuery,
  buildFilterQuery,
  buildSearchQuery,
  hasActiveFilter,
  normalizeFilters,
  sameFilters,
} = require('../../utils/filters');
const Toast = toastModule.default || toastModule;

// 分享链接携带的搜索 / 筛选参数（与页面 data 字段同名，便于直接回填）。
const SHARE_PARAMS = [
  'keyword',
  'searchField',
  'status',
  'category',
  'subitemNo',
  'salesperson',
  'actualDemandPerson',
  'purchaseResponsible',
  'name',
  'modelSpec',
  'materialCode',
  'traceNo',
  'purchaseOrderNo',
  'usage',
];
// 筛选面板的分区；与网页端字段一一对应。
const FILTER_SECTIONS = ['status', 'category', 'subitemNo', 'salesperson', 'actualDemandPerson', 'purchaseResponsible'];
// 分区 key → 请求参数。
const FILTER_SPEC = {
  status: { kind: 'single', param: 'status' },
  category: { kind: 'single', param: 'category' },
  subitemNo: { kind: 'single', param: 'subitem_no' },
  salesperson: { kind: 'single', param: 'salesperson' },
  actualDemandPerson: { kind: 'single', param: 'actual_demand_person' },
  purchaseResponsible: { kind: 'single', param: 'purchase_responsible' },
};
// 分字段搜索的字段候选：与网页端「名称 / 型号 / 追溯号 / 申购单号 / 用途 …」一一对应。
const SEARCH_FIELDS = [
  { labelKey: 'filterSearchAll', value: '', param: '' },
  { labelKey: 'filterSearchName', value: 'name', param: 'name' },
  { labelKey: 'filterSearchModelSpec', value: 'modelSpec', param: 'model_spec' },
  { labelKey: 'filterSearchMaterialCode', value: 'materialCode', param: 'material_code' },
  { labelKey: 'filterSearchTraceNo', value: 'traceNo', param: 'trace_no' },
  { labelKey: 'filterSearchPurchaseOrderNo', value: 'purchaseOrderNo', param: 'purchase_order_no' },
  { labelKey: 'filterSearchUsage', value: 'usage', param: 'usage' },
];
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
    // 搜索字段：空串 = 综合（跨名称 / 型号 / 编码 / 追溯号 / 单号）。
    searchField: '',
    fieldConditions: [],
    searchFields: [],
    // 当前生效的筛选值：key 与分享参数同名，空串表示不限。
    filters: {
      status: '',
      subitemNo: '',
      category: '',
      salesperson: '',
      actualDemandPerson: '',
      purchaseResponsible: '',
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
    this.setData({ searchFields: SEARCH_FIELDS.map((field) => ({ label: t(field.labelKey), value: field.value })) });
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

  /** 把分享 / 回跳带来的参数并进当前状态（分字段参数还原成条件）。 */
  applyShared(shared) {
    const filters = { ...this.data.filters };
    FILTER_SECTIONS.forEach((key) => {
      if (shared[key] !== undefined) filters[key] = shared[key];
    });
    const conditions = [];
    SEARCH_FIELDS.forEach((field) => {
      if (!field.value) return;
      if (shared[field.value] !== undefined) conditions.push({ field: field.value, value: shared[field.value] });
    });
    const patch = {
      filters,
      fieldConditions: conditions,
      searchField: shared.searchField || '',
      filtered: hasActiveFilter(filters, FILTER_SECTIONS) || conditions.length > 0,
    };
    if (shared.keyword !== undefined) patch.keyword = shared.keyword;
    this.setData(patch);
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

  /** 搜索框：写入关键词与当前字段后防抖取数（切字段也走这里）。 */
  onSearchChange(event) {
    const detail = event.detail || {};
    const patch = { keyword: detail.value || '' };
    if (detail.field !== undefined) patch.searchField = detail.field || '';
    this.setData(patch);
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => void this.loadPlans(true), 350);
  },

  /** 筛选面板确认：整体替换筛选值与分字段条件后重新取第一页。 */
  onFilterChange(event) {
    const detail = event.detail || {};
    const filters = normalizeFilters(detail.values || {}, FILTER_SECTIONS);
    const conditions = (detail.conditions || []).filter((condition) => condition && condition.field && condition.value);
    if (
      sameFilters(this.data.filters, filters, FILTER_SECTIONS) &&
      JSON.stringify(this.data.fieldConditions) === JSON.stringify(conditions)
    ) {
      return;
    }
    this.setData({
      filters,
      fieldConditions: conditions,
      filtered: hasActiveFilter(filters, FILTER_SECTIONS) || conditions.length > 0,
    });
    void this.loadPlans(true);
  },

  async loadFilterOptions(shared = {}) {
    let statuses = [];
    let subitemNos = [];
    let categories = [];
    let salespersons = [];
    let persons = [];
    let responsibles = [];
    try {
      const result = await requestCached({ url: '/mini-program/purchase-records/filter-options' });
      statuses = (result.statuses || []).filter(Boolean);
      subitemNos = (result.subitem_nos || []).filter(Boolean);
      categories = (result.categories || []).filter(Boolean);
      salespersons = (result.salespersons || []).filter(Boolean);
      persons = (result.actual_demand_persons || []).filter(Boolean);
      responsibles = (result.purchase_responsibles || []).filter(Boolean);
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
        this.buildSection(
          'purchaseResponsible',
          t('filterPurchaseResponsible'),
          responsibles,
          shared.purchaseResponsible,
        ),
      ],
    });
  },

  /** 组装一个单选筛选分区：首项固定「全部」；分享值缺失时补一项，避免面板显示成原值。 */
  buildSection(key, title, values, sharedValue) {
    const list = [{ label: t('all'), value: '' }].concat(
      values.map((value) => ({ label: value, value })),
    );
    if (sharedValue && !list.some((option) => option.value === sharedValue)) {
      list.splice(1, 0, { label: sharedValue, value: sharedValue });
    }
    return { key, title, kind: 'single', options: list };
  },

  async loadPlans(reset) {
    if (!reset && (this.data.loading || this.data.loadingMore || !this.data.hasMore)) return;
    const requestId = (this.requestId || 0) + 1;
    this.requestId = requestId;
    const page = reset ? 1 : this.data.page + 1;
    this.setData(reset ? { loading: true } : { loadingMore: true });
    try {
      const data = {
        page,
        page_size: this.data.pageSize,
        ...buildSearchQuery(this.data.keyword, this.data.searchField, SEARCH_FIELDS),
        ...buildFieldQuery(this.data.fieldConditions, SEARCH_FIELDS),
        ...buildFilterQuery(this.data.filters, FILTER_SPEC),
      };
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

  /** 分享路径：关键词、搜索字段、筛选项与分字段条件一起带出去。 */
  sharePath() {
    const filters = this.data.filters;
    return buildSharePath(PAGE_ROUTE, {
      keyword: this.data.keyword.trim(),
      searchField: this.data.searchField,
      status: filters.status,
      subitemNo: filters.subitemNo,
      category: filters.category,
      salesperson: filters.salesperson,
      actualDemandPerson: filters.actualDemandPerson,
      purchaseResponsible: filters.purchaseResponsible,
      ...(this.data.fieldConditions || []).reduce((params, condition) => {
        if (condition.field && condition.value) params[condition.field] = condition.value;
        return params;
      }, {}),
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
