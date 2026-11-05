/**
 * 小程序页面逻辑的离线冒烟测试（不依赖微信开发者工具）。
 *
 * 用最小 wx / App / 组件桩加载页面与 filter-panel 组件，验证：
 *  - 页面把筛选面板的 sections / active 组装正确，面板确认后按 key 拼请求参数；
 *  - 面板内部：草稿、选中态、确定回传、胶囊删除、分享值补齐；
 *  - 首页扫码入口只按 canOutbound 渲染。
 * 只读产物，不发网络请求（request 模块被桩替换）。
 */
const path = require('path');
const assert = require('assert');
const Module = require('module');

const root = path.resolve(__dirname, '..');

// TDesign 的 toast 是 npm 包（依赖小程序构建 npm），这里用桩替换掉，其余逻辑照常加载。
const TOAST_STUB = 'tdesign-miniprogram/toast/index';
const resolveFilename = Module._resolveFilename;
Module._resolveFilename = function patchedResolve(request, ...rest) {
  if (request === TOAST_STUB) return TOAST_STUB;
  return resolveFilename.call(this, request, ...rest);
};
require.cache[TOAST_STUB] = {
  id: TOAST_STUB,
  filename: TOAST_STUB,
  loaded: true,
  exports: {
    default: (options) => {
      if (global.__toasts) global.__toasts.push(options);
    },
  },
};

// ---- wx 桩 ----
const storage = new Map();
global.wx = {
  getStorageSync: (key) => (storage.has(key) ? storage.get(key) : ''),
  setStorageSync: (key, value) => storage.set(key, value),
  removeStorageSync: (key) => storage.delete(key),
  getAppBaseInfo: () => ({ theme: 'light' }),
  getSystemInfoSync: () => ({ language: 'zh_CN', theme: 'light' }),
  setNavigationBarTitle: () => {},
  setNavigationBarColor: () => {},
  setBackgroundColor: () => {},
  onThemeChange: () => {},
  reLaunch: () => {},
  navigateTo: () => {},
  scanCode: () => {},
  showModal: () => {},
};

const i18n = require(path.join(root, 'utils/i18n.js'));
i18n.initializeI18n();

// 记录 Toast 调用：验证筛选项失败时不再弹打断式提示。
const toasts = [];
global.__toasts = toasts;

// ---- request 桩：记录请求并返回空页 ----
const requests = [];
const requestPath = require.resolve(path.join(root, 'utils/request.js'));
require.cache[requestPath] = {
  id: requestPath,
  filename: requestPath,
  loaded: true,
  exports: {
    request: async (options) => {
      requests.push(options);
      return { items: [], total: 0 };
    },
    requestCached: async (options) => {
      requests.push(options);
      // 允许按 URL 指定失败，用于验证「筛选项加载失败」的兜底路径。
      if (global.__cachedFail && global.__cachedFail[options.url]) {
        throw new Error('simulated option failure');
      }
      if (typeof global.__cachedResponse === 'function') return global.__cachedResponse(options);
      return global.__cachedResponse || {};
    },
    uploadImage: async () => ({}),
  },
};

// ---- getApp 桩 ----
global.getApp = () => ({
  globalData: {
    authPromise: Promise.resolve({
      user: { display_name: '张三', created_at: '2026-01-01T00:00:00Z' },
      account_disabled: false,
      registration_disabled: false,
      requires_profile: false,
    }),
    featureSettingsPromise: Promise.resolve({
      secondary_warehouse_mode: 'full',
      inventory_mode: 'read_write',
      hazards_mode: 'read_write',
    }),
    pendingMaterialUuid: '',
    imageSettingsPromise: Promise.resolve(),
  },
});

// ---- Page 桩：拿到配置对象，模拟 setData ----
let pageConfig = null;
global.Page = (config) => {
  pageConfig = config;
};
function loadPage(relative) {
  pageConfig = null;
  delete require.cache[require.resolve(path.join(root, relative))];
  require(path.join(root, relative));
  assert(pageConfig, `page config not captured: ${relative}`);
  const page = Object.assign({}, pageConfig);
  page.data = JSON.parse(JSON.stringify(pageConfig.data));
  page.setData = function setData(patch) {
    Object.keys(patch).forEach((key) => {
      // 支持 "form.quantity" 这类路径键
      if (key.indexOf('.') > 0) {
        const [head, tail] = key.split('.');
        this.data[head] = { ...(this.data[head] || {}), [tail]: patch[key] };
      } else {
        this.data[key] = patch[key];
      }
    });
  };
  return page;
}

