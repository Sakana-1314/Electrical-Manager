const toastModule = require('tdesign-miniprogram/toast/index');
const { request } = require('../../utils/request');
const { decorateStock } = require('../../utils/inventory');
const { buildRedirectQuery } = require('../../utils/navigation');
const { buildSharePath, isAllowedShareValue, readShareParams } = require('../../utils/share');
const { SECONDARY_WAREHOUSE_LITE } = require('../../utils/features');
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

// 分享链接携带的搜索词与筛选（与页面 data 字段同名，便于直接回填）。
const SHARE_PARAMS = ['keyword', 'searchField', 'stockStatus', 'name', 'modelSpec', 'stockQtyFrom', 'stockQtyTo'];
const PAGE_ROUTE = '/pages/inventory/inventory';
// 库存状态是固定两档（空串表示不限，与筛选面板的「全部」一致）：非法值直接忽略。
const STOCK_STATUSES = ['out_of_stock', 'low_stock'];
// 筛选面板的分区；精简模式下整个面板退化为纯搜索。
const FILTER_SECTIONS = ['stockStatus', 'stockQty'];
const FILTER_SPEC = {
  stockStatus: { kind: 'single', param: 'stock_status' },
  stockQty: { kind: 'range', fromParam: 'min_qty', toParam: 'max_qty' },
};
// 分字段搜索：与网页端「名称、别名或型号规格」对齐，拆成名称 / 型号两个字段。
const SEARCH_FIELDS = [
  { labelKey: 'filterSearchAll', value: '', param: '' },
  { labelKey: 'filterSearchName', value: 'name', param: 'name' },
  { labelKey: 'filterSearchModelSpec', value: 'modelSpec', param: 'model_spec' },
];

function stockStatusSection() {
  return {
    key: 'stockStatus',
    title: t('filterStockStatus'),
    kind: 'single',
    options: [
      { label: t('all'), value: '' },
      { label: t('outOfStock'), value: 'out_of_stock' },
      { label: t('lowStock'), value: 'low_stock' },
    ],
  };
}

Page(withTheme({
  data: {
    items: [],
    keyword: '',
    searchField: '',
    fieldConditions: [],
    searchFields: [],
    // 筛选值：库存数量是 { from, to } 区间。
    filters: {
      stockStatus: '',
      stockQty: { from: '', to: '' },
    },
    filterSections: [],
    filtered: false,
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
    // 分享链接带来的搜索词 / 筛选；精简模式下没有筛选，忽略对应参数。
    const shared = readShareParams(options, SHARE_PARAMS);
    this.setData({
      searchFields: SEARCH_FIELDS.map((field) => ({ label: t(field.labelKey), value: field.value })),
    });
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

      const filters = {
        stockStatus:
          !liteMode && isAllowedShareValue(shared.stockStatus, STOCK_STATUSES) ? shared.stockStatus : '',
        stockQty: { from: shared.stockQtyFrom || '', to: shared.stockQtyTo || '' },
      };
      // 精简模式只按关键字搜，不分字段。
      const conditions = [];
      if (!liteMode) {
        SEARCH_FIELDS.forEach((field) => {
          if (!field.value) return;
          if (shared[field.value] !== undefined) conditions.push({ field: field.value, value: shared[field.value] });
        });
      }

      this.setData({
        liteMode,
        keyword: shared.keyword || '',
        searchField: liteMode ? '' : shared.searchField || '',
        fieldConditions: conditions,
        filters,
        filterSections: liteMode
          ? []
          : [
              stockStatusSection(),
              {
                key: 'stockQty',
                title: t('filterStockQty'),
                kind: 'range',
                fromLabel: t('filterRangeFrom'),
                toLabel: t('filterRangeTo'),
              },
            ],
        filtered: !liteMode && (hasActiveFilter(filters, FILTER_SECTIONS) || conditions.length > 0),
      });
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

  /** 搜索框：写入关键词与当前字段后防抖取数（切字段也走这里）。 */
  onSearchChange(event) {
    const detail = event.detail || {};
    const patch = { keyword: detail.value || '' };
    if (detail.field !== undefined) patch.searchField = detail.field || '';
    this.setData(patch);
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => {
      void this.loadInventory(true);
    }, 350);
  },

  /** 筛选面板确认：整体替换筛选值与分字段条件后重新取第一页。 */
  onFilterChange(event) {
    if (this.data.liteMode) return;
    const detail = event.detail || {};
    const filters = normalizeFilters(detail.values || {}, FILTER_SECTIONS, [], ['stockQty']);
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
      // 精简模式只有关键字搜索（后端精简接口只认 keyword）。
      const query = {
        page,
        page_size: this.data.pageSize,
        ...(this.data.liteMode
          ? {}
          : {
              ...buildSearchQuery(this.data.keyword, this.data.searchField, SEARCH_FIELDS),
              ...buildFieldQuery(this.data.fieldConditions, SEARCH_FIELDS),
              ...buildFilterQuery(this.data.filters, FILTER_SPEC),
            }),
      };
      if (this.data.liteMode) {
        const keyword = String(this.data.keyword || '').trim();
        if (keyword) query.keyword = keyword;
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

  /** 分享路径：关键词、搜索字段、库存状态与数量区间一起带出去（精简模式只带关键字）。 */
  sharePath() {
    if (this.data.liteMode) {
      return buildSharePath(PAGE_ROUTE, { keyword: this.data.keyword.trim() });
    }
    const filters = this.data.filters;
    return buildSharePath(PAGE_ROUTE, {
      keyword: this.data.keyword.trim(),
      searchField: this.data.searchField,
      stockStatus: filters.stockStatus,
      stockQtyFrom: filters.stockQty.from,
      stockQtyTo: filters.stockQty.to,
      ...(this.data.fieldConditions || []).reduce((params, condition) => {
        if (condition.field && condition.value) params[condition.field] = condition.value;
        return params;
      }, {}),
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
