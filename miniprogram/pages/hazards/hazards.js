const toastModule = require('tdesign-miniprogram/toast/index');
const { request, requestCached } = require('../../utils/request');
const { buildRedirectQuery } = require('../../utils/navigation');
const { buildSharePath, isAllowedShareValue, readShareParams } = require('../../utils/share');
const { getMessages, setNavigationBarTitle, t } = require('../../utils/i18n');
const { withTheme } = require('../../utils/theme');
const { hasActiveFilter, normalizeFilters, sameFilters } = require('../../utils/filters');
const { canWriteHazards } = require('../../utils/features');
const { decorateHazard } = require('../../utils/hazard');
const Toast = toastModule.default || toastModule;

const PAGE_SIZE = 15;
// 整改状态与隐患等级是后端枚举的固定档位，选项直接内置（与网页端筛选项一致）。
const HAZARD_STATUSES = ['待整改', '整改受阻', '已整改'];
const HAZARD_LEVELS = ['一般隐患', '重大隐患'];
// 固定枚举的筛选分区：非法分享值不能凭空造选项，校验后直接忽略。
const ENUM_SECTIONS = { status: HAZARD_STATUSES, level: HAZARD_LEVELS };
// 分享链接携带的搜索 / 筛选参数（与页面 data 字段同名，便于直接回填）。
const SHARE_PARAMS = ['keyword', 'status', 'level', 'rectifyPerson', 'overdue'];
const FILTER_SECTIONS = ['status', 'level', 'rectifyPerson', 'overdue'];
const PAGE_ROUTE = '/pages/hazards/hazards';

Page(withTheme({
  data: {
    items: [],
    keyword: '',
    // 当前生效的筛选值：key 与分享参数同名；「仅逾期」用 overdue / '' 两态。
    filters: {
      status: '',
      level: '',
      rectifyPerson: '',
      overdue: '',
    },
    filterSections: [],
    /** 是否有生效的筛选（空态文案据此区分「本来为空」与「筛空了」）。 */
    filtered: false,
    page: 1,
    pageSize: PAGE_SIZE,
    total: 0,
    hasMore: false,
    loading: true,
    loadingMore: false,
    resultCount: '',
    canWrite: false,
    i18n: getMessages(),
  },

  async onLoad(options = {}) {
    // 必须在第一个 await 之前置位：onShow 紧随 onLoad 同步触发，放到 onLoad 末尾时它早已跑过，
    // 会在登录、筛选项都没就绪时多发一次列表请求，而「第一次从详情返回」反而被误当成首次 onShow 吞掉。
    this.skipNextShow = true;
    setNavigationBarTitle('hazardsTitle');
    // 分享链接带来的搜索 / 筛选：先解析，等筛选项加载完再回填（面板要靠选项才能解析出文案）。
    const shared = readShareParams(options, SHARE_PARAMS);
    // 固定枚举与「仅逾期」开关：非法值直接忽略，避免按不存在的状态过滤。
    Object.keys(ENUM_SECTIONS).forEach((key) => {
      if (shared[key] !== undefined && !isAllowedShareValue(shared[key], ENUM_SECTIONS[key])) {
        delete shared[key];
      }
    });
    if (shared.overdue !== undefined && shared.overdue !== 'overdue') delete shared.overdue;
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
      this.applyShared(shared);
      await this.loadHazards(true);
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

  onSearchChange(event) {
    this.setData({ keyword: event.detail.value });
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => void this.loadHazards(true), 350);
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
    void this.loadHazards(true);
  },

  async loadFilterOptions(shared = {}) {
    // 整改员工是自由文本，选项来自库中已有值；加载失败不阻塞列表。
    let rectifyPersons = [];
    try {
      const result = await requestCached({ url: '/mini-program/hazards/filter-options' });
      rectifyPersons = (result.rectify_persons || []).filter(Boolean);
    } catch (_error) {
      Toast({
        context: this,
        selector: '#hazards-toast',
        message: t('hazardFilterOptionsLoadFailed'),
        theme: 'warning',
        direction: 'column',
      });
    }
    this.setData({
      filterSections: [
        this.buildSection('status', t('hazardStatusLabel'), HAZARD_STATUSES, shared.status),
        this.buildSection('level', t('hazardLevelLabel'), HAZARD_LEVELS, shared.level),
        this.buildSection(
          'rectifyPerson',
          t('filterRectifyPerson'),
          rectifyPersons,
          shared.rectifyPerson,
        ),
        {
          key: 'overdue',
          title: t('filterOverdue'),
          options: [
            { label: t('all'), value: '' },
            { label: t('filterOnlyOverdue'), value: 'overdue' },
          ],
        },
      ],
    });
  },

  /** 组装一个固定枚举 / 候选值分区：首项「全部」，分享值缺失时补一项，避免面板显示成原值。 */
  buildSection(key, title, values, sharedValue) {
    const list = [{ label: t('all'), value: '' }].concat(
      values.map((value) => ({ label: value, value })),
    );
    if (sharedValue && !list.some((option) => option.value === sharedValue)) {
      list.splice(1, 0, { label: sharedValue, value: sharedValue });
    }
    return { key, title, options: list };
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
      const filters = this.data.filters;
      if (filters.status) data.status = filters.status;
      if (filters.level) data.level = filters.level;
      if (filters.rectifyPerson) data.rectify_person = filters.rectifyPerson;
      if (filters.overdue) data.overdue = true;
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

  /** 分享路径：把当前搜索词与全部筛选值一起带出去。 */
  sharePath() {
    const filters = this.data.filters;
    return buildSharePath(PAGE_ROUTE, {
      keyword: this.data.keyword.trim(),
      status: filters.status,
      level: filters.level,
      rectifyPerson: filters.rectifyPerson,
      overdue: filters.overdue,
    });
  },

  onShareAppMessage() {
    return { title: t('shareHazards'), path: this.sharePath() };
  },
}));
