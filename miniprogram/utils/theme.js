const { t } = require('./i18n');

/**
 * 界面外观（自动 / 浅色 / 深色）。
 *
 * 约定：
 * - 默认 auto（跟随系统）：未做过选择时跟随系统深浅色，并在系统切换时实时生效。
 * - 用户显式选择 light / dark 后固定该档位，覆盖系统设置；档位存本机 storage，换设备各自独立，
 *   与网页端把外观记在浏览器本地（不落库、不产生请求）的语义一致。
 * - 解析结果以 `theme-dark` 类加在各页面根节点上：app.wxss 的 `page` 是浅色默认令牌，
 *   `.theme-dark` 覆盖同一批令牌，TDesign 组件的 `--td-*` 由两套作用域共用的桥接块跟随。
 * - 原生外观（导航栏、窗口底色）在 `theme.json` 里跟随系统；显式档与系统档不一致时由
 *   `wx.setNavigationBarColor` / `wx.setBackgroundColor` 运行时纠正。
 * - 无 wx 运行环境（静态检查脚本）时全部降级：读取返回默认档位，不抛错。
 */

const THEME_MODE_STORAGE_KEY = 'miniProgramThemeMode';
const THEME_MODE_DEFAULT = 'auto';
/** 可选档位，同时作为校验白名单：新增档位只改这里（分段控件选项与归一化都取自它）。 */
const THEME_MODE_OPTIONS = ['auto', 'light', 'dark'];
/** 深色作用域类名；浅色沿用 page 上的默认令牌，不需要额外类名。 */
const THEME_DARK_CLASS = 'theme-dark';
const THEME_LIGHT = 'light';
const THEME_DARK = 'dark';

const THEME_LABEL_KEYS = {
  auto: 'themeModeAuto',
  light: 'themeModeLight',
  dark: 'themeModeDark',
};

/** 导航栏配色：frontColor 仅支持 #ffffff / #000000（微信客户端限制）。 */
const NAV_THEME = {
  [THEME_LIGHT]: { frontColor: '#000000', backgroundColor: '#ffffff' },
  [THEME_DARK]: { frontColor: '#ffffff', backgroundColor: '#191e26' },
};

/** 窗口（下拉、回弹区域）底色，与 theme.json 的 bgColor 保持一致。 */
const WINDOW_BACKGROUND = {
  [THEME_LIGHT]: '#f4f6fa',
  [THEME_DARK]: '#13171d',
};

/** 已绑定主题变化的页面集合：仅注册一个 wx.onThemeChange，广播给全部存活页面。 */
const themeSubscribers = new Set();
let themeListenerBound = false;

function hasWx() {
  return typeof wx !== 'undefined' && wx;
}

/** 归一化为合法档位：未知 / 空值一律回落默认 auto。 */
function normalizeThemeMode(value) {
  return THEME_MODE_OPTIONS.includes(value) ? value : THEME_MODE_DEFAULT;
}

/** 系统当前主题；未开启 darkmode 或接口不可用时返回 light。 */
function getSystemTheme() {
  if (!hasWx()) return THEME_LIGHT;
  let theme;
  try {
    if (typeof wx.getAppBaseInfo === 'function') {
      theme = wx.getAppBaseInfo().theme;
    }
    if (!theme && typeof wx.getSystemInfoSync === 'function') {
      theme = wx.getSystemInfoSync().theme;
    }
  } catch (_error) {
    return THEME_LIGHT;
  }
  return theme === THEME_DARK ? THEME_DARK : THEME_LIGHT;
}

/** 读取本机外观偏好（未写入 / 值非法 / 存储不可用时返回默认 auto）。 */
function readThemeMode() {
  if (!hasWx() || typeof wx.getStorageSync !== 'function') return THEME_MODE_DEFAULT;
  try {
    return normalizeThemeMode(wx.getStorageSync(THEME_MODE_STORAGE_KEY));
  } catch (_error) {
    return THEME_MODE_DEFAULT;
  }
}

/** 写入本机外观偏好；存储不可用时静默失败，仅本次会话生效。返回归一化后的档位。 */
function writeThemeMode(value) {
  const mode = normalizeThemeMode(value);
  if (!hasWx() || typeof wx.setStorageSync !== 'function') return mode;
  try {
    wx.setStorageSync(THEME_MODE_STORAGE_KEY, mode);
  } catch (_error) {
    // 存储不可用（配额满 / 受限）：忽略写入失败，档位仍对当前会话生效。
  }
  return mode;
}

