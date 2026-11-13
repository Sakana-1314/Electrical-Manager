const toastModule = require('tdesign-miniprogram/toast/index');
const { request, requestCached } = require('../../utils/request');
const { buildRedirectQuery } = require('../../utils/navigation');
const { buildSharePath, readShareParams } = require('../../utils/share');
const { getMessages, t } = require('../../utils/i18n');
const { importTimeLabel } = require('../../utils/time');
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
  'purchaseDepartment',
  'purchaser',
  'name',
  'modelSpec',
  'materialCode',
  'inboundFrom',
  'inboundTo',
];
// 筛选分区：申购部门 / 申购人是多选（网页端可多选），首次入库日期是区间。
const FILTER_SECTIONS = ['purchaseDepartment', 'purchaser', 'firstInboundDate'];
const FILTER_SPEC = {
  purchaseDepartment: { kind: 'multi', param: 'purchase_department' },
  purchaser: { kind: 'multi', param: 'purchaser' },
  firstInboundDate: { kind: 'dateRange', fromParam: 'date_from', toParam: 'date_to' },
};
// 分字段搜索：网页端「货品名称 / 型号 / 货品编码」三个输入框。
// 分字段组合搜索：每个字段一个输入框，填多个即同时满足（AND），与网页端一致。
const FIELD_DEFS = [
  { key: 'name', labelKey: 'filterSearchName', param: 'name' },
  { key: 'modelSpec', labelKey: 'filterSearchModelSpec', param: 'model_spec' },
  { key: 'materialCode', labelKey: 'filterSearchMaterialCode', param: 'material_code' },
];
const PAGE_ROUTE = '/pages/huaxing-inventory/huaxing-inventory';

