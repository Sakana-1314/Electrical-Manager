const toastModule = require('tdesign-miniprogram/toast/index');
const { request } = require('../../utils/request');
const { buildRedirectQuery } = require('../../utils/navigation');
const { buildSharePath, readShareParams } = require('../../utils/share');
const { getMessages, t } = require('../../utils/i18n');
const { withTheme } = require('../../utils/theme');
const {
  buildFieldQuery,
  buildFieldShare,
  buildSearchQuery,
  countFieldValues,
  readFieldShare,
} = require('../../utils/filters');
const Toast = toastModule.default || toastModule;

// 分享链接携带的搜索词 / 分字段搜索（与页面 data 字段同名，便于直接回填）。
const SHARE_PARAMS = ['keyword', 'name', 'modelSpec', 'materialCode'];
// 分字段搜索：网页端「物资名称 / 型号规格 / 物料编码」三个输入框。
// 分字段组合搜索：每个字段一个输入框，填多个即同时满足（AND），与网页端一致。
const FIELD_DEFS = [
  { key: 'name', labelKey: 'filterSearchName', param: 'name' },
  { key: 'modelSpec', labelKey: 'filterSearchModelSpec', param: 'model_spec' },
  { key: 'materialCode', labelKey: 'filterSearchMaterialCode', param: 'material_code' },
];
const PAGE_ROUTE = '/pages/material-codes/material-codes';

function formatDateTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (part) => String(part).padStart(2, '0');
  return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** 把字段定义转成组件要的 `{ key, label, placeholder }`（label 走 i18n）。 */
function toFieldDefs() {
  return FIELD_DEFS.map((field) => ({
    key: field.key,
    label: t(field.labelKey),
    placeholder: t('filterFieldValuePlaceholder'),
  }));
}

Page(withTheme({
  data: {
    items: [],
    keyword: '',
    /** 分字段组合搜索的已生效值：`{ [fieldKey]: value }`，空串表示该字段不参与过滤。 */
    fieldValues: {},
    fieldDefs: [],
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
    // 分享链接带来的搜索词：解析后立刻回填，列表与搜索框都按它渲染。
    const shared = readShareParams(options, SHARE_PARAMS);
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
      // 分字段组合搜索（分享里的单字段参数还原成多字段值）。
      const patch = { fieldValues: readFieldShare(shared, FIELD_DEFS) };
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

  /** 收起态搜索框：只做综合搜索（跨字段），多字段组合在筛选面板里。 */
  onSearchChange(event) {
    this.setData({ keyword: (event.detail && event.detail.value) || '' });
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => void this.loadCodes(true), 350);
  },

  /**
   * 物料编码页没有筛选分区（与网页端一致：只有三个分字段输入框）。
   * 面板点「确定」回传分字段值，与关键词一起重新取数。
   */
  onFilterChange(event) {
    const detail = event.detail || {};
    const fieldValues = detail.fields || {};
    if (JSON.stringify(this.data.fieldValues) === JSON.stringify(fieldValues)) {
      return;
    }
    this.setData({ fieldValues });
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
        ...buildSearchQuery(this.data.keyword),
        ...buildFieldQuery(this.data.fieldValues, FIELD_DEFS),
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
      ...buildFieldShare(this.data.fieldValues, FIELD_DEFS),
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
    wx.navigateTo({
      url: `/pages/material-code-detail/material-code-detail?id=${item.id}`,
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
