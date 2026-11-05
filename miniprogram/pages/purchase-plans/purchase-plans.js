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
  readFilterShare,
  sameFilters,
} = require('../../utils/filters');
const Toast = toastModule.default || toastModule;

// 分享链接携带的搜索 / 筛选参数（与页面 data 字段同名，便于直接回填）。
const SHARE_PARAMS = [
  'keyword',
  'searchField',
  'urgency',
  'category',
  'actualDemandPerson',
  'purchaseResponsible',
  'demandDepartment',
  'subitemNo',
  'name',
  'modelSpec',
  'materialCode',
  'planDateFrom',
  'planDateTo',
];
// 筛选面板的分区（key 即分享参数名），选项在拿到 filter-options 后填充；与网页端字段一一对应。
const FILTER_SECTIONS = ['urgency', 'category', 'actualDemandPerson', 'purchaseResponsible', 'demandDepartment', 'subitemNo', 'planDate'];
// 某个分区的 key → 请求参数（区间分区拆成两个参数）。
const FILTER_SPEC = {
  urgency: { kind: 'single', param: 'urgency' },
  category: { kind: 'single', param: 'category' },
  actualDemandPerson: { kind: 'single', param: 'actual_demand_person' },
  purchaseResponsible: { kind: 'single', param: 'purchase_responsible' },
  demandDepartment: { kind: 'single', param: 'demand_department' },
  subitemNo: { kind: 'single', param: 'subitem_no' },
  planDate: { kind: 'dateRange', fromParam: 'plan_date_from', toParam: 'plan_date_to' },
};
// 分字段搜索 / 综合搜索的字段候选（首项是「综合」，与网页端每个字段一个输入框等价）。
const SEARCH_FIELDS = [
  { labelKey: 'filterSearchAll', value: '', param: '' },
  { labelKey: 'filterSearchName', value: 'name', param: 'name' },
  { labelKey: 'filterSearchModelSpec', value: 'modelSpec', param: 'model_spec' },
  { labelKey: 'filterSearchMaterialCode', value: 'materialCode', param: 'material_code' },
];
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
    // 搜索字段：空串 = 综合（跨名称 / 型号 / 编码）；选了字段则只搜该字段。
    searchField: '',
    // 分字段搜索的已生效条件：[{ field, value }]（可与综合搜索同时存在）。
    fieldConditions: [],
    searchFields: [],
    // 当前生效的筛选值：key 与分享参数同名；单值为空串、区间为 { from, to }。
    filters: {
      actualDemandPerson: '',
      purchaseResponsible: '',
      demandDepartment: '',
      subitemNo: '',
      urgency: '',
      category: '',
      planDate: { from: '', to: '' },
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
    setNavigationBarTitle('purchasePlansTitle');
    // 分享链接带来的搜索 / 筛选：先解析出来，等筛选项加载完再回填——
    // 面板里的选项要靠 options 才能把当前值解析成文案，早于选项写入会显示成原值。
    const shared = readShareParams(options, SHARE_PARAMS);
    // 重试筛选项时复用同一份分享值，保证「分享值补进选项」在重试后仍然生效。
    this.lastShared = shared;
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
      const displayName = session.user?.display_name || '';
      await this.loadFilterOptions(shared, displayName);
      this.applyShared(shared);
      await this.loadPlans(true);
    } catch (error) {
      this.setData({ loading: false });
      this.showError(error);
    }
  },

  /**
   * 把分享 / 回跳带来的参数并进当前状态。
   *
   * 分字段搜索字段（name / modelSpec / materialCode）与综合 keyword 是两条独立通道：
   * 前者落到 fieldConditions，后者落到 keyword；searchField 决定搜索框作用于哪个字段。
   */
  applyShared(shared) {
    const filters = { ...this.data.filters };
    FILTER_SECTIONS.forEach((key) => {
      if (key === 'planDate') {
        if (shared.planDateFrom || shared.planDateTo) {
          filters.planDate = { from: shared.planDateFrom || '', to: shared.planDateTo || '' };
        }
        return;
      }
      if (shared[key] !== undefined) filters[key] = shared[key];
    });

    // 分享里的单字段参数还原成分字段条件。
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
    const values = detail.values || {};
    const filters = normalizeFilters(values, FILTER_SECTIONS, [], ['planDate']);
    const conditions = (detail.conditions || []).filter((condition) => condition && condition.field && condition.value);
    // 面板点「确定」但条件没变（含「全部」原地确认）：不重复请求。
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

  /**
   * 加载筛选选项。
   *
   * 提报员工选项把「当前用户」固定置顶（标出「当前用户」），
   * 分享带来的值若已不在候选里也补进选项，保证面板能看到「筛了什么」。
   */
  /** 面板上的「重新加载」：重拉筛选项（不重新登录、不重查列表）。 */
  onRetryOptions() {
    void this.loadFilterOptions(this.lastShared || {}, this.displayName || '');
  },

  async loadFilterOptions(shared = {}, displayName = '') {
    // 记住当前用户名：重试时要重新把它置顶到提报员工选项里。
    this.displayName = displayName;
    let persons = [];
    let responsibles = [];
    let departments = [];
    let optionsFailed = false;
    let subitemNos = [];
    let urgencies = [];
    let categories = [];
    try {
      const result = await requestCached({ url: '/mini-program/purchase-plans/filter-options' });
      persons = (result.actual_demand_persons || []).filter(Boolean);
      responsibles = (result.purchase_responsibles || []).filter(Boolean);
      departments = (result.demand_departments || []).filter(Boolean);
      subitemNos = (result.subitem_nos || []).filter(Boolean);
      urgencies = (result.urgencies || []).filter(Boolean);
      categories = (result.categories || []).filter(Boolean);
    } catch (_error) {
      // 选项拉不到时列表照常可用：不弹打断式提示（会让人以为页面坏了），
      // 把状态传给筛选面板，由面板里的一行「重新加载」兜底。
      optionsFailed = true;
    }
    const currentUserSuffix = t('currentUserSuffix');
    if (displayName) {
      persons = persons.filter((value) => value !== displayName);
      persons.unshift(displayName);
    }
    this.setData({
      optionsFailed,
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
        this.buildSection(
          'purchaseResponsible',
          t('filterPurchaseResponsible'),
          responsibles,
          shared.purchaseResponsible,
        ),
        this.buildSection(
          'demandDepartment',
          t('filterDemandDepartment'),
          departments,
          shared.demandDepartment,
        ),
        this.buildSection('subitemNo', t('filterSubitemNo'), subitemNos, shared.subitemNo),
        {
          key: 'planDate',
          title: t('filterPlanDate'),
          kind: 'dateRange',
          fromLabel: t('filterDateFrom'),
          toLabel: t('filterDateTo'),
        },
      ],
    });
  },

  /** 组装一个单选筛选分区：首项「全部」+ 传入的候选值（字符串）。 */
  buildSection(key, title, values, sharedValue, labelOf = (value) => value) {
    const list = [{ label: t('all'), value: '' }].concat(
      values.map((value) => ({ label: labelOf(value), value })),
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
      // 搜索：综合 / 单字段由 searchField 决定；分字段条件再叠加（AND）。
      const data = {
        page,
        page_size: this.data.pageSize,
        ...buildSearchQuery(this.data.keyword, this.data.searchField, SEARCH_FIELDS),
        ...buildFieldQuery(this.data.fieldConditions, SEARCH_FIELDS),
        ...buildFilterQuery(this.data.filters, FILTER_SPEC),
      };
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

  /** 分享路径：关键词、搜索字段、筛选项与分字段条件一起带出去。 */
  sharePath() {
    const filters = this.data.filters;
    const planDate = filters.planDate || {};
    return buildSharePath(PAGE_ROUTE, {
      keyword: this.data.keyword.trim(),
      searchField: this.data.searchField,
      urgency: filters.urgency,
      category: filters.category,
      actualDemandPerson: filters.actualDemandPerson,
      purchaseResponsible: filters.purchaseResponsible,
      demandDepartment: filters.demandDepartment,
      subitemNo: filters.subitemNo,
      planDateFrom: planDate.from,
      planDateTo: planDate.to,
      ...(this.data.fieldConditions || []).reduce((params, condition) => {
        if (condition.field && condition.value) params[condition.field] = condition.value;
        return params;
      }, {}),
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
