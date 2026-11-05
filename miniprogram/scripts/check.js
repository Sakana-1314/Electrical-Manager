const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

const appConfig = JSON.parse(read('app.json'));
JSON.parse(read('project.config.json'));

// 页面清单以 app.json 为准，避免检查清单与实际页面漂移。
const pages = appConfig.pages.map((page) => page.replace(/^pages\//, ''));
const requiredFiles = ['app.js', 'app.json', 'app.wxss'];
const sharedComponents = ['material-summary-card/material-summary-card'];
for (const page of pages) {
  for (const extension of ['js', 'json', 'wxml', 'wxss']) {
    requiredFiles.push(`pages/${page}.${extension}`);
  }
}
for (const component of sharedComponents) {
  for (const extension of ['js', 'json', 'wxml', 'wxss']) {
    requiredFiles.push(`components/${component}.${extension}`);
  }
}

for (const file of requiredFiles) {
  if (!fs.existsSync(path.join(root, file))) {
    throw new Error(`Missing required file: ${file}`);
  }
}

const pageConfigs = pages.map((page) => JSON.parse(read(`pages/${page}.json`)));

if (appConfig.pages[0] !== 'pages/home/home') {
  throw new Error('Mini Program home page must be pages/home/home.');
}
if (appConfig.pages.some((page) => page.endsWith('/index'))) {
  throw new Error('Mini Program pages must use semantic file names.');
}

const appScript = read('app.js');
if (!appScript.includes('onPageNotFound()') || !appScript.includes("'/pages/home/home'")) {
  throw new Error('Mini Program must redirect missing pages to home.');
}

// ============ 深色模式（外观三档） ============
const themeConfig = JSON.parse(read('theme.json'));
const windowConfig = appConfig.window || {};
const themeVariables = [];
for (const [key, value] of Object.entries(windowConfig)) {
  if (typeof value === 'string' && value.startsWith('@')) themeVariables.push([key, value.slice(1)]);
}
for (const key of ['backgroundColor', 'backgroundTextStyle', 'navigationBarBackgroundColor', 'navigationBarTextStyle']) {
  if (!themeVariables.some(([name]) => name === key)) {
    throw new Error(`Mini Program window.${key} must reference a theme.json variable.`);
  }
}
if (appConfig.darkmode !== true) {
  throw new Error('Mini Program must enable app.json darkmode to read the system theme.');
}
if (appConfig.themeLocation !== 'theme.json') {
  throw new Error('Mini Program themeLocation must point to theme.json.');
}
if (!themeConfig.light || !themeConfig.dark) {
  throw new Error('theme.json must define both light and dark palettes.');
}
const themeKeys = Object.keys(themeConfig.light).sort();
if (JSON.stringify(themeKeys) !== JSON.stringify(Object.keys(themeConfig.dark).sort())) {
  throw new Error('theme.json light and dark palettes must define the same variables.');
}
if (themeConfig.light.bgColor !== '#f4f6fa') {
  throw new Error('Mini Program background color must match the web theme.');
}
for (const [key, name] of themeVariables) {
  if (!(name in themeConfig.light) || !(name in themeConfig.dark)) {
    throw new Error(`Mini Program window.${key} references unknown theme variable: ${name}`);
  }
}

/** 取出选择器对应的样式块内容（选择器顶格书写、块以顶格 `}` 结束）。 */
function styleBlock(styles, selector) {
  const start = styles.indexOf(`\n${selector} {`);
  if (start < 0) return null;
  const bodyStart = styles.indexOf('{', start) + 1;
  const end = styles.indexOf('\n}', bodyStart);
  if (end < 0) return null;
  return styles.slice(bodyStart, end);
}

function tokenNames(block) {
  return (block.match(/--[a-z0-9-]+(?=:)/g) || []).sort();
}

const appStyles = read('app.wxss');
const lightTokens = styleBlock(appStyles, 'page');
const darkTokens = styleBlock(appStyles, '.theme-dark');
const bridgeTokens = styleBlock(appStyles, 'page,\n.theme-dark');
if (!lightTokens || !darkTokens || !bridgeTokens) {
  throw new Error('app.wxss must define the page palette, the .theme-dark palette and the TDesign bridge.');
}
const lightTokenNames = tokenNames(lightTokens).filter((name) => name.startsWith('--app-'));
const darkTokenNames = tokenNames(darkTokens).filter((name) => name.startsWith('--app-'));
if (lightTokenNames.length < 40 || lightTokenNames.length !== new Set(lightTokenNames).size) {
  throw new Error('app.wxss light palette must define every --app-* token exactly once.');
}
if (JSON.stringify(lightTokenNames) !== JSON.stringify(darkTokenNames)) {
  throw new Error('app.wxss dark palette must override every light --app-* token.');
}
for (const declaration of bridgeTokens.split(';')) {
  const trimmed = declaration.trim();
  if (!trimmed) continue;
  if (!/^--td-[a-z0-9-]+: var\(--app-[a-z0-9-]+\)$/.test(trimmed)) {
    throw new Error(`TDesign bridge tokens must reference --app-* tokens only: ${trimmed}`);
  }
  const referenced = trimmed.slice(trimmed.indexOf('var(') + 4).replace(/\)$/, '');
  if (!lightTokenNames.includes(referenced)) {
    throw new Error(`TDesign bridge references an unknown token: ${referenced}`);
  }
}
for (const token of ['--td-brand-color: var(--app-brand)', '--td-text-color-primary: var(--app-text-strong)']) {
  if (!appStyles.includes(token)) {
    throw new Error(`Missing shared TDesign theme token: ${token}`);
  }
}
if (!appStyles.includes('.theme-dark')) {
  throw new Error('Mini Program styles must define the dark theme scope.');
}
// 项目选择器（t-picker）的顶/底渐隐遮罩用 var(--td-picker-transparent-color) 收尾，
// 桥接缺失会让整条渐变失效（组件默认值来自未被引入的媒体查询主题）。
for (const token of [
  '--td-picker-bg-color: var(--app-surface)',
  '--td-picker-transparent-color: var(--app-transparent)',
]) {
  if (!appStyles.includes(token)) {
    throw new Error(`Missing TDesign picker bridge token: ${token}`);
  }
}

function listStyles(dir) {
  return fs
    .readdirSync(path.join(root, dir))
    .flatMap((entry) => {
      const relative = `${dir}/${entry}`;
      if (!fs.statSync(path.join(root, relative)).isDirectory()) return [];
      return fs
        .readdirSync(path.join(root, relative))
        .filter((name) => name.endsWith('.wxss'))
        .map((name) => `${relative}/${name}`);
    });
}

// 页面样式只引用令牌，颜色字面量只允许出现在 app.wxss 的令牌定义里。
for (const file of listStyles('pages').concat(listStyles('components'))) {
  const styles = read(file);
  const literal = styles.match(/#[0-9a-fA-F]{3,8}\b|rgba?\(/);
  if (literal) {
    throw new Error(`${file} must not hardcode colors, found: ${literal[0]}`);
  }
  if (styles.includes('prefers-color-scheme')) {
    throw new Error(`${file} must not switch themes with media queries; use the .theme-dark scope.`);
  }
}
for (const file of ['app.wxss'].concat(listStyles('pages'), listStyles('components'))) {
  if (read(file).includes('tdesign-miniprogram/common/style/theme')) {
    throw new Error(`${file} must not import the TDesign media-query theme files.`);
  }
}

// 引用的 --app-* 令牌必须在调色板里定义，避免拼错令牌名后静默失效。
for (const file of ['app.wxss'].concat(listStyles('pages'), listStyles('components'))) {
  for (const name of new Set(read(file).match(/var\((--app-[a-z0-9-]+)/g) || [])) {
    const token = name.replace('var(', '');
    if (!lightTokenNames.includes(token)) {
      throw new Error(`${file} references an undefined theme token: ${token}`);
    }
  }
}

const {
  THEME_MODE_DEFAULT,
  THEME_MODE_STORAGE_KEY,
  normalizeThemeMode,
  readThemeMode,
  resolveTheme,
  writeThemeMode,
  themePageData,
  withTheme,
} = require(path.join(root, 'utils/theme.js'));

if (THEME_MODE_STORAGE_KEY !== 'miniProgramThemeMode' || THEME_MODE_DEFAULT !== 'auto') {
  throw new Error('Mini Program appearance preference must default to auto.');
}
if (normalizeThemeMode('dark') !== 'dark' || normalizeThemeMode('system') !== 'auto') {
  throw new Error('Mini Program appearance preference must fall back to auto.');
}
if (JSON.stringify(resolveTheme('auto', 'dark')) !== JSON.stringify({ mode: 'auto', theme: 'dark', themeClass: 'theme-dark' })) {
  throw new Error('Mini Program auto appearance must follow the system theme.');
}
if (resolveTheme('light', 'dark').theme !== 'light' || resolveTheme('dark', 'light').theme !== 'dark') {
  throw new Error('Mini Program explicit appearance must override the system theme.');
}
if (resolveTheme('light', 'light').themeClass !== '') {
  throw new Error('Mini Program light appearance must rely on the default palette.');
}
if (readThemeMode() !== 'auto' || themePageData().themeMode !== 'auto') {
  throw new Error('Mini Program appearance must fall back to auto without storage.');
}
const themedPage = withTheme({ data: { i18n: {} }, onLoad() {}, onShow() {}, onUnload() {}, custom: 1 });
if (themedPage.custom !== 1 || !themedPage.onLoad || !themedPage.onShow || !themedPage.onUnload) {
  throw new Error('withTheme must keep the wrapped page config.');
}
if (themedPage.data.themeMode !== 'auto' || themedPage.data.theme !== 'light' || themedPage.data.themeClass !== '') {
  throw new Error('withTheme must inject the resolved appearance into page data.');
}
if (themedPage.data.themeLabel !== require(path.join(root, 'utils/i18n.js')).t('themeModeAuto')) {
  throw new Error('withTheme must inject the appearance label shown by the closed dropdown.');
}
if (themedPage.data.i18n === undefined) {
  throw new Error('withTheme must keep the page data.');
}

// 用最小 wx 桩验证运行时：档位持久化、页面 data 同步、原生配色与系统主题广播。
{
  let systemTheme = 'light';
  const storage = new Map();
  const nativeCalls = { nav: [], background: [] };
  const listeners = [];
  global.wx = {
    getAppBaseInfo: () => ({ theme: systemTheme }),
    getStorageSync: (key) => (storage.has(key) ? storage.get(key) : ''),
    setStorageSync: (key, value) => storage.set(key, value),
    setNavigationBarColor: (options) => nativeCalls.nav.push(options),
    setBackgroundColor: (options) => nativeCalls.background.push(options),
    onThemeChange: (listener) => listeners.push(listener),
  };

  const { applyThemeToPage, getAppearanceOptions, setThemeMode } = require(path.join(root, 'utils/theme.js'));
  const page = {
    data: themePageData(),
    setData(patch) {
      Object.assign(this.data, patch);
    },
  };

  themedPage.onLoad.call(page);
  if (page.data.theme !== 'light' || page.data.themeClass !== '' || nativeCalls.nav.length !== 1) {
    throw new Error('Applying the light appearance must keep the default palette and set the native bar.');
  }
  if (page.data.themeLabel !== require(path.join(root, 'utils/i18n.js')).t('themeModeAuto')) {
    throw new Error('The appearance dropdown must show the current tier label.');
  }
  if (nativeCalls.nav[0].frontColor !== '#000000' || nativeCalls.background[0].backgroundColor !== '#f4f6fa') {
    throw new Error('Light appearance must use the light native colors.');
  }

  themedPage.onShow.call(page);
  if (listeners.length !== 1) {
    throw new Error('Showing a themed page must register a single wx.onThemeChange listener.');
  }
  systemTheme = 'dark';
  listeners[0]({ theme: 'dark' });
  if (page.data.theme !== 'dark' || page.data.themeClass !== 'theme-dark') {
    throw new Error('Auto appearance must follow the system theme change.');
  }
  if (nativeCalls.nav[1].frontColor !== '#ffffff' || nativeCalls.background[1].backgroundColor !== '#13171d') {
    throw new Error('Dark appearance must use the dark native colors.');
  }

  setThemeMode(page, 'light');
  if (storage.get(THEME_MODE_STORAGE_KEY) !== 'light' || page.data.theme !== 'light') {
    throw new Error('Selecting an explicit appearance must persist and switch the page palette.');
  }
  if (page.data.themeLabel !== require(path.join(root, 'utils/i18n.js')).t('themeModeLight')) {
    throw new Error('The appearance dropdown label must follow the selected tier.');
  }
  systemTheme = 'light';
  listeners[0]({ theme: 'light' });
  systemTheme = 'dark';
  listeners[0]({ theme: 'dark' });
  if (page.data.theme !== 'light' || page.data.themeMode !== 'light') {
    throw new Error('Explicit appearance must override a system theme change.');
  }

  themedPage.onUnload.call(page);
  systemTheme = 'light';
  setThemeMode(page, 'auto');
  systemTheme = 'dark';
  listeners[0]({ theme: 'dark' });
  if (page.data.theme !== 'light') {
    throw new Error('Unloaded pages must not react to system theme changes.');
  }
  if (readThemeMode() !== 'auto' || writeThemeMode('unknown') !== 'auto' || readThemeMode() !== 'auto') {
    throw new Error('Appearance storage must reject unknown tiers.');
  }

  const options = getAppearanceOptions();
  if (options.map((option) => option.value).join(',') !== 'auto,light,dark' || options.some((option) => !option.label)) {
    throw new Error('Appearance options must expose the three translated tiers.');
  }
  delete global.wx;
}

// 首页外观入口是一个滚轮选择器：收起时显示当前档位，弹出后列出三档（与项目切换同一套交互）。
{
  const homeScript = read('pages/home/home.js');
  for (const snippet of [
    'appearancePickerVisible',
    'themePickerValue',
    'openAppearancePicker',
    'onAppearancePickerConfirm',
    'onAppearancePickerVisibleChange',
  ]) {
    if (!homeScript.includes(snippet)) {
      throw new Error(`pages/home/home.js must wire the appearance picker: ${snippet}`);
    }
  }
  if (homeScript.includes('appearanceExpanded') || homeScript.includes('toggleAppearance')) {
    throw new Error('The appearance switcher must not keep the hand-rolled expandable list.');
  }
  const homeMarkup = read('pages/home/home.wxml');
  for (const snippet of [
    '{{themeLabel}}',
    'openAppearancePicker',
    'onAppearancePickerConfirm',
    'bind:visible-change="onAppearancePickerVisibleChange"',
    'options="{{themeOptions}}"',
  ]) {
    if (!homeMarkup.includes(snippet)) {
      throw new Error(`pages/home/home.wxml must render the appearance picker: ${snippet}`);
    }
  }
  if (homeMarkup.includes('appearanceExpanded') || homeMarkup.includes('t-radio-group')) {
    throw new Error('The appearance switcher must use t-picker, not an inline radio group.');
  }
  const homeConfig = JSON.parse(read('pages/home/home.json'));
  const components = Object.values(homeConfig.usingComponents || {});
  for (const component of [
    'tdesign-miniprogram/picker/picker',
    'tdesign-miniprogram/picker-item/picker-item',
  ]) {
    if (!components.includes(component)) {
      throw new Error(`pages/home/home.json must register ${component} for the appearance picker.`);
    }
  }
  if (components.includes('tdesign-miniprogram/radio-group/radio-group')) {
    throw new Error('pages/home/home.json must not keep t-radio-group after the appearance picker.');
  }
}

// 首页个人信息弹窗里的「当前项目」：展示当前项目并用 t-picker 滚轮选择器切换到其它启用项目（切换后整页重启）。
{
  const homeScript = read('pages/home/home.js');
  for (const snippet of [
    'ensureProject',
    'getEnabledProjects',
    'switchProject',
    'takeProjectSwitchNotice',
    'projectPickerVisible',
    'projectPickerValue',
    'pickerPopupProps',
    'openProjectPicker',
    'onProjectPickerConfirm',
    'onProjectPickerVisibleChange',
  ]) {
    if (!homeScript.includes(snippet)) {
      throw new Error(`pages/home/home.js must wire the current project picker: ${snippet}`);
    }
  }
  const homeMarkup = read('pages/home/home.wxml');
  for (const snippet of [
    'i18n.currentProject',
    'projectOptions',
    'openProjectPicker',
    'onProjectPickerConfirm',
    'bind:visible-change="onProjectPickerVisibleChange"',
    'popup-props="{{pickerPopupProps}}"',
    'visible="{{projectPickerVisible}}"',
    'options="{{projectOptions}}"',
  ]) {
    if (!homeMarkup.includes(snippet)) {
      throw new Error(`pages/home/home.wxml must render the current project picker: ${snippet}`);
    }
  }
  if (homeMarkup.includes('projectsExpanded') || homeScript.includes('projectsExpanded')) {
    throw new Error('The current project switcher must not keep the hand-rolled expandable list.');
  }
  // 选项必须是组件约定的 { label, value }：t-picker-item 用 value 作 wx:key 并据它回显选中项，
  // 自定义 keys 映射到别的字段名会让 wx:key 落空。
  for (const snippet of ['label: project.label', 'value: project.id']) {
    if (!homeScript.includes(snippet)) {
      throw new Error(`The project picker options must use the TDesign label/value contract: ${snippet}`);
    }
  }
  if (homeMarkup.includes('keys="{{projectPickerKeys}}"') || homeScript.includes('projectPickerKeys')) {
    throw new Error('The project picker must not remap option keys; use label/value instead.');
  }
  const homeConfig = JSON.parse(read('pages/home/home.json'));
  const components = Object.values(homeConfig.usingComponents || {});
  for (const component of ['tdesign-miniprogram/picker/picker', 'tdesign-miniprogram/picker-item/picker-item']) {
    if (!components.includes(component)) {
      throw new Error(`pages/home/home.json must register ${component} for the project picker.`);
    }
  }
}

// 首页入口要等登录态与功能配置同时返回：加载期间只渲染加载态，不提前铺功能入口。
{
  const homeScript = read('pages/home/home.js');
  const homeMarkup = read('pages/home/home.wxml');
  for (const snippet of ['loadSession', 'loadFailed', 'retryLoad', 'featureReady: false']) {
    if (!homeScript.includes(snippet)) {
      throw new Error(`pages/home/home.js must gate the home entries behind loading: ${snippet}`);
    }
  }
  // 扫码卡与入口网格都在同一段 featureReady 守卫里（block），否则加载中仍会先渲染一遍入口。
  if (!homeMarkup.includes('<block wx:if="{{featureReady}}">')) {
    throw new Error('The home entries must only render after the session and features load.');
  }
  for (const snippet of ['class="scan-card"', 'class="action-grid"']) {
    if (!homeMarkup.includes(snippet)) {
      throw new Error(`The home entries must stay inside the featureReady block: ${snippet}`);
    }
  }
  // 扫码是首页唯一的主动作：整卡可点，不能再嵌套「开始扫码」按钮（版式与功能入口一致）。
  if (!homeMarkup.includes('aria-label="{{i18n.scanMaterialCode}}"') ||
      !homeMarkup.includes('bind:tap="scanMaterial"')) {
    throw new Error('The home scan card must be tappable as a whole.');
  }
  if (homeMarkup.includes('class="scan-action"')) {
    throw new Error('The home scan card must not nest a separate start-scan button.');
  }
  if (!homeScript.includes('canScan: canOutbound()')) {
    throw new Error('The home scan card must only render when outbound is allowed.');
  }
  for (const snippet of ['!featureReady && !loadFailed', 'bind:tap="retryLoad"']) {
    if (!homeMarkup.includes(snippet)) {
      throw new Error(`pages/home/home.wxml must render the loading / retry panels: ${snippet}`);
    }
  }
  const homeConfig = JSON.parse(read('pages/home/home.json'));
  const components = Object.values(homeConfig.usingComponents || {});
  for (const component of [
    'tdesign-miniprogram/loading/loading',
    'tdesign-miniprogram/empty/empty',
    'tdesign-miniprogram/button/button',
  ]) {
    if (!components.includes(component)) {
      throw new Error(`pages/home/home.json must register ${component} for the loading panel.`);
    }
  }
}

// 列表页筛选：搜索 + 「筛选」按钮 + 底部面板（共享组件），可选的维度再多也不占首屏。
// 五个列表页（库存 / 华星 / 申购计划 / 申购记录 / 隐患）必须用同一套组件，不能回到常驻下拉。
{
  const componentFiles = ['js', 'json', 'wxml', 'wxss'].map((ext) => `components/filter-panel/filter-panel.${ext}`);
  for (const file of componentFiles) {
    if (!fs.existsSync(path.join(root, file))) {
      throw new Error(`Missing shared filter panel file: ${file}`);
    }
  }
  const panelScript = read('components/filter-panel/filter-panel.js');
  for (const snippet of ['sections', 'active', 'triggerEvent(\'change\'', 'triggerEvent(\'search\'']) {
    if (!panelScript.includes(snippet)) {
      throw new Error(`components/filter-panel must expose the filter contract: ${snippet}`);
    }
  }
  const panelMarkup = read('components/filter-panel/filter-panel.wxml');
  // 收起态只有一行「搜索 + 筛选按钮」，不再铺已选条件胶囊（条件在面板里看）。
  for (const snippet of ['class="filter-bar"', 'placement="bottom"']) {
    if (!panelMarkup.includes(snippet)) {
      throw new Error(`components/filter-panel/filter-panel.wxml must render: ${snippet}`);
    }
  }
  if (panelMarkup.includes('filter-chips') || panelScript.includes('removeChip')) {
    throw new Error('The collapsed filter bar must not render selected-condition chips.');
  }
  // 角标只能按「值里真有内容」计数：多选的默认值 [] 是 truthy，
  // 一旦按 kind 分支 or 直接 `if (value)`，没筛选也会显示徽标（华星曾因此显示 2）。
  if (!panelScript.includes('function countValue(')) {
    throw new Error('components/filter-panel must count active filters with countValue().');
  }
  if (/if \(value\) activeCount \+= 1/.test(panelScript)) {
    throw new Error('The filter badge must not count truthy empty arrays as active filters.');
  }
  // 页面侧的 buildSection 必须把 kind 带到分区上，否则多选会被当成单选渲染。
  // 只检查该函数内的 return 对象有没有 kind（`kind: 'single'` 与形参透传都算）。
  for (const page of [
    'huaxing-inventory/huaxing-inventory',
    'purchase-plans/purchase-plans',
    'purchase-records/purchase-records',
    'hazards/hazards',
  ]) {
    const script = read(`pages/${page}.js`);
    // 用定义签名定位（`buildSection(key, ...` 会命中调用处，所以要求前面是方法名声明形式）。
    const def = script.indexOf('  buildSection(key, title');
    if (def < 0) continue;
    const ret = script.indexOf('return {', def);
    if (ret < 0 || ret - def > 1500) {
      throw new Error(`pages/${page}.js buildSection must return a section object.`);
    }
    const objEnd = script.indexOf('}', ret);
    if (!/\bkind\b/.test(script.slice(ret, objEnd))) {
      throw new Error(`pages/${page}.js buildSection must pass kind through to the section.`);
    }
  }

  // 「重置」必须清空并立即生效：只清草稿会让角标继续挂着已生效的条件，和按钮文案不符。
  // 取 resetDraft 的函数体（到下一个行首的四个空格 + ` },` 为止），要求同时清草稿并发 change。
  const resetStart = panelScript.indexOf('resetDraft() {');
  const resetEnd = resetStart < 0 ? -1 : panelScript.indexOf('\n    },', resetStart);
  if (resetStart < 0 || resetEnd < 0) {
    throw new Error('components/filter-panel must keep a resetDraft handler.');
  }
  const resetBody = panelScript.slice(resetStart, resetEnd);
  for (const snippet of ['draftFields: {}', "triggerEvent('change'"]) {
    if (!resetBody.includes(snippet)) {
      throw new Error(`The filter panel reset must apply immediately: missing ${snippet}`);
    }
  }
  // 面板里点选项只改草稿，必须先点「确定」才回传：草稿与已生效值分两个字段。
  if (!panelScript.includes('draft') || !panelScript.includes('confirmSheet')) {
    throw new Error('The filter panel must keep a draft and apply it on confirm.');
  }
  // 分字段搜索 = 多字段组合搜索：每个字段一个输入框，填多个即 AND。
  for (const snippet of ['fieldDefs', 'fieldValues', 'onFieldInput', 'clearField', 'toggleOption', 'openDatePicker']) {
    if (!panelScript.includes(snippet)) {
      throw new Error(`components/filter-panel must support combined field search / multi / range: ${snippet}`);
    }
  }
  if (!panelMarkup.includes('filter-field-list') || !panelMarkup.includes('onFieldInput')) {
    throw new Error('components/filter-panel/filter-panel.wxml must render one input per search field.');
  }
  // 不允许退回「先选字段再添加」的写法：那是一次只能一个字段，不是组合搜索。
  if (panelMarkup.includes('addCondition') || panelScript.includes('addCondition')) {
    throw new Error('The filter panel must not go back to add-one-condition-at-a-time.');
  }
  for (const kind of ["'multi'", "'range'", "'dateRange'"]) {
    if (!panelMarkup.includes(kind)) {
      throw new Error(`components/filter-panel/filter-panel.wxml must render the ${kind} section kind.`);
    }
  }
  const panelConfig = JSON.parse(read('components/filter-panel/filter-panel.json'));
  const panelComponents = Object.values(panelConfig.usingComponents || {});
  // 分字段用输入框而不是滚轮选择器，所以只需要日期选择器。
  for (const component of [
    'tdesign-miniprogram/date-time-picker/date-time-picker',
  ]) {
    if (!panelComponents.includes(component)) {
      throw new Error(`components/filter-panel/filter-panel.json must register ${component}.`);
    }
  }

  // 筛选项加载失败要落到面板里的「重新加载」，而不是弹打断式 toast：
  // 列表本身是好的，弹错误提示会让人以为页面坏了；而且弹完没有重试入口。
  for (const snippet of ['optionsFailed', 'retryOptions']) {
    if (!(panelScript + panelMarkup).includes(snippet)) {
      throw new Error(`filter options failure must be retryable in the panel: ${snippet}`);
    }
  }
  if (!read('utils/i18n.js').includes('filterOptionsRetry')) {
    throw new Error('utils/i18n.js must translate the filter option retry label.');
  }
  for (const page of [
    'hazards/hazards',
    'huaxing-inventory/huaxing-inventory',
    'purchase-plans/purchase-plans',
    'purchase-records/purchase-records',
    'ledger/ledger',
  ]) {
    const script = read(`pages/${page}.js`);
    if (!script.includes('optionsFailed')) {
      throw new Error(`pages/${page}.js must surface filter option failures to the panel.`);
    }
    if (/FilterOptionsLoadFailed'\)[\s\S]{0,80}theme: 'warning'/.test(script)) {
      throw new Error(`pages/${page}.js must not toast an interrupting message on option failure.`);
    }
  }

  for (const page of [
    'inventory/inventory',
    'huaxing-inventory/huaxing-inventory',
    'purchase-plans/purchase-plans',
    'purchase-records/purchase-records',
    'hazards/hazards',
  ]) {
    const markup = read(`pages/${page}.wxml`);
    if (!markup.includes('<filter-panel')) {
      throw new Error(`pages/${page}.wxml must use the shared filter panel.`);
    }
    for (const snippet of ['bind:search="onSearchChange"', 'bind:change="onFilterChange"']) {
      if (!markup.includes(snippet)) {
        throw new Error(`pages/${page}.wxml must wire the filter panel: ${snippet}`);
      }
    }
    if (markup.includes('<t-dropdown-menu')) {
      throw new Error(`pages/${page}.wxml must not keep the always-visible dropdown menu.`);
    }
    const config = JSON.parse(read(`pages/${page}.json`));
    if (!Object.values(config.usingComponents || {}).includes('/components/filter-panel/filter-panel')) {
      throw new Error(`pages/${page}.json must register the shared filter panel.`);
    }
    const script = read(`pages/${page}.js`);
    for (const snippet of ['FILTER_SECTIONS', 'onFilterChange', 'filterSections']) {
      if (!script.includes(snippet)) {
        throw new Error(`pages/${page}.js must feed the filter panel: ${snippet}`);
      }
    }
    // 分字段组合搜索要接上：字段定义 / 已填值 / 两个 prop 都要传，否则面板显不出多个输入框。
    for (const snippet of [
      'FIELD_DEFS',
      'fieldValues',
      'buildFieldQuery',
      'buildSearchQuery',
    ]) {
      if (!script.includes(snippet)) {
        throw new Error(`pages/${page} must wire the combined field search: ${snippet}`);
      }
    }
    for (const snippet of ['field-defs="{{fieldDefs}}"', 'field-values="{{fieldValues}}"']) {
      if (!markup.includes(snippet)) {
        throw new Error(`pages/${page}.wxml must pass the field search props: ${snippet}`);
      }
    }
  }

  // 物料编码 / 台账同样用共享面板（前者只有分字段搜索，后者只有标签筛选）。
  for (const page of ['material-codes/material-codes', 'ledger/ledger']) {
    const markup = read(`pages/${page}.wxml`);
    if (!markup.includes('<filter-panel')) {
      throw new Error(`pages/${page}.wxml must use the shared filter panel.`);
    }
    if (markup.includes('<t-search')) {
      throw new Error(`pages/${page}.wxml must not keep a bare t-search outside the panel.`);
    }
    const config = JSON.parse(read(`pages/${page}.json`));
    if (!Object.values(config.usingComponents || {}).includes('/components/filter-panel/filter-panel')) {
      throw new Error(`pages/${page}.json must register the shared filter panel.`);
    }
    if (!read(`pages/${page}.js`).includes('onFilterChange')) {
      throw new Error(`pages/${page}.js must handle filter panel changes.`);
    }
  }

  // 筛选状态的归一 / 判定集中在一处：五页用同一套，避免某页漏掉「条件没变不重查」。
  const filtersUtil = read('utils/filters.js');
  for (const name of ['normalizeFilters', 'hasActiveFilter', 'sameFilters']) {
    if (!filtersUtil.includes(`function ${name}(`)) {
      throw new Error(`utils/filters.js must export ${name}.`);
    }
  }
  for (const page of [
    'purchase-plans/purchase-plans',
    'purchase-records/purchase-records',
    'hazards/hazards',
    'huaxing-inventory/huaxing-inventory',
  ]) {
    const script = read(`pages/${page}.js`);
    for (const snippet of ["require('../../utils/filters')", 'sameFilters(this.data.filters']) {
      if (!script.includes(snippet)) {
        throw new Error(`pages/${page}.js must reuse utils/filters: ${snippet}`);
      }
    }
  }
}

// 上传脚本必须把开发文件排除在小程序包外：主包上限 2MB，而 package-lock.json 一项就有 530KB+。
// 这些文件一旦被重新打进包，体积会悄悄顶到上限（线上报 80051 时才知道）。
{
  const uploadScript = read('scripts/upload.js');
  const match = uploadScript.match(/const IGNORES = \[([\s\S]*?)\];/);
  if (!match) {
    throw new Error('scripts/upload.js must declare the packaged-file ignore list.');
  }
  for (const entry of ['node_modules/**/*', 'package-lock.json', 'scripts/**/*', 'README.md']) {
    if (!match[1].includes(`'${entry}'`)) {
      throw new Error(`scripts/upload.js must keep "${entry}" out of the mini program package.`);
    }
  }
  if (!uploadScript.includes('PACKAGE_LIMIT_KB')) {
    throw new Error('scripts/upload.js must check the package size before uploading.');
  }
}

// 列表页筛选面板（.filter-panel）是页面里唯一的筛选入口：旧的常驻下拉必须彻底退场。
{
  for (const page of [
    'inventory/inventory',
    'huaxing-inventory/huaxing-inventory',
    'purchase-plans/purchase-plans',
    'purchase-records/purchase-records',
    'hazards/hazards',
  ]) {
    const styles = read(`pages/${page}.wxss`);
    for (const legacy of ['.filter-menu', 't-dropdown']) {
      if (styles.includes(legacy)) {
        throw new Error(`pages/${page}.wxss must not keep the legacy dropdown styles: ${legacy}`);
      }
    }
  }
}

// 台账查看（列表 + 详情）：首页入口接功能开关，列表页只读、详情页按 id 取数。
{
  const homeScript = read('pages/home/home.js');
  const homeMarkup = read('pages/home/home.wxml');
  if (!homeScript.includes("ensureFeatureEnabled('ledger_mode')")) {
    throw new Error('The home page must gate the ledger entry behind ledger_mode.');
  }
  if (!homeMarkup.includes('i18n.ledgerTitle') || !homeMarkup.includes('bind:tap="openLedger"')) {
    throw new Error('The home page must render the ledger entry.');
  }
  if (!read('utils/features.js').includes('ledger_mode:')) {
    throw new Error('utils/features.js must define the ledger_mode fallback.');
  }

  const listScript = read('pages/ledger/ledger.js');
  for (const snippet of [
    "'/mini-program/ledger-items'",
    'onSearchChange',
    'loadLedger',
    'onReachBottom',
    'onPullDownRefresh',
    'openDetail',
  ]) {
    if (!listScript.includes(snippet)) {
      throw new Error(`pages/ledger/ledger.js must support list browsing: ${snippet}`);
    }
  }
  const listMarkup = read('pages/ledger/ledger.wxml');
  for (const snippet of ['filter-panel', 'i18n.ledgerSearchPlaceholder', 'resultCount', 't-empty']) {
    if (!listMarkup.includes(snippet)) {
      throw new Error(`pages/ledger/ledger.wxml must render search and results: ${snippet}`);
    }
  }
  if (!listScript.includes('/pages/ledger-detail/ledger-detail?id=')) {
    throw new Error('The ledger list must open the detail page by id.');
  }

  const detailScript = read('pages/ledger-detail/ledger-detail.js');
  for (const snippet of [
    '/mini-program/ledger-items/${id}',
    'invalidLedger',
    'previewImage',
    'retry',
  ]) {
    if (!detailScript.includes(snippet)) {
      throw new Error(`pages/ledger-detail/ledger-detail.js must support the detail view: ${snippet}`);
    }
  }
  const detailMarkup = read('pages/ledger-detail/ledger-detail.wxml');
  for (const snippet of ['i18n.ledgerInfo', 'i18n.ledgerTags', 'i18n.imageAttachments']) {
    if (!detailMarkup.includes(snippet)) {
      throw new Error(`pages/ledger-detail/ledger-detail.wxml must render: ${snippet}`);
    }
  }
  // 台账只有查看能力：列表页与详情页都不应出现写入口。
  for (const [file, markup] of [
    ['pages/ledger/ledger.wxml', listMarkup],
    ['pages/ledger-detail/ledger-detail.wxml', detailMarkup],
  ]) {
    if (markup.includes('t-fab')) {
      throw new Error(`${file} must stay read-only (no t-fab write entry).`);
    }
  }
}

// 每个请求（含重试与图片上传）都要带上当前项目，并在项目失效时重新解析后重试一次。
{
  const requestScript = read('utils/request.js');
  for (const snippet of [
    "const headers = withProjectHeader({",
    "const header = withProjectHeader({",
    "headers['X-Project-Id']",
    'recoverCurrentProject',
    '_projectRetried',
  ]) {
    if (!requestScript.includes(snippet)) {
      throw new Error(`utils/request.js must send and recover the current project: ${snippet}`);
    }
  }
}

// 用最小 wx 桩验证项目状态：id 存取、失效清理与弹窗展示用的项目对象缓存。
{
  const {
    CURRENT_PROJECT_CACHE_KEY,
    CURRENT_PROJECT_STORAGE_KEY,
    clearCurrentProject,
    getCurrentProject,
    getCurrentProjectId,
    setCurrentProjectId,
    switchProject,
    takeProjectSwitchNotice,
  } = require(path.join(root, 'utils/project.js'));
  if (CURRENT_PROJECT_STORAGE_KEY !== 'currentProjectId') {
    throw new Error('Mini Program current project must be stored under currentProjectId.');
  }
  const storage = new Map();
  global.wx = {
    getStorageSync: (key) => (storage.has(key) ? storage.get(key) : ''),
    setStorageSync: (key, value) => storage.set(key, value),
    removeStorageSync: (key) => storage.delete(key),
    reLaunch: (options) => storage.set('relaunch', options.url),
  };

  if (getCurrentProjectId() !== null) {
    throw new Error('Mini Program current project must start unset.');
  }
  if (setCurrentProjectId('7') !== 7 || getCurrentProjectId() !== 7) {
    throw new Error('Mini Program current project id must be persisted as a number.');
  }
  storage.set(CURRENT_PROJECT_CACHE_KEY, { id: 7, name: '默认项目', label: '默认项目' });
  if (!getCurrentProject() || getCurrentProject().name !== '默认项目') {
    throw new Error('Mini Program must show the cached current project.');
  }
  if (setCurrentProjectId(7) !== 7 || storage.has(CURRENT_PROJECT_CACHE_KEY)) {
    throw new Error('Switching the current project must drop the cached project object.');
  }
  if (setCurrentProjectId(0) !== null || getCurrentProjectId() !== 7) {
    throw new Error('Mini Program must reject invalid current project ids.');
  }
  clearCurrentProject();
  if (getCurrentProjectId() !== null || getCurrentProject() !== null) {
    throw new Error('Clearing the current project must drop the id and the cache.');
  }
  if (switchProject(6) !== 6 || storage.get('relaunch') !== '/pages/home/home') {
    throw new Error('Switching the current project must persist and restart the home page.');
  }
  if (!takeProjectSwitchNotice() || takeProjectSwitchNotice()) {
    throw new Error('The project switch notice must be consumed exactly once.');
  }
  delete global.wx;
}

/** 项目解析要等接口：请求层没有 wx.request 时必须返回 null 而不是抛错。 */
function checkProjectResolution() {
  const storage = new Map();
  global.wx = {
    getStorageSync: (key) => (storage.has(key) ? storage.get(key) : ''),
    setStorageSync: (key, value) => storage.set(key, value),
    removeStorageSync: (key) => storage.delete(key),
  };
  const { ensureProject } = require(path.join(root, 'utils/project.js'));
  const done = () => {
    delete global.wx;
  };
  return ensureProject().then(
    (projectId) => {
      done();
      if (projectId !== null) {
        throw new Error('Mini Program must not resolve a project when the API is unavailable.');
      }
    },
    (error) => {
      done();
      throw new Error(`Mini Program project resolution must never throw: ${error && error.message}`);
    },
  );
}

for (const page of pages) {
  const pageScript = read(`pages/${page}.js`);
  if (!pageScript.includes('Page(withTheme({')) {
    throw new Error(`pages/${page}.js must wrap its config with withTheme.`);
  }
  const markup = read(`pages/${page}.wxml`);
  const rootTag = markup.split('\n')[0];
  if (!rootTag.includes('class="page-shell') || !rootTag.includes('{{themeClass}}')) {
    throw new Error(`pages/${page}.wxml must bind the theme class on its root node.`);
  }
  if (/#[0-9a-fA-F]{3,8}\b|rgba?\(/.test(markup) || /color="#/.test(markup)) {
    throw new Error(`pages/${page}.wxml must not hardcode icon colors.`);
  }
}

const { extractMaterialUuid } = require(path.join(root, 'utils/material.js'));
const { resolveImageBaseUrl } = require(path.join(root, 'utils/inventory.js'));
const {
  LOCALE_ID_ID,
  LOCALE_ZH_CN,
  dictionaries,
  normalizeLocale,
  t,
} = require(path.join(root, 'utils/i18n.js'));
const expectedUuid = '10000000-0000-4000-8000-000000000001';
if (extractMaterialUuid('10000000000040008000000000000001') !== expectedUuid) {
  throw new Error('Mini Program scene must support compact material UUIDs.');
}
if (
  extractMaterialUuid('pages/outbound/outbound?scene=10000000000040008000000000000001') !==
  expectedUuid
) {
  throw new Error('Mini Program scanner must support unlimited code paths.');
}
if (normalizeLocale('id-ID') !== LOCALE_ID_ID || normalizeLocale('in_ID') !== LOCALE_ID_ID) {
  throw new Error('Mini Program must recognize Indonesian system locales.');
}
if (normalizeLocale('zh_CN') !== LOCALE_ZH_CN || normalizeLocale('en-US') !== LOCALE_ZH_CN) {
  throw new Error('Mini Program must fall back to Simplified Chinese.');
}
const localeKeys = Object.keys(dictionaries[LOCALE_ZH_CN]).sort();
if (
  JSON.stringify(localeKeys) !== JSON.stringify(Object.keys(dictionaries[LOCALE_ID_ID]).sort())
) {
  throw new Error('Mini Program locale dictionaries must contain the same keys.');
}
if (t('resultCount', { count: 3 }, LOCALE_ID_ID) !== '3 material') {
  throw new Error('Mini Program translations must support parameter interpolation.');
}
for (const key of ['appearanceTitle', 'themeModeAuto', 'themeModeLight', 'themeModeDark']) {
  if (!dictionaries[LOCALE_ZH_CN][key] || !dictionaries[LOCALE_ID_ID][key]) {
    throw new Error(`Mini Program appearance labels must be translated: ${key}`);
  }
}
// 项目选择器（t-picker）的取消 / 确认文案：不能沿用 TDesign 自带的 zh_CN 词典，
// 否则印尼语用户在微信里看到的是中文按钮。
for (const key of ['cancel', 'confirm']) {
  if (!dictionaries[LOCALE_ZH_CN][key] || !dictionaries[LOCALE_ID_ID][key]) {
    throw new Error(`Mini Program picker labels must be translated: ${key}`);
  }
}

const requestScript = read('utils/request.js');
if (!requestScript.includes("'Accept-Language': getLocale()")) {
  throw new Error('Mini Program API requests must declare the selected locale.');
}
if (
  resolveImageBaseUrl('https://images.example.com/') !==
  'https://images.example.com/api/v1/files/images'
) {
  throw new Error('Mini Program image acceleration server URL is invalid.');
}

for (const pageConfig of pageConfigs) {
  const components = Object.values(pageConfig.usingComponents || {});
  if (
    !components.length ||
    components.some(
      (component) =>
        !component.startsWith('tdesign-miniprogram/') && !component.startsWith('/components/'),
    )
  ) {
    throw new Error('Mini Program pages must use TDesign or shared local components.');
  }
}

for (const page of ['material-detail/material-detail', 'outbound/outbound']) {
  const markup = read(`pages/${page}.wxml`);
  if (!markup.includes('<material-summary-card')) {
    throw new Error(`${page} must reuse the shared material summary card.`);
  }
}

// 分享带参数：各列表页的转发链接必须带上当前搜索 / 筛选，且对方点开后按同一份条件取数。
{
  const share = require(path.join(root, 'utils/share.js'));
  // 编解码：中文与 & = # 必须编码；解码对已解码 / 裸 % 都要容错。
  const encoded = share.buildSharePath('/pages/ledger/ledger', { keyword: '熔断 & 芯=1#2' });
  if (!encoded.startsWith('/pages/ledger/ledger?keyword=') || encoded.includes('熔断')) {
    throw new Error('Share paths must percent-encode search keywords.');
  }
  if (share.readShareParams({ keyword: '熔断' }, ['keyword']).keyword !== '熔断') {
    throw new Error('Share params must tolerate already-decoded values.');
  }
  if (share.readShareParams({ keyword: '100%' }, ['keyword']).keyword !== '100%') {
    throw new Error('Share params must tolerate bare percent signs.');
  }
  if (share.buildSharePath('/pages/x/x', { keyword: '', a: null, b: undefined }) !== '/pages/x/x') {
    throw new Error('Empty share values must be omitted from the path.');
  }
  if (
    share.readShareParams({ keyword: 'a', redirect: '/pages/y' }, ['keyword']).redirect !== undefined
  ) {
    throw new Error('Share params must be filtered by the page whitelist.');
  }

  // 每个带搜索 / 筛选的列表页都必须：导入 share 工具、用 sharePath() 转发、回跳带参。
  // params 是该页分享参数白名单：筛选面板的每个分区 key 都必须在其中（否则转发后会丢筛选）。
  const shareablePages = [
    { page: 'inventory/inventory', params: ['keyword', 'stockStatus'] },
    { page: 'huaxing-inventory/huaxing-inventory', params: ['keyword', 'purchaseDepartment', 'purchaser'] },
    { page: 'material-codes/material-codes', params: ['keyword'] },
    { page: 'ledger/ledger', params: ['keyword'] },
    {
      page: 'purchase-plans/purchase-plans',
      params: ['keyword', 'actualDemandPerson', 'subitemNo', 'urgency', 'category'],
    },
    {
      page: 'purchase-records/purchase-records',
      params: ['keyword', 'status', 'subitemNo', 'category', 'salesperson', 'actualDemandPerson'],
    },
    { page: 'hazards/hazards', params: ['keyword', 'status', 'level', 'rectifyPerson', 'overdue'] },
  ];
  for (const { page, params } of shareablePages) {
    const script = read(`pages/${page}.js`);
    for (const snippet of [
      "require('../../utils/share')",
      'readShareParams(options, SHARE_PARAMS)',
      'path: this.sharePath()',
    ]) {
      if (!script.includes(snippet)) {
        throw new Error(`pages/${page}.js must share search/filter state: ${snippet}`);
      }
    }
    // 分享与回跳必须用同一份参数，否则未注册用户绑定后会丢掉筛选。
    if (!script.includes('buildRedirectQuery(buildSharePath(PAGE_ROUTE, shared))')) {
      throw new Error(`pages/${page}.js must keep share params across the bind redirect.`);
    }
    if (!script.includes('SHARE_PARAMS = [')) {
      throw new Error(`pages/${page}.js must declare its share param whitelist.`);
    }
    for (const param of params) {
      if (!script.includes(`'${param}'`)) {
        throw new Error(`pages/${page}.js must share the "${param}" filter.`);
      }
    }
  }

  // 分享值可能已不在候选项里：候选来自库中已有值的分区必须把缺失值补进选项（面板才能回显）；
  // 固定枚举分区（库存状态、隐患状态 / 等级、仅逾期）必须白名单校验后再采用。
  for (const page of [
    'huaxing-inventory/huaxing-inventory',
    'purchase-plans/purchase-plans',
    'purchase-records/purchase-records',
    'hazards/hazards',
    'ledger/ledger',
  ]) {
    const script = read(`pages/${page}.js`);
    // 补选项的写法可以是 buildSection（统一入口）或 section 内 splice（台账只有一维）。
    if (!script.includes('buildSection(') && !script.includes('options.splice(1, 0')) {
      throw new Error(`pages/${page}.js must append missing shared filter options.`);
    }
  }
  if (!read('pages/inventory/inventory.js').includes('isAllowedShareValue(shared.stockStatus')) {
    throw new Error('pages/inventory/inventory.js must validate the shared stock status enum.');
  }
  if (!read('pages/hazards/hazards.js').includes('isAllowedShareValue(shared[key]')) {
    throw new Error('pages/hazards/hazards.js must validate the shared status / level enums.');
  }
  if (!read('pages/inventory/inventory.js').includes('isAllowedShareValue(shared.stockStatus')) {
    throw new Error('pages/inventory/inventory.js must validate the shared stock status enum.');
  }
}

// 项目解析是异步的：放在最后，成功才打印通过，失败时报错并以非零码退出。
checkProjectResolution().then(
  () => console.log('Mini Program static structure check passed.'),
  (error) => {
    console.error(error.message);
    process.exit(1);
  },
);