/**
 * 等页面的一轮异步加载结束。
 *
 * 真机的 onLoad 不需要返回 Promise（`withTheme` 包装后也不透传），所以这里不能 await onLoad 的返回值，
 * 只能轮询页面自己的加载态标志。
 */
function waitFor(predicate, label, timeoutMs = 3000) {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now();
    const tick = () => {
      if (predicate()) return resolve();
      if (Date.now() - startedAt > timeoutMs) return reject(new Error(`timeout waiting for ${label}`));
      setTimeout(tick, 5);
    };
    tick();
  });
}

/** 发起 onLoad 并等首屏加载完成（loading 落回 false）。 */
async function mountPage(relative, options = {}) {
  const page = loadPage(relative);
  void page.onLoad(options);
  await waitFor(() => page.data.loading === false, `${relative} first load`);
  return page;
}

// ---- Component 桩：filter-panel ----
let componentConfig = null;
global.Component = (config) => {
  componentConfig = config;
};
function loadFilterPanel() {
  componentConfig = null;
  const file = path.join(root, 'components/filter-panel/filter-panel.js');
  delete require.cache[require.resolve(file)];
  require(file);
  assert(componentConfig, 'filter-panel component not captured');
  const component = {
    data: JSON.parse(JSON.stringify(componentConfig.data)),
    events: [],
  };
  // properties 的 value 作为初始 data
  Object.keys(componentConfig.properties).forEach((name) => {
    const property = componentConfig.properties[name];
    component.data[name] = property.value;
  });
  component.setData = function setData(patch) {
    Object.assign(this.data, patch);
  };
  // 真实运行时 properties 赋值会触发 observer；桩里手动补一次（面板靠它把 active 同步进草稿）。
  component.setProperty = function setProperty(name, value) {
    this.data[name] = value;
    const property = componentConfig.properties[name];
    if (property && property.observer) property.observer.call(component, value);
  };
  component.triggerEvent = function triggerEvent(name, detail) {
    this.events.push({ name, detail });
  };
  Object.keys(componentConfig.methods).forEach((name) => {
    component[name] = componentConfig.methods[name].bind(component);
  });
  return component;
}

// 各页筛选分区：胶囊类分区必须带「全部」首项且 value 唯一；区间类分区没有 options。
function assertSections(page, label) {
  const sections = page.data.filterSections;
  assert(sections.length > 0, `${label}: filterSections must not be empty`);
  sections.forEach((section) => {
    assert(section.key && section.title, `${label}: section needs key/title`);
    if (section.kind === 'range' || section.kind === 'dateRange') {
      assert(section.fromLabel && section.toLabel, `${label}: ${section.key} needs range labels`);
      return;
    }
    // 候选值来自接口，桩里可能为空：只要有「全部」这一项就算结构正确。
    assert(section.options.length >= 1, `${label}: section ${section.key} needs options`);
    assert(section.options[0].value === '', `${label}: section ${section.key} must start with 全部`);
    const values = section.options.map((option) => option.value);
    assert.strictEqual(new Set(values).size, values.length, `${label}: duplicate option values`);
  });
}

