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

// 首页外观入口是一个下拉菜单：收起时显示当前档位，展开后列出三档。
{
  const homeScript = read('pages/home/home.js');
  for (const snippet of ['toggleAppearance', 'appearanceExpanded', 'onThemeModeChange']) {
    if (!homeScript.includes(snippet)) {
      throw new Error(`pages/home/home.js must wire the appearance dropdown: ${snippet}`);
    }
  }
  const homeMarkup = read('pages/home/home.wxml');
  for (const snippet of ['{{themeLabel}}', 'appearanceExpanded', 't-radio-group']) {
    if (!homeMarkup.includes(snippet)) {
      throw new Error(`pages/home/home.wxml must render the appearance dropdown: ${snippet}`);
    }
  }
  const homeConfig = JSON.parse(read('pages/home/home.json'));
  const components = Object.values(homeConfig.usingComponents || {});
  if (!components.includes('tdesign-miniprogram/radio-group/radio-group')) {
    throw new Error('pages/home/home.json must register t-radio-group for the appearance dropdown.');
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
    'projectPickerPopupProps',
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
    'popup-props="{{projectPickerPopupProps}}"',
    '<t-picker',
    '<t-picker-item',
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

// 列表页筛选下拉：展开面板收成与筛选栏同宽，不再铺满整屏（三个列表页共用 app.wxss 里的这条规则）。
{
  const block = styleBlock(appStyles, '.filter-menu .t-dropdown-item__popup-host');
  if (!block) {
    throw new Error('app.wxss must narrow the dropdown panel under .filter-menu.');
  }
  for (const declaration of ['left: 24rpx', 'right: 24rpx', 'width: auto']) {
    if (!block.includes(declaration)) {
      throw new Error(`The narrowed dropdown panel must declare "${declaration}".`);
    }
  }
  // 面板内缩值与圆角跟列表页的页面内边距、.filter-menu 圆角耦合：改页面内边距必须同步这条规则。
  for (const page of [
    'hazards/hazards',
    'purchase-plans/purchase-plans',
    'purchase-records/purchase-records',
  ]) {
    if (!read(`pages/${page}.wxml`).includes('class="filter-menu"')) {
      throw new Error(`pages/${page}.wxml must anchor the shared .filter-menu panel rule.`);
    }
    if (!read(`pages/${page}.wxss`).includes('.filter-menu')) {
      throw new Error(`pages/${page}.wxss must style .filter-menu.`);
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

// 项目解析是异步的：放在最后，成功才打印通过，失败时报错并以非零码退出。
checkProjectResolution().then(
  () => console.log('Mini Program static structure check passed.'),
  (error) => {
    console.error(error.message);
    process.exit(1);
  },
);
