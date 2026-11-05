const toastModule = require('tdesign-miniprogram/toast/index');
const { request, requestCached } = require('../../utils/request');
const { buildRedirectQuery } = require('../../utils/navigation');
const { buildSharePath, isAllowedShareValue, readShareParams } = require('../../utils/share');
const { getMessages, setNavigationBarTitle, t } = require('../../utils/i18n');
const { withTheme } = require('../../utils/theme');
const { canWriteHazards } = require('../../utils/features');
const { decorateHazard } = require('../../utils/hazard');
const {
  buildFieldQuery,
  buildFieldShare,
  buildFilterQuery,
  buildSearchQuery,
  countFieldValues,
  hasActiveFilter,
  normalizeFilters,
  readFieldShare,
  sameFilters,
} = require('../../utils/filters');
const Toast = toastModule.default || toastModule;

const PAGE_SIZE = 15;
// 整改状态与隐患等级是后端枚举的固定档位，选项直接内置（与网页端筛选项一致）。
const HAZARD_STATUSES = ['待整改', '整改受阻', '已整改'];
const HAZARD_LEVELS = ['一般隐患', '重大隐患'];
// 固定枚举的筛选分区：非法分享值不能凭空造选项，校验后直接忽略。
const ENUM_SECTIONS = { status: HAZARD_STATUSES, level: HAZARD_LEVELS };
// 分享链接携带的搜索 / 筛选参数（与页面 data 字段同名，便于直接回填）。
const SHARE_PARAMS = [
  'keyword',
  'status',
  'level',
  'rectifyPerson',
  'overdue',
  'area',
  'hazardTypeId',
  'hazardUnitId',
  'inspectionDateFrom',
  'inspectionDateTo',
];
// 筛选分区；与网页端字段一一对应（类型 / 单位 / 等级 / 状态 / 整改员工 / 区域 / 日期）。
const FILTER_SECTIONS = ['status', 'overdue', 'level', 'hazardTypeId', 'hazardUnitId', 'rectifyPerson', 'inspectionDate'];
const FILTER_SPEC = {
  status: { kind: 'single', param: 'status' },
  overdue: { kind: 'single', param: 'overdue' },
  level: { kind: 'single', param: 'level' },
  hazardTypeId: { kind: 'single', param: 'hazard_type_id' },
  hazardUnitId: { kind: 'single', param: 'hazard_unit_id' },
  rectifyPerson: { kind: 'single', param: 'rectify_person' },
  inspectionDate: { kind: 'dateRange', fromParam: 'date_from', toParam: 'date_to' },
};
// 分字段搜索：网页端的「检查区域」是独立输入框，这里作为可切换的搜索字段。
// 分字段组合搜索：每个字段一个输入框，填多个即同时满足（AND），与网页端一致。
const FIELD_DEFS = [
  { key: 'area', labelKey: 'filterSearchArea', param: 'area' },
];
const PAGE_ROUTE = '/pages/hazards/hazards';

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
    /** 分字段组合搜索的已生效值（隐患只有「检查区域」一个字段）。 */
    fieldValues: {},
    fieldDefs: [],
    // 当前生效的筛选值：key 与分享参数同名；「仅逾期」用 overdue / '' 两态。
    filters: {
      status: '',
      level: '',
      rectifyPerson: '',
      overdue: '',
      hazardTypeId: '',
      hazardUnitId: '',
      inspectionDate: { from: '', to: '' },
    },
    /** 筛选项没拉到时为 true：面板里显示一行「重新加载」，不弹打断式提示。 */
    optionsFailed: false,
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
    // 重试筛选项时复用同一份分享值，保证「分享值补进选项」在重试后仍然生效。
    this.lastShared = shared;
    // 固定枚举与「仅逾期」开关：非法值直接忽略，避免按不存在的状态过滤。
    Object.keys(ENUM_SECTIONS).forEach((key) => {
      if (shared[key] !== undefined && !isAllowedShareValue(shared[key], ENUM_SECTIONS[key])) {
        delete shared[key];
      }
    });
    if (shared.overdue !== undefined && shared.overdue !== 'overdue') delete shared.overdue;
    this.setData({ fieldDefs: toFieldDefs() });
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

  /** 把分享 / 回跳带来的参数并进当前筛选状态。 */
  applyShared(shared) {
    const filters = { ...this.data.filters };
    FILTER_SECTIONS.forEach((key) => {
      if (key === 'inspectionDate') {
        if (shared.inspectionDateFrom || shared.inspectionDateTo) {
          filters.inspectionDate = {
            from: shared.inspectionDateFrom || '',
            to: shared.inspectionDateTo || '',
          };
        }
        return;
      }
      if (shared[key] !== undefined) filters[key] = shared[key];
    });
    // 分享里的 area 是「检查区域」分字段的值。
    const fieldValues = readFieldShare(shared, FIELD_DEFS);
    this.setData({
      filters,
      fieldValues,
      filtered: hasActiveFilter(filters, FILTER_SECTIONS) || countFieldValues(fieldValues, FIELD_DEFS) > 0,
    });
    if (shared.keyword !== undefined) this.setData({ keyword: shared.keyword });
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

  /** 收起态搜索框：只做综合搜索（跨字段），多字段组合在筛选面板里。 */
  onSearchChange(event) {
    this.setData({ keyword: (event.detail && event.detail.value) || '' });
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => void this.loadHazards(true), 350);
  },

  /** 筛选面板确认：整体替换筛选值与分字段值后重新取第一页。 */
  onFilterChange(event) {
    const detail = event.detail || {};
    const filters = normalizeFilters(detail.values || {}, FILTER_SECTIONS, [], ['inspectionDate']);
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
    void this.loadHazards(true);
  },

  /**
   * 面板上的「重新加载」：重拉筛选项。
   *
   * 只需要选项，不必重新登录或重查列表——列表本身是好的，失败多半是筛选项接口
   * 抖动或后端版本不匹配。重拉成功后清掉失败标记，面板恢复完整选项。
   */
  onRetryOptions() {
    void this.loadFilterOptions(this.lastShared || {});
  },

  async loadFilterOptions(shared = {}) {
    // 整改员工来自库中已有值；责任单位与隐患类型来自字典。加载失败不阻塞列表。
    let rectifyPersons = [];
    let units = [];
    let types = [];
    let optionsFailed = false;
    try {
      const result = await requestCached({ url: '/mini-program/hazards/filter-options' });
      rectifyPersons = (result.rectify_persons || []).filter(Boolean);
      units = result.units || [];
      types = result.types || [];
    } catch (_error) {
      // 选项拉不到时列表照常可用：不弹打断式提示（会让人以为页面坏了），
      // 把状态传给筛选面板，由面板里的一行「重新加载」兜底。
      optionsFailed = true;
    }
    this.setData({
      optionsFailed,
      filterSections: [
        this.buildSection('status', t('hazardStatusLabel'), HAZARD_STATUSES, shared.status),
        {
          key: 'overdue',
          title: t('filterOverdue'),
          kind: 'single',
          options: [
            { label: t('all'), value: '' },
            { label: t('filterOnlyOverdue'), value: 'overdue' },
          ],
        },
        this.buildSection('level', t('hazardLevelLabel'), HAZARD_LEVELS, shared.level),
        this.buildSection(
          'hazardTypeId',
          t('filterHazardType'),
          types.map((type) => ({ label: `${type.major} / ${type.minor}`, value: String(type.id) })),
          shared.hazardTypeId,
        ),
        this.buildSection(
          'hazardUnitId',
          t('filterHazardUnit'),
          units.map((unit) => ({ label: unit.name, value: String(unit.id) })),
          shared.hazardUnitId,
        ),
        this.buildSection('rectifyPerson', t('filterRectifyPerson'), rectifyPersons, shared.rectifyPerson),
        {
          key: 'inspectionDate',
          title: t('filterInspectionDate'),
          kind: 'dateRange',
          fromLabel: t('filterDateFrom'),
          toLabel: t('filterDateTo'),
        },
      ],
    });
  },

  /**
   * 组装一个筛选分区：首项「全部」+ 候选值。
   * 候选值可以是字符串数组，也可以是已带 label / value 的对象数组（类型、单位需要文案映射）。
   */
  buildSection(key, title, values, sharedValue) {
    const options = values.map((value) =>
      value && typeof value === 'object' ? value : { label: value, value },
    );
    const list = [{ label: t('all'), value: '' }].concat(options);
    if (sharedValue && !list.some((option) => option.value === sharedValue)) {
      list.splice(1, 0, { label: sharedValue, value: sharedValue });
    }
    return { key, title, kind: 'single', options: list };
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
      const data = {
        page,
        page_size: this.data.pageSize,
        // 综合搜索走 keyword（检查区域 + 隐患描述）；分字段里的「检查区域」单独精确叠加。
        ...buildSearchQuery(this.data.keyword),
        ...buildFieldQuery(this.data.fieldValues, FIELD_DEFS),
        ...buildFilterQuery(this.data.filters, FILTER_SPEC),
      };
      // 「仅逾期」是布尔参数，其余筛选是字符串。
      if (data.overdue) data.overdue = true;
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

  /** 分享路径：关键词、搜索字段与全部筛选值一起带出去。 */
  sharePath() {
    const filters = this.data.filters;
    return buildSharePath(PAGE_ROUTE, {
      keyword: this.data.keyword.trim(),
      ...buildFieldShare(this.data.fieldValues, FIELD_DEFS),
      status: filters.status,
      level: filters.level,
      rectifyPerson: filters.rectifyPerson,
      overdue: filters.overdue,
      hazardTypeId: filters.hazardTypeId,
      hazardUnitId: filters.hazardUnitId,
      inspectionDateFrom: filters.inspectionDate.from,
      inspectionDateTo: filters.inspectionDate.to,
    });
  },

  onShareAppMessage() {
    return { title: t('shareHazards'), path: this.sharePath() };
  },
}));