async function run() {
  // ===== filter-panel 组件 =====
  const panel = loadFilterPanel();
  panel.data.sections = [
    {
      key: 'status',
      title: '状态',
      options: [
        { label: '全部', value: '' },
        { label: '待整改', value: '待整改' },
      ],
    },
  ];
  panel.setProperty('active', { status: '待整改' });
  panel.refresh();
  assert(panel.data.activeCount === 1, 'panel should count active filters');
  assert(
    panel.data.sectionsView[0].options.find((option) => option.value === '待整改').selected,
    'panel must mark the active option',
  );

  // 打开面板 → 草稿与已生效值一致；点选项只改草稿，不发事件
  panel.openSheet();
  assert(panel.data.visible === true && panel.data.draft.status === '待整改', 'openSheet seeds draft');
  panel.selectOption({ currentTarget: { dataset: { section: 'status', value: '' } } });
  assert(panel.data.draft.status === '', 'selectOption updates draft');
  assert(panel.events.length === 0, 'selectOption must not emit change');
  // 再点同一个已选项 = 取消
  panel.selectOption({ currentTarget: { dataset: { section: 'status', value: '' } } });
  assert(panel.data.draft.status === '', 're-selecting empty keeps 不限');
  panel.selectOption({ currentTarget: { dataset: { section: 'status', value: '待整改' } } });
  panel.confirmSheet();
  const confirmed = panel.events.pop();
  assert(confirmed.name === 'change' && confirmed.detail.values.status === '待整改', 'confirm emits change');
  assert(panel.data.visible === false, 'confirm closes the sheet');

  // ===== 面板：分字段组合搜索 =====
  // 每个字段一个输入框，填多个后「确定」一次性回传（多字段同时生效）。
  const fieldPanel = loadFilterPanel();
  fieldPanel.setProperty('fieldDefs', [
    { key: 'name', label: '物资名称' },
    { key: 'modelSpec', label: '型号规格' },
  ]);
  fieldPanel.setProperty('fieldValues', { name: '接触器' });
  fieldPanel.refresh();
  assert(fieldPanel.data.fieldRows.length === 2, 'panel must render one input per field');
  assert(
    fieldPanel.data.fieldRows[0].value === '接触器',
    'field input must show the applied value',
  );
  // 打开面板后改两个字段，确定后一起回传
  fieldPanel.openSheet();
  fieldPanel.data.draftFields = {};
  fieldPanel.onFieldInput({ currentTarget: { dataset: { field: 'name' } }, detail: { value: '接触器' } });
  fieldPanel.onFieldInput({ currentTarget: { dataset: { field: 'modelSpec' } }, detail: { value: 'CJX2' } });
  assert(fieldPanel.data.draftFields.name === '接触器', 'typing updates draft only');
  fieldPanel.confirmSheet();
  const fieldChange = fieldPanel.events.pop();
  assert(fieldChange.name === 'change', 'confirm emits change');
  assert(fieldChange.detail.fields.name === '接触器', 'both filled fields must be returned');
  assert(fieldChange.detail.fields.modelSpec === 'CJX2', 'multiple fields returned together');
  // 空字段不参与
  fieldPanel.data.draftFields = { name: '  ', modelSpec: 'CJX2' };
  fieldPanel.confirmSheet();
  const trimmed = fieldPanel.events.pop();
  assert(trimmed.detail.fields.name === undefined, 'blank field must be dropped');
  // 收起态不再铺胶囊，但按钮角标仍要算上分字段条件
  fieldPanel.setProperty('fieldValues', { name: '接触器', modelSpec: 'CJX2' });
  fieldPanel.refresh();
  assert(fieldPanel.data.activeCount === 2, 'field values must count toward the badge');
  assert(fieldPanel.data.chips === undefined, 'collapsed chips must be gone');
  // 面板内的单个清空按钮仍能去掉该字段
  fieldPanel.openSheet();
  fieldPanel.clearField({ currentTarget: { dataset: { field: 'modelSpec' } } });
  assert(fieldPanel.data.draftFields.modelSpec === undefined, 'clearField drops that field only');

  // 面板收到 optionsFailed 后点「重新加载」要发出 retryoptions（页面据此重拉）
  panel.setProperty('optionsFailed', true);
  panel.retryOptions();
  const retriedEvent = panel.events.pop();
  assert(retriedEvent && retriedEvent.name === 'retryoptions', 'panel must emit retryoptions');
  panel.setProperty('optionsFailed', false);

  // 分享值不在候选里：收起态虽不再显示胶囊，但打开面板后该项仍要标成已选
  panel.setProperty('active', { status: '待整改' });
  panel.refresh();
  panel.openSheet();
  assert(
    panel.data.sectionsView[0].options.find((option) => option.value === '待整改').selected,
    'applied value must still be marked inside the panel',
  );
  panel.closeSheet();

  // ===== 申购计划页 =====
  global.__cachedResponse = {
    actual_demand_persons: ['李建军', '王海涛'],
    subitem_nos: ['201'],
    urgencies: ['正常', '紧急'],
    categories: ['备品备件'],
  };
  requests.length = 0;
  let page = await mountPage('pages/purchase-plans/purchase-plans.js');
  assertSections(page, 'purchase-plans');
  const planSections = page.data.filterSections.map((section) => section.key);
  assert.deepStrictEqual(planSections, [
    'urgency', 'category', 'actualDemandPerson', 'purchaseResponsible', 'demandDepartment', 'subitemNo', 'planDate',
  ]);
  // 当前用户固定置顶
  const personOptions = page.data.filterSections[2].options;
  assert(personOptions[1].value === '张三' && personOptions[1].label.indexOf('当前用户') >= 0, 'current user pinned');
  // 确认筛选后请求带上对应参数
  requests.length = 0;
  page.onFilterChange({ detail: { values: { urgency: '紧急', category: '备品备件' } } });
  await new Promise((resolve) => setTimeout(resolve, 10));
  const planRequest = requests.find((item) => item.url === '/mini-program/purchase-plans');
  assert(planRequest, 'purchase-plans request missing');
  assert(planRequest.data.urgency === '紧急', 'urgency must be sent');
  assert(planRequest.data.category === '备品备件', 'category must be sent');
  assert(page.data.filtered === true, 'filtered flag must be set');
  // 面板点「确定」但条件没变：不重复请求
  requests.length = 0;
  page.onFilterChange({ detail: { values: { urgency: '紧急', category: '备品备件' } } });
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert(
    !requests.some((item) => item.url === '/mini-program/purchase-plans'),
    'unchanged filters must not refetch',
  );
  // 分享路径带上全部筛选值
  page.setData({ keyword: '接触器', filters: { urgency: '紧急', category: '', actualDemandPerson: '', subitemNo: '201' } });
  const planShare = page.sharePath();
  assert(planShare.indexOf('urgency=') > 0 && planShare.indexOf('subitemNo=201') > 0, 'share must carry filters');
  assert(planShare.indexOf('category=') === -1, 'empty filters must be omitted');

  // ===== 分字段搜索 = 多字段组合搜索（AND） =====
  // 多个字段同时填 => 各自发到自己的参数上（AND），不收窄成一个 keyword。
  // 先清掉上一步留的综合搜索词，避免两套通道互相干扰。
  page.setData({ keyword: '', filters: {} });
  requests.length = 0;
  page.onFilterChange({
    detail: {
      values: { urgency: '紧急' },
      fields: { name: '接触器', materialCode: 'E011' },
    },
  });
  await new Promise((resolve) => setTimeout(resolve, 10));
  let fieldRequest = requests.filter((item) => item.url === '/mini-program/purchase-plans').pop();
  assert(fieldRequest, 'combined field search request missing');
  assert(fieldRequest.data.name === '接触器', 'each field keeps its own param');
  assert(fieldRequest.data.material_code === 'E011', 'multiple fields must combine');
  assert(fieldRequest.data.urgency === '紧急', 'filters and field search combine');
  assert(fieldRequest.data.keyword === undefined, 'field search must not collapse into keyword');
  assert(page.data.fieldValues.name === '接触器', 'field values must be kept on the page');
  assert(page.data.fieldValues.materialCode === 'E011', 'all filled fields must be kept');

  // 只填一个字段时也只发那一个
  requests.length = 0;
  page.onFilterChange({ detail: { values: {}, fields: { modelSpec: 'CJX2' } } });
  await new Promise((resolve) => setTimeout(resolve, 10));
  fieldRequest = requests.filter((item) => item.url === '/mini-program/purchase-plans').pop();
  assert(fieldRequest.data.model_spec === 'CJX2', 'single field search sends its own param');
  assert(fieldRequest.data.name === undefined, 'unfilled fields must not be sent');

  // 收起态搜索框是综合搜索（keyword），与分字段互不干扰
  requests.length = 0;
  page.setData({ fieldValues: {} });
  page.onSearchChange({ detail: { value: '接触器' } });
  await new Promise((resolve) => setTimeout(resolve, 400));
  fieldRequest = requests.filter((item) => item.url === '/mini-program/purchase-plans').pop();
  assert(fieldRequest.data.keyword === '接触器', 'combined search box uses keyword');

  // 分享要带上分字段值
  page.setData({ fieldValues: { name: '接触器', materialCode: 'E011' } });
  const conditionShare = page.sharePath();
  assert(conditionShare.indexOf('materialCode=E011') > 0, 'share must carry field values');
  assert(conditionShare.indexOf('name=')
    > 0, 'share must carry every filled field');

  // 分享值不在选项里：补进分区
  requests.length = 0;
  global.__cachedResponse = { actual_demand_persons: ['李建军'], subitem_nos: [], urgencies: ['正常'], categories: [] };
  page = await mountPage('pages/purchase-plans/purchase-plans.js', { urgency: '非常紧急' });
  assert(
    page.data.filterSections[0].options.some((option) => option.value === '非常紧急'),
    'shared value must be appended to options',
  );
  assert(page.data.filters.urgency === '非常紧急', 'shared value must be applied');

  // ===== 申购记录页 =====
  global.__cachedResponse = {
    statuses: ['已入库'],
    subitem_nos: ['201'],
    categories: ['备品备件'],
    salespersons: ['马晓东'],
    actual_demand_persons: ['李建军'],
  };
  requests.length = 0;
  page = await mountPage('pages/purchase-records/purchase-records.js');
  assertSections(page, 'purchase-records');
  requests.length = 0;
  page.onFilterChange({
    detail: { values: { status: '已入库', salesperson: '马晓东', actualDemandPerson: '李建军' } },
  });
  await new Promise((resolve) => setTimeout(resolve, 10));
  const recordRequest = requests.find((item) => item.url === '/mini-program/purchase-records');
  assert(recordRequest, 'purchase-records request missing');
  assert(recordRequest.data.status === '已入库', 'status must be sent');
  assert(recordRequest.data.salesperson === '马晓东', 'salesperson must be sent');
  assert(recordRequest.data.actual_demand_person === '李建军', 'actual_demand_person must be sent');

  // ===== 隐患页：固定枚举 + 仅逾期 =====
  global.__cachedResponse = { rectify_persons: ['孙浩宇'] };
  requests.length = 0;
  page = await mountPage('pages/hazards/hazards.js', { status: '待整改', level: '一般隐患', overdue: 'overdue' });
  assertSections(page, 'hazards');
  assert(page.data.filters.status === '待整改', 'shared status applied');
  assert(page.data.filters.level === '一般隐患', 'shared level applied');
  assert(page.data.filters.overdue === 'overdue', 'shared overdue applied');
  requests.length = 0;
  page.onFilterChange({ detail: { values: { status: '', level: '重大隐患', rectifyPerson: '', overdue: 'overdue' } } });
  await new Promise((resolve) => setTimeout(resolve, 10));
  const hazardRequest = requests.find((item) => item.url === '/mini-program/hazards');
  assert(hazardRequest, 'hazards request missing');
  assert(hazardRequest.data.level === '重大隐患', 'level must be sent');
  assert(hazardRequest.data.overdue === true, 'overdue must be sent as boolean');
  assert(hazardRequest.data.status === undefined, 'empty status must be omitted');
  // 非法分享值被忽略
  page = await mountPage('pages/hazards/hazards.js', { status: '不存在的状态', overdue: 'yes' });
  assert(page.data.filters.status === '', 'invalid shared status must be dropped');
  assert(page.data.filters.overdue === '', 'invalid overdue must be dropped');

  // ===== 库存页：固定三档 + 精简模式无分区 =====
  requests.length = 0;
  page = await mountPage('pages/inventory/inventory.js', { stockStatus: 'out_of_stock' });
  assertSections(page, 'inventory');
  assert(page.data.filters.stockStatus === 'out_of_stock', 'shared stock status applied');
  requests.length = 0;
  page.onFilterChange({
    detail: { values: { stockStatus: 'low_stock', stockQty: { from: '1', to: '10' } } },
  });
  await new Promise((resolve) => setTimeout(resolve, 10));
  const inventoryRequest = requests.find((item) => item.url === '/mini-program/inventory');
  assert(inventoryRequest.data.stock_status === 'low_stock', 'stock_status must be sent');
  assert(inventoryRequest.data.min_qty === '1' && inventoryRequest.data.max_qty === '10', 'qty range must be sent');
  // 非法分享值被忽略
  page = await mountPage('pages/inventory/inventory.js', { stockStatus: 'weird' });
  assert(page.data.filters.stockStatus === '', 'invalid shared stock status must fall back to all');

  // ===== 华星页 =====
  global.__cachedResponse = { purchase_departments: ['设备管理部'], purchasers: ['吴冰'] };
  requests.length = 0;
  page = await mountPage('pages/huaxing-inventory/huaxing-inventory.js');
  assertSections(page, 'huaxing');
  requests.length = 0;
  // 多选：部门 / 申购人各选一项，用 | 连接发给后端。
  page.onFilterChange({
    detail: { values: { purchaseDepartment: ['设备管理部'], purchaser: ['吴冰'], firstInboundDate: { from: '2026-01-01', to: '' } } },
  });
  await new Promise((resolve) => setTimeout(resolve, 10));
  const huaxingRequest = requests.find((item) => item.url === '/mini-program/huaxing-inventory');
  assert(huaxingRequest.data.purchase_department === '设备管理部', 'department must be sent');
  assert(huaxingRequest.data.purchaser === '吴冰', 'purchaser must be sent');
  assert(huaxingRequest.data.date_from === '2026-01-01', 'inbound date from must be sent');
  assert(huaxingRequest.data.date_to === undefined, 'empty date to must be omitted');

  // ===== 筛选项加载失败：不弹打断式提示，面板给「重新加载」 =====
  global.__cachedFail = { '/mini-program/hazards/filter-options': true };
  global.__cachedResponse = {};
  requests.length = 0;
  toasts.length = 0;
  page = await mountPage('pages/hazards/hazards.js');
  assert(page.data.optionsFailed === true, 'hazard option failure must set optionsFailed');
  // 不该再弹「筛选选项加载失败」这类打断式提示
  assert(
    !toasts.some((item) => String(item.message || '').indexOf('筛选选项') >= 0),
    'option failure must not toast an interrupting message',
  );
  // 列表仍然正常请求（失败不影响取数）
  assert(
    requests.some((item) => item.url === '/mini-program/hazards'),
    'list must still load when filter options fail',
  );
  // 固定枚举分区仍然可用（状态 / 等级 / 仅逾期不依赖接口）
  assertSections(page, 'hazards(failed options)');
  const statusSection = page.data.filterSections.find((section) => section.key === 'status');
  assert(statusSection.options.length > 2, 'built-in enum sections must survive option failure');

  // 重试成功后恢复完整选项并清掉失败标记
  delete global.__cachedFail;
  global.__cachedResponse = { rectify_persons: ['孙浩宇'], units: [], types: [] };
  page.onRetryOptions();
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert(page.data.optionsFailed === false, 'retry must clear optionsFailed');
  const retried = page.data.filterSections.find((section) => section.key === 'rectifyPerson');
  assert(
    retried.options.some((option) => option.value === '孙浩宇'),
    'retry must reload the option values',
  );

  // 华星：接口失败时部门 / 申购人只剩「全部」，但仍可用
  global.__cachedFail = { '/mini-program/huaxing-inventory/filter-options': true };
  global.__cachedResponse = {};
  requests.length = 0;
  page = await mountPage('pages/huaxing-inventory/huaxing-inventory.js');
  assert(page.data.optionsFailed === true, 'huaxing option failure must set optionsFailed');
  assertSections(page, 'huaxing(failed options)');
  delete global.__cachedFail;

  // 台账：标签候选失败时列表照常
  global.__cachedFail = { '/mini-program/ledger-items/tag-options': true };
  global.__cachedResponse = {};
  page = await mountPage('pages/ledger/ledger.js');
  assert(page.data.optionsFailed === true, 'ledger option failure must set optionsFailed');
  delete global.__cachedFail;

  // ===== 首页：扫码入口按 canOutbound 显示 =====
  const home = loadPage('pages/home/home.js');
  void home.onLoad();
  await waitFor(() => home.data.featureReady || home.data.loadFailed, 'home session');
  assert(home.data.canScan === true, 'no-lite read_write mode allows scanning');
  assert(home.data.featureReady === true, 'home entries must be ready');

  console.log('Mini Program page logic check passed.');
}

run().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