/** 分享里的多选值用 | 分隔（与后端「任一」匹配一致），还原成数组。 */
function splitSharedList(value) {
  if (!value) return [];
  return String(value)
    .split(/[|｜]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function decorateItem(item) {
  return {
    ...item,
    // 数量与单位拆开存：卡片上数值用主色大字、单位做小字后缀（与其它列表页同一形态）。
    quantity: item.quantity != null ? String(item.quantity) : '',
    quantity_unit: item.unit_name || '',
  };
}

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
    /** 分字段组合搜索的已生效值：`{ [fieldKey]: value }`，空串表示该字段不参与过滤。 */
    fieldValues: {},
    fieldDefs: [],
    // 部门 / 申购人是多选数组，日期是区间对象。
    filters: {
      purchaseDepartment: [],
      purchaser: [],
      firstInboundDate: { from: '', to: '' },
    },
    /** 筛选项没拉到时为 true：面板里显示一行「重新加载」，不弹打断式提示。 */
    optionsFailed: false,
    filterSections: [],
    filtered: false,
    page: 1,
    pageSize: 15,
    total: 0,
    hasMore: false,
    loading: true,
    loadingMore: false,
    resultCount: '',
    backTopVisible: false,
    lastImportAtLabel: '',
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
        // 带上分享参数回跳，未注册用户绑定后仍落在同一份搜索结果上。
        const redirect = buildRedirectQuery(buildSharePath(PAGE_ROUTE, shared));
        wx.reLaunch({ url: `/pages/bind/bind?redirect=${redirect}` });
        return;
      }
      await this.loadFilterOptions(shared);
      this.applyShared(shared);
      this.loadLastImport();
      await this.loadInventory(true);
    } catch (error) {
      this.setData({ loading: false });
      this.showError(error);
    }
  },

  /**
   * 把分享 / 回跳带来的参数并进当前状态。
   *
   * 多选分区在分享里用 | 分隔（与后端「任一」匹配一致），这里还原成数组；
   * 单字段参数（name / modelSpec / materialCode）还原成分字段条件。
   */
  applyShared(shared) {
    const filters = { ...this.data.filters };
    ['purchaseDepartment', 'purchaser'].forEach((key) => {
      if (shared[key] !== undefined) filters[key] = splitSharedList(shared[key]);
    });
    if (shared.inboundFrom || shared.inboundTo) {
      filters.firstInboundDate = { from: shared.inboundFrom || '', to: shared.inboundTo || '' };
    }
    const fieldValues = readFieldShare(shared, FIELD_DEFS);
    const patch = {
      filters,
      fieldValues,
      filtered: hasActiveFilter(filters, FILTER_SECTIONS) || countFieldValues(fieldValues, FIELD_DEFS) > 0,
    };
    if (shared.keyword !== undefined) patch.keyword = shared.keyword;
    this.setData(patch);
  },

  /** 申购部门 / 申购人选项来自库中已有值；加载失败不阻塞列表。 */
  /** 面板上的「重新加载」：重拉筛选项（不重新登录、不重查列表）。 */
  onRetryOptions() {
    void this.loadFilterOptions(this.lastShared || {});
  },

  async loadFilterOptions(shared = {}) {
    let departments = [];
    let purchasers = [];
    let optionsFailed = false;
    try {
      const result = await requestCached({ url: '/mini-program/huaxing-inventory/filter-options' });
      departments = (result.purchase_departments || []).filter(Boolean);
      purchasers = (result.purchasers || []).filter(Boolean);
    } catch (_error) {
      // 选项拉不到时列表照常可用：不弹打断式提示（会让人以为页面坏了），
      // 把状态传给筛选面板，由面板里的一行「重新加载」兜底。
      optionsFailed = true;
    }
    this.setData({
      optionsFailed,
      filterSections: [
        this.buildSection(
          'purchaseDepartment',
          t('filterPurchaseDepartment'),
          departments,
          splitSharedList(shared.purchaseDepartment),
          'multi',
        ),
        this.buildSection('purchaser', t('filterPurchaser'), purchasers, splitSharedList(shared.purchaser), 'multi'),
        {
          key: 'firstInboundDate',
          title: t('filterFirstInboundDate'),
          kind: 'dateRange',
          fromLabel: t('filterDateFrom'),
          toLabel: t('filterDateTo'),
        },
      ],
    });
  },

  /** 组装一个筛选分区：首项「全部」；分享值缺失时补一项，避免面板显示成原值。 */
  buildSection(key, title, values, sharedValue, kind = 'single') {
    const options = values.map((value) => ({ label: value, value }));
    // 多选分区的值是数组：分享值可能是 | 分隔的多个，逐个补进选项。
    const sharedValues = kind === 'multi' ? (Array.isArray(sharedValue) ? sharedValue : []) : sharedValue ? [sharedValue] : [];
    sharedValues.forEach((value) => {
      if (value && !options.some((option) => option.value === value)) {
        options.unshift({ label: value, value });
      }
    });
    const list = [{ label: t('all'), value: '' }].concat(options);
    // kind 必须一路带到分区上：漏掉会被当成单选，空数组（多选默认值）会被算成一个生效条件。
    return { key, title, kind, options: list };
  },

  onUnload() {
    clearTimeout(this.searchTimer);
  },

  async onPullDownRefresh() {
    await this.loadInventory(true);
    wx.stopPullDownRefresh();
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.loadingMore) void this.loadInventory(false);
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
    this.searchTimer = setTimeout(() => void this.loadInventory(true), 350);
  },

  /** 筛选面板确认：整体替换筛选值后重新取第一页。 */
  onFilterChange(event) {
    const detail = event.detail || {};
    const filters = normalizeFilters(detail.values || {}, FILTER_SECTIONS, ['purchaseDepartment', 'purchaser'], ['firstInboundDate']);
    const fieldValues = detail.fields || {};
    // 面板点「确定」但条件没变（含「全部」原地确认）：不重复请求。
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
    void this.loadInventory(true);
  },

  async loadInventory(reset) {
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
      const result = await request({ url: '/mini-program/huaxing-inventory', data });
      if (requestId !== this.requestId) return;
      const incoming = (result.items || []).map(decorateItem);
      const items = reset ? incoming : [...this.data.items, ...incoming];
      this.setData({
        items,
        page,
        total: result.total || 0,
        resultCount: t('huaxingInventoryResultCount', { count: result.total || 0 }),
        hasMore: items.length < (result.total || 0),
      });
    } catch (error) {
      if (requestId === this.requestId) this.showError(error);
    } finally {
      if (requestId === this.requestId) this.setData({ loading: false, loadingMore: false });
    }
  },

  async loadLastImport() {
    try {
      const result = await request({ url: '/mini-program/huaxing-inventory/last-import' });
      this.setData({ lastImportAtLabel: importTimeLabel(result.last_import_at) });
    } catch (error) {
      // 导入时间非关键，加载失败静默
    }
  },

  openDetail(event) {
    const item = this.data.items[event.currentTarget.dataset.index];
    if (!item) return;
    wx.navigateTo({
      url: `/pages/huaxing-inventory-detail/huaxing-inventory-detail?id=${item.id}`,
    });
  },

  showError(error) {
    Toast({
      context: this,
      selector: '#huaxing-inventory-toast',
      message: error.message || t('huaxingInventoryLoadFailed'),
      theme: 'error',
      direction: 'column',
    });
  },
});
