/**
 * 水印相机本机设置：常用词、置顶常用词与「默认启用」的水印项目。
 *
 * 全部设置只存本机 storage（不落服务端、不进仓库），因为水印是纯现场拍摄偏好，
 * 换设备重新配一次即可。读写都做归一：损坏或旧版本残留的数据一律回落到默认值，
 * 不让页面因为一条脏数据打不开。
 */

/** 常用词 / 置顶 / 开关值都放在这一个 key 里，避免多处 storage 不同步。 */
const SETTINGS_STORAGE_KEY = 'watermarkSettings';

/** 水印项目：时间 / 日期 / 星期 / 地点 / 文案，顺序即弹层里的排列顺序。 */
const WATERMARK_FIELDS = [
  { key: 'time', defaultEnabled: true },
  { key: 'date', defaultEnabled: true },
  { key: 'week', defaultEnabled: true },
  { key: 'location', defaultEnabled: true },
  { key: 'matter', defaultEnabled: true },
];

const FIELD_KEYS = WATERMARK_FIELDS.map((field) => field.key);
const WORD_MAX = 20;
const WORDS_MAX = 30;

function defaultFieldEnabled() {
  return WATERMARK_FIELDS.reduce((result, field) => {
    result[field.key] = field.defaultEnabled;
    return result;
  }, {});
}

function emptySettings() {
  return {
    words: [],
    pinned: [],
    fields: defaultFieldEnabled(),
  };
}

/** 常用词归一：去掉首尾空白、非字符串、空串与超长项，并保持原顺序去重。 */
function normalizeWords(raw) {
  if (!Array.isArray(raw)) return [];
  const seen = new Set();
  const words = [];
  raw.forEach((item) => {
    const word = typeof item === 'string' ? item.trim() : '';
    if (!word || word.length > WORD_MAX || seen.has(word)) return;
    seen.add(word);
    words.push(word);
  });
  return words.slice(0, WORDS_MAX);
}

/** 置顶归一到「确实存在的常用词」：置顶列表只留常用词里有的，顺序照置顶列表。 */
function normalizePinned(raw, words) {
  if (!Array.isArray(raw)) return [];
  const available = new Set(words);
  const seen = new Set();
  return raw.filter((item) => {
    const word = typeof item === 'string' ? item.trim() : '';
    if (!available.has(word) || seen.has(word)) return false;
    seen.add(word);
    return true;
  });
}

/** 水印项目开关归一：缺项按默认值补齐，非布尔值也按默认值处理。 */
function normalizeFields(raw) {
  const fields = defaultFieldEnabled();
  if (!raw || typeof raw !== 'object') return fields;
  FIELD_KEYS.forEach((key) => {
    if (typeof raw[key] === 'boolean') fields[key] = raw[key];
  });
  return fields;
}

/** 读设置：任何异常都回落到默认值，页面不会因为 storage 脏数据报错。 */
function readSettings() {
  let raw = null;
  try {
    raw = wx.getStorageSync(SETTINGS_STORAGE_KEY);
  } catch (_error) {
    return emptySettings();
  }
  if (!raw || typeof raw !== 'object') return emptySettings();
  const words = normalizeWords(raw.words);
  return {
    words,
    pinned: normalizePinned(raw.pinned, words),
    fields: normalizeFields(raw.fields),
  };
}

function writeSettings(settings) {
  const words = normalizeWords(settings.words);
  const normalized = {
    words,
    pinned: normalizePinned(settings.pinned, words),
    fields: normalizeFields(settings.fields),
  };
  try {
    wx.setStorageSync(SETTINGS_STORAGE_KEY, normalized);
  } catch (error) {
    console.error('保存水印设置失败', error);
  }
  return normalized;
}

/**
 * 常用词按「置顶在前、其余按原顺序」排列，供拍摄页的常用词条直接使用。
 * 置顶的词同时从后面移除，不会重复出现。
 */
function orderedWords(settings) {
  const pinned = normalizePinned(settings.pinned, settings.words);
  const pinnedSet = new Set(pinned);
  return pinned.concat(settings.words.filter((word) => !pinnedSet.has(word)));
}

/** 水印项目的可选项（设置页按这个顺序渲染开关）。 */
const FIELD_OPTIONS = WATERMARK_FIELDS.map((field) => field.key);

module.exports = {
  FIELD_KEYS,
  SETTINGS_STORAGE_KEY,
  WORD_MAX,
  WORDS_MAX,
  defaultFieldEnabled,
  normalizeFields,
  normalizePinned,
  normalizeWords,
  orderedWords,
  readSettings,
  writeSettings,
};