/** 按档位与系统主题解析出实际外观（纯函数，便于静态检查断言）。 */
function resolveTheme(mode = readThemeMode(), systemTheme = getSystemTheme()) {
  const normalized = normalizeThemeMode(mode);
  const theme = normalized === 'auto' ? normalizeTheme(systemTheme) : normalized;
  return {
    mode: normalized,
    theme,
    themeClass: theme === THEME_DARK ? THEME_DARK_CLASS : '',
  };
}

function normalizeTheme(value) {
  return value === THEME_DARK ? THEME_DARK : THEME_LIGHT;
}

/** 页面 data 的主题字段：同步解析，保证首屏渲染就是正确的档位（不闪白）。 */
function themePageData() {
  const { mode, theme, themeClass } = resolveTheme();
  return { themeMode: mode, theme, themeClass };
}

/** 分段控件选项（文案走 i18n，与全站语言一致）。 */
function getAppearanceOptions() {
  return THEME_MODE_OPTIONS.map((value) => ({ value, label: t(THEME_LABEL_KEYS[value]) }));
}

/** 同步原生外观（导航栏 / 窗口底色）；调用失败不阻塞渲染。 */
function applyNativeTheme(theme) {
  if (!hasWx()) return;
  const nav = NAV_THEME[theme] || NAV_THEME[THEME_LIGHT];
  const backgroundColor = WINDOW_BACKGROUND[theme] || WINDOW_BACKGROUND[THEME_LIGHT];
  try {
    if (typeof wx.setNavigationBarColor === 'function') {
      wx.setNavigationBarColor({ ...nav });
    }
  } catch (_error) {
    // 页面尚未就绪等场景：忽略，下一次 onShow 会再试。
  }
  try {
    if (typeof wx.setBackgroundColor === 'function') {
      wx.setBackgroundColor({
        backgroundColor,
        backgroundColorTop: backgroundColor,
        backgroundColorBottom: backgroundColor,
      });
    }
  } catch (_error) {
    // 同导航栏：失败静默，样式本身已由类作用域保证。
  }
}

/** 把当前解析结果同步到页面 data 与原生外观；字段无变化时不触发 setData。 */
function applyThemeToPage(page) {
  if (!page || typeof page.setData !== 'function') return resolveTheme();
  const data = page.data || {};
  const resolved = resolveTheme();
  const patch = {};
  if (data.themeMode !== resolved.mode) patch.themeMode = resolved.mode;
  if (data.theme !== resolved.theme) patch.theme = resolved.theme;
  if (data.themeClass !== resolved.themeClass) patch.themeClass = resolved.themeClass;
  if (Object.keys(patch).length) page.setData(patch);
  applyNativeTheme(resolved.theme);
  return resolved;
}

function handleSystemThemeChange() {
  themeSubscribers.forEach((page) => applyThemeToPage(page));
}

function bindThemeChange(page) {
  if (!page) return;
  themeSubscribers.add(page);
  if (themeListenerBound || !hasWx() || typeof wx.onThemeChange !== 'function') return;
  themeListenerBound = true;
  wx.onThemeChange(handleSystemThemeChange);
}

function unbindThemeChange(page) {
  themeSubscribers.delete(page);
}

/** 首页弹窗切换档位：写入本机偏好并立即应用到当前页面。 */
function setThemeMode(page, value) {
  const mode = writeThemeMode(value);
  applyThemeToPage(page);
  return mode;
}

/**
 * 页面配置包装：注入主题字段与生命周期接线，页面只写 `Page(withTheme({ ... }))`。
 *
 * - data：先放主题字段，页面自有 data 优先（同名键不会被主题覆盖）。
 * - onLoad：先执行页面原逻辑（含 setNavigationBarTitle），再应用主题。
 * - onShow：先执行页面原逻辑，再绑定系统主题变化（返回页面时也会重新校正档位与原生外观）。
 * - onUnload：先解绑，再执行页面原逻辑。
 */
function withTheme(config) {
  const { data, onLoad, onShow, onUnload, ...rest } = config;
  return {
    ...rest,
    data: { ...themePageData(), ...data },
    onLoad(options) {
      if (typeof onLoad === 'function') onLoad.call(this, options);
      applyThemeToPage(this);
    },
    onShow() {
      if (typeof onShow === 'function') onShow.call(this);
      bindThemeChange(this);
    },
    onUnload() {
      unbindThemeChange(this);
      if (typeof onUnload === 'function') onUnload.call(this);
    },
  };
}

module.exports = {
  THEME_DARK_CLASS,
  THEME_MODE_DEFAULT,
  THEME_MODE_OPTIONS,
  THEME_MODE_STORAGE_KEY,
  applyThemeToPage,
  getAppearanceOptions,
  getSystemTheme,
  normalizeThemeMode,
  readThemeMode,
  resolveTheme,
  setThemeMode,
  themePageData,
  withTheme,
  writeThemeMode,
};
