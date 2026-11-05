const toastModule = require('tdesign-miniprogram/toast/index');
const { request } = require('../../utils/request');
const { buildRedirectQuery } = require('../../utils/navigation');
const { buildSharePath, readShareParams } = require('../../utils/share');
const { getMessages, setNavigationBarTitle, t } = require('../../utils/i18n');
const { withTheme } = require('../../utils/theme');
const { buildFieldQuery, buildSearchQuery } = require('../../utils/filters');
const Toast = toastModule.default || toastModule;

// 分享链接携带的搜索词 / 分字段搜索（与页面 data 字段同名，便于直接回填）。
const SHARE_PARAMS = ['keyword', 'searchField', 'name', 'modelSpec', 'materialCode'];
// 分字段搜索：网页端「物资名称 / 型号规格 / 物料编码」三个输入框。
const SEARCH_FIELDS = [
  { labelKey: 'filterSearchAll', value: '', param: '' },
  { labelKey: 'filterSearchName', value: 'name', param: 'name' },
  { labelKey: 'filterSearchModelSpec', value: 'modelSpec', param: 'model_spec' },
  { labelKey: 'filterSearchMaterialCode', value: 'materialCode', param: 'material_code' },
];
const PAGE_ROUTE = '/pages/material-codes/material-codes';

function formatDateTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (part) => String(part).padStart(2, '0');
  return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

Page(withTheme({
  data: {
    items: [],
    keyword: '',
    searchField: '',
    fieldConditions: [],
    searchFields: [],
    page: 1,
    pageSize: 15,
    total: 0,
    hasMore: false,
    loading: true,
    loadingMore: false,
    resultCount: '',
    backTopVisible: false,
    detailVisible: false,
    detailItem: null,
    lastImportAtLabel: '',
    i18n: getMessages(),
  },

  async onLoad(options = {}) {
    setNavigationBarTitle('materialCodesTitle');
    // 分享链接带来的搜索词：解析后立刻回填，列表与搜索框都按它渲染。
    const shared = readShareParams(options, SHARE_PARAMS);
    this.setData({
      searchFields: SEARCH_FIELDS.map((field) => ({ label: t(field.labelKey), value: field.value })),
    });
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
      // 搜索字段 + 分字段条件（分享里的单字段参数还原成条件）。
      const conditions = [];
      SEARCH_FIELDS.forEach((field) => {
        if (!field.value) return;
        if (shared[field.value] !== undefined) conditions.push({ field: field.value, value: shared[field.value] });
      });
      const patch = { fieldConditions: conditions, searchField: shared.searchField || '' };
      if (shared.keyword !== undefined) patch.keyword = shared.keyword;
      this.setData(patch);
      this.loadLastImport();
      await this.loadCodes(true);
    } catch (error) {
      this.setData({ loading: false });
      this.showError(error);
    }
  },

  onUnload() {
    clearTimeout(this.searchTimer);
  },

  async onPullDownRefresh() {
    await this.loadCodes(true);
    wx.stopPullDownRefresh();
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.loadingMore) void this.loadCodes(false);
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
    this.searchTimer = setTimeout(() => void this.loadCodes(true), 350);
  },

  /**
   * 物料编码页没有筛选分区（与网页端一致：只有三个搜索框）。
   * 分字段条件在面板里添加后走这里，条件与关键词一起重新取数。
   */
  onFilterChange(event) {
    const detail = event.detail || {};
    const conditions = (detail.conditions || []).filter((condition) => condition && condition.field && condition.value);
    if (JSON.stringify(this.data.fieldConditions) === JSON.stringify(conditions)) {
      return;
    }
    this.setData({ fieldConditions: conditions });
    void this.loadCodes(true);
  },

  async loadCodes(reset) {
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
      };
      const result = await request({ url: '/mini-program/material-codes', data });
      if (requestId !== this.requestId) return;
      const incoming = result.items || [];
      const items = reset ? incoming : [...this.data.items, ...incoming];
      this.setData({
        items,
        page,
        total: result.total || 0,
        resultCount: t('materialCodeResultCount', { count: result.total || 0 }),
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
      const result = await request({ url: '/mini-program/material-codes/last-import' });
      this.setData({ lastImportAtLabel: formatDateTime(result.last_import_at) });
    } catch (error) {
      // 导入时间非关键，加载失败静默
    }
  },

  /** 分享路径：把当前搜索词、搜索字段与分字段条件一起带出去。 */
  sharePath() {
    return buildSharePath(PAGE_ROUTE, {
      keyword: this.data.keyword.trim(),
      searchField: this.data.searchField,
      ...(this.data.fieldConditions || []).reduce((params, condition) => {
        if (condition.field && condition.value) params[condition.field] = condition.value;
        return params;
      }, {}),
    });
  },

  onShareAppMessage() {
    return {
      title: t('shareMaterialCodes'),
      path: this.sharePath(),
    };
  },

  openDetail(event) {
    const item = this.data.items[event.currentTarget.dataset.index];
    if (!item) return;
    // 单价来自「价格表」导入，可能没有：空值显示破折号，不显示 0 元。
    this.setData({
      detailItem: { ...item, unitPriceText: item.unit_price ? `${item.unit_price} 元` : '—' },
      detailVisible: true,
    });
  },

  onDetailVisibleChange(event) {
    this.setData({ detailVisible: event.detail.visible });
  },

  copyMaterialCode() {
    const item = this.data.detailItem;
    if (!item) return;
    wx.setClipboardData({
      data: item.material_code || '',
      success: () => {
        Toast({
          context: this,
          selector: '#material-codes-toast',
          message: t('copied'),
          theme: 'success',
          direction: 'column',
        });
      },
    });
  },

  showError(error) {
    Toast({
      context: this,
      selector: '#material-codes-toast',
      message: error.message || t('materialCodesLoadFailed'),
      theme: 'error',
      direction: 'column',
    });
  },
}));
