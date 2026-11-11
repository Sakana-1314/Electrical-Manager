const toastModule = require('tdesign-miniprogram/toast/index');
const { request, requestCached } = require('../../utils/request');
const { buildRedirectQuery } = require('../../utils/navigation');
const { buildSharePath, readShareParams } = require('../../utils/share');
const { getMessages, t } = require('../../utils/i18n');
const { decoratePurchaseRecord } = require('../../utils/purchase');
const {
  buildFieldQuery,
  buildFilterQuery,
  buildSearchQuery,
  countFieldValues,
  hasActiveFilter,
  normalizeFilters,
  readFieldShare,
  sameFilters,
} = require('../../utils/filters');
const Toast = toastModule.default || toastModule;

// 分享链接携带的搜索 / 筛选参数（与页面 data 字段同名，便于直接回填）。
const SHARE_PARAMS = [
  'keyword',
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
// 分字段组合搜索：每个字段一个输入框，填多个即同时满足（AND），与网页端一致。
const FIELD_DEFS = [
  { key: 'name', labelKey: 'filterSearchName', param: 'name' },
  { key: 'modelSpec', labelKey: 'filterSearchModelSpec', param: 'model_spec' },
  { key: 'materialCode', labelKey: 'filterSearchMaterialCode', param: 'material_code' },
  { key: 'traceNo', labelKey: 'filterSearchTraceNo', param: 'trace_no' },
  { key: 'purchaseOrderNo', labelKey: 'filterSearchPurchaseOrderNo', param: 'purchase_order_no' },
  { key: 'usage', labelKey: 'filterSearchUsage', param: 'usage' },
];
const PAGE_ROUTE = '/pages/purchase-records/purchase-records';

/** 把字段定义转成组件要的 `{ key, label, placeholder }`（label 走 i18n）。 */
function toFieldDefs() {
  return FIELD_DEFS.map((field) => ({
    key: field.key,
    label: t(field.labelKey),
    placeholder: t('filterFieldValuePlaceholder'),
  }));
}

Page({
  data: {
    items: [],
    keyword: '',
    // 搜索字段：空串 = 综合（跨名称 / 型号 / 编码 / 追溯号 / 单号）。
    /** 分字段组合搜索的已生效值：`{ [fieldKey]: value }`，空串表示该字段不参与过滤。 */
    fieldValues: {},
    fieldDefs: [],
    // 当前生效的筛选值：key 与分享参数同名，空串表示不限。
    filters: {
      status: '',
      subitemNo: '',
      category: '',
      salesperson: '',
      actualDemandPerson: '',
      purchaseResponsible: '',
    },
    /** 筛选项没拉到时为 true：面板里显示一行「重新加载」，不弹打断式提示。 */
    optionsFailed: false,
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
    // 分享链接带来的搜索 / 筛选：先解析，等筛选项加载完再回填（面板要靠选项才能解析出文案）。
    const shared = readShareParams(options, SHARE_PARAMS);
    // 重试筛选项时复用同一份分享值，保证「分享值补进选项」在重试后仍然生效。
    this.lastShared = shared;
    this.setData({ fieldDefs: toFieldDefs() });
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

  /** 把分享 / 回跳带来的参数并进当前状态（多个单字段参数还原成组合搜索）。 */
  applyShared(shared) {
    const filters = { ...this.data.filters };
    FILTER_SECTIONS.forEach((key) => {
      if (shared[key] !== undefined) filters[key] = shared[key];
    });
    const fieldValues = readFieldShare(shared, FIELD_DEFS);
    const patch = {
      filters,
      fieldValues,
      filtered: hasActiveFilter(filters, FILTER_SECTIONS) || countFieldValues(fieldValues, FIELD_DEFS) > 0,
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

  /** 收起态搜索框：只做综合搜索（跨字段），多字段组合在筛选面板里。 */
  onSearchChange(event) {
    this.setData({ keyword: (event.detail && event.detail.value) || '' });
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => void this.loadPlans(true), 350);
  },

  /** 筛选面板确认：整体替换筛选值与分字段条件后重新取第一页。 */
  onFilterChange(event) {
    const detail = event.detail || {};
    const filters = normalizeFilters(detail.values || {}, FILTER_SECTIONS);
    const fieldValues = detail.fields || {};
    if (
      sameFilters(this.data.filters, filters, FILTER_SECTIONS) &&
      JSON.stringify(this.data.fieldValues) === JSON.stringify(fieldValues)
    ) {
      return;
    }
    this.setData({
      filters,
      fieldValues,
      filtered: hasActiveFilter(filters, FILTER_SECTIONS) || countFieldValues(fieldValues, FIELD_DEFS) > 0,
    });
    void this.loadPlans(true);
  },

  /** 面板上的「重新加载」：重拉筛选项（不重新登录、不重查列表）。 */
  onRetryOptions() {
    void this.loadFilterOptions(this.lastShared || {});
  },

  async loadFilterOptions(shared = {}) {
    let statuses = [];
    let subitemNos = [];
    let categories = [];
    let optionsFailed = false;
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
      // 选项拉不到时列表照常可用：不弹打断式提示（会让人以为页面坏了），
      // 把状态传给筛选面板，由面板里的一行「重新加载」兜底。
      optionsFailed = true;
    }
    this.setData({
      optionsFailed,
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
        ...buildSearchQuery(this.data.keyword),
        ...buildFieldQuery(this.data.fieldValues, FIELD_DEFS),
        ...buildFilterQuery(this.data.filters, FILTER_SPEC),
      };
      const result = await request({ url: '/mini-program/purchase-records', data });
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
      if (requestId === this.requestId) this.showError(error);
    } finally {
      if (requestId === this.requestId) this.setData({ loading: false, loadingMore: false });
    }
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
});
