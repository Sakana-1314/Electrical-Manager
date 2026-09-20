const toastModule = require('tdesign-miniprogram/toast/index');
const { request } = require('../../utils/request');
const { buildRedirectQuery } = require('../../utils/navigation');
const {
  buildSharePath,
  isAllowedShareValue,
  readShareParams,
  withSharedOption,
} = require('../../utils/share');
const { getMessages, setNavigationBarTitle, t } = require('../../utils/i18n');
const { withTheme } = require('../../utils/theme');
const { canWriteHazards } = require('../../utils/features');
const { decorateHazard } = require('../../utils/hazard');
const Toast = toastModule.default || toastModule;

const PAGE_SIZE = 15;
// 整改状态是后端枚举的固定三档，选项直接内置（与网页端筛选项一致）。
const HAZARD_STATUSES = ['待整改', '整改受阻', '已整改'];
// 分享链接携带的搜索 / 筛选参数（与页面 data 字段同名，便于直接回填）。
const SHARE_PARAMS = ['keyword', 'status', 'rectifyPerson'];
const PAGE_ROUTE = '/pages/hazards/hazards';

Page(withTheme({
  data: {
    items: [],
    keyword: '',
    status: '',
    statusOptions: [],
    rectifyPerson: '',
    rectifyPersonOptions: [],
    page: 1,
    pageSize: PAGE_SIZE,
    total: 0,
    hasMore: false,
    loading: true,
    loadingMore: false,
    resultCount: '',
    backTopVisible: false,
    canWrite: false,
    i18n: getMessages(),
  },

  async onLoad(options = {}) {
    setNavigationBarTitle('hazardsTitle');
    // 分享链接带来的搜索 / 筛选：先解析，等筛选项加载完再回填（下拉项要靠 options 才能解析出文案）。
    const shared = readShareParams(options, SHARE_PARAMS);
    try {
      const app = getApp();
      const session = await app.globalData.authPromise;
      if (session.account_disabled || session.registration_disabled) {
        return;
      }
      if (session.requires_profile) {
        // 带上分享参数回跳，未注册用户绑定后仍落在同一份筛选结果上。
        const redirect = buildRedirectQuery(buildSharePath(PAGE_ROUTE, shared));
        wx.reLaunch({ url: `/pages/bind/bind?redirect=${redirect}` });
        return;
      }
      await app.globalData.featureSettingsPromise;
      this.setData({ canWrite: canWriteHazards() });
      await this.loadFilterOptions(shared);
      // 整改状态是固定三档：非法值不能凭空补进枚举，直接忽略，避免列表按不存在的状态过滤。
      if (!isAllowedShareValue(shared.status, HAZARD_STATUSES)) delete shared.status;
      if (Object.keys(shared).length) this.setData(shared);
      await this.loadHazards(true);
    } catch (error) {
      this.setData({ loading: false });
      this.showError(error);
    }
    // 首次 onShow 紧随 onLoad，跳过；之后从详情/登记页返回时刷新列表。
    this.skipNextShow = true;
  },

  onShow() {
    if (this.skipNextShow) {
      this.skipNextShow = false;
      return;
    }
    void this.loadHazards(true);
  },

  onUnload() {
    clearTimeout(this.searchTimer);
  },

  async onPullDownRefresh() {
    await this.loadHazards(true);
    wx.stopPullDownRefresh();
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.loadingMore) {
      void this.loadHazards(false);
    }
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
    this.searchTimer = setTimeout(() => void this.loadHazards(true), 350);
  },

  onStatusChange(event) {
    this.setData({ status: event.detail.value });
    void this.loadHazards(true);
  },

  onRectifyPersonChange(event) {
    this.setData({ rectifyPerson: event.detail.value });
    void this.loadHazards(true);
  },

  async loadFilterOptions(shared = {}) {
    // 整改员工是自由文本，选项来自库中已有值；加载失败不阻塞列表。
    let rectifyPersons = [];
    try {
      const result = await request({ url: '/mini-program/hazards/filter-options' });
      rectifyPersons = (result.rectify_persons || []).filter(Boolean);
    } catch (_error) {
      Toast({
        context: this,
        selector: '#hazards-toast',
        message: t('hazardFilterOptionsLoadFailed'),
        theme: 'warning',
      });
    }
    this.setData({
      statusOptions: [
        { label: t('allHazardStatuses'), value: '' },
        ...HAZARD_STATUSES.map((value) => ({ label: value, value })),
      ],
      // 整改人是自由文本：分享值可能已不在候选里，补进选项以免下拉与列表不一致。
      rectifyPersonOptions: withSharedOption(
        [
          { label: t('allRectifyPersons'), value: '' },
          ...rectifyPersons.map((value) => ({ label: value, value })),
        ],
        shared.rectifyPerson,
      ),
    });
  },

  async loadHazards(reset) {
    if (!reset && (this.data.loading || this.data.loadingMore || !this.data.hasMore)) {
      return;
    }
    const requestId = (this.requestId || 0) + 1;
    this.requestId = requestId;
    const page = reset ? 1 : this.data.page + 1;
    this.setData(reset ? { loading: true } : { loadingMore: true });
    try {
      const data = { page, page_size: this.data.pageSize };
      const keyword = this.data.keyword.trim();
      if (keyword) data.keyword = keyword;
      if (this.data.status) data.status = this.data.status;
      if (this.data.rectifyPerson) data.rectify_person = this.data.rectifyPerson;
      const result = await request({ url: '/mini-program/hazards', data });
      if (requestId !== this.requestId) {
        return;
      }
      const incoming = (result.items || []).map(decorateHazard);
      const items = reset ? incoming : [...this.data.items, ...incoming];
      this.setData({
        items,
        page,
        total: result.total || 0,
        resultCount: t('hazardResultCount', { count: result.total || 0 }),
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

  goDetail(event) {
    const id = event.currentTarget.dataset.id;
    if (!id) {
      return;
    }
    wx.navigateTo({ url: `/pages/hazard-detail/hazard-detail?id=${id}` });
  },

  goCreate() {
    wx.navigateTo({ url: '/pages/hazard-create/hazard-create' });
  },

  showError(error) {
    Toast({
      context: this,
      selector: '#hazards-toast',
      message: error.message || t('hazardsLoadFailed'),
      theme: 'error',
      direction: 'column',
    });
  },

  /** 分享路径：把当前搜索词与两个筛选值一起带出去。 */
  sharePath() {
    return buildSharePath(PAGE_ROUTE, {
      keyword: this.data.keyword.trim(),
      status: this.data.status,
      rectifyPerson: this.data.rectifyPerson,
    });
  },

  onShareAppMessage() {
    return { title: t('shareHazards'), path: this.sharePath() };
  },
}));
