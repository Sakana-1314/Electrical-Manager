/**
 * 列表页筛选状态的小工具。
 *
 * 五个列表页（库存 / 华星 / 申购计划 / 申购记录 / 隐患）都维护同一形状的 `filters`：
 * key 与分享参数同名，值可能是单值字符串、多值数组（多选分区）或 `{ from, to }`（区间）。
 * 这里放与取数无关的纯逻辑，避免每页各写一份。
 */

/** 值是否算「已填」：空串、空数组、空的区间对象都算没填。 */
function hasValue(value) {
  if (value === undefined || value === null) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return !!(value.from || value.to);
  return String(value) !== '';
}

/** 把面板回传的 values 归一成 `{ [key]: value }`（缺省补空串，多选补空数组）。 */
function normalizeFilters(values, keys, multiKeys = [], rangeKeys = []) {
  const out = {};
  keys.forEach((key) => {
    const value = values && values[key];
    if (multiKeys.indexOf(key) >= 0) {
      out[key] = Array.isArray(value) ? value.slice() : [];
    } else if (rangeKeys.indexOf(key) >= 0) {
      out[key] = value && (value.from || value.to) ? { from: value.from || '', to: value.to || '' } : { from: '', to: '' };
    } else {
      out[key] = value || '';
    }
  });
  return out;
}

function hasActiveFilter(filters, keys) {
  return keys.some((key) => hasValue(filters && filters[key]));
}

/** 两次筛选是否等价（面板点「确定」但没改条件时不重复请求）。 */
function sameFilters(current, next, keys) {
  return keys.every((key) => JSON.stringify(normalizeComparable(current && current[key])) ===
    JSON.stringify(normalizeComparable(next && next[key])));
}

function normalizeComparable(value) {
  if (Array.isArray(value)) return value.slice().sort();
  if (value && typeof value === 'object') return { from: value.from || '', to: value.to || '' };
  return value || '';
}

/** 筛选值 → 请求参数：数组用 | 连接（后端按「任一」匹配），区间拆成 from / to 两个参数。 */
function buildFilterQuery(filters, spec) {
  const query = {};
  Object.keys(spec || {}).forEach((key) => {
    const rule = spec[key];
    const value = filters && filters[key];
    if (!hasValue(value)) return;
    if (rule.kind === 'multi') {
      query[rule.param] = value.join('|');
      return;
    }
    if (rule.kind === 'range' || rule.kind === 'dateRange') {
      if (value.from) query[rule.fromParam] = value.from;
      if (value.to) query[rule.toParam] = value.to;
      return;
    }
    query[rule.param] = value;
  });
  return query;
}

/**
 * 分字段搜索条件 → 请求参数（多字段组合，AND）。
 *
 * 条件形如 `{ name: '接触器', modelSpec: 'CJX2' }`（key 是字段定义的 `key`），
 * `fields` 声明每个字段落到哪个请求参数上；只发填了值的字段，未声明的字段直接忽略
 * （防止界面新增字段后把未知参数发给后端）。多个字段同时填 = 同时满足，与网页端一致。
 */
function buildFieldQuery(fieldValues, fields) {
  const query = {};
  fields.forEach((field) => {
    if (!field.param) return;
    const value = fieldValues && fieldValues[field.key];
    const text = String(value === undefined || value === null ? '' : value).trim();
    if (!text) return;
    query[field.param] = text;
  });
  return query;
}

/** 分字段条件里是否有生效的字段（用于空态文案与数量角标）。 */
function countFieldValues(fieldValues, fields) {
  return fields.filter((field) => {
    if (!field.param) return false;
    const value = fieldValues && fieldValues[field.key];
    return String(value === undefined || value === null ? '' : value).trim() !== '';
  }).length;
}

/**
 * 收起态搜索框：只做「综合搜索」（跨字段 OR）。
 *
 * 多字段组合搜索走面板里的分字段输入框——那里的每个字段都显式可见，
 * 不像搜索框切字段那样「看起来像多字段、实际只有一个生效」。
 */
function buildSearchQuery(keyword) {
  const value = String(keyword || '').trim();
  return value ? { keyword: value } : {};
}

/**
 * 分字段条件 → 分享参数：只写填了值的字段，key 用字段的 value（与页面 SHARE_PARAMS 对应）。
 */
function buildFieldShare(fieldValues, fields) {
  const params = {};
  fields.forEach((field) => {
    if (!field.param) return;
    const value = fieldValues && fieldValues[field.key];
    const text = String(value === undefined || value === null ? '' : value).trim();
    if (text) params[field.key] = text;
  });
  return params;
}

/**
 * 分享参数 → 分字段条件（只回填声明过的字段）。
 * 反向用：字段在分享里以字段名（如 `name`）出现，读回来还原成 `{ name: '接触器' }`。
 */
function readFieldShare(shared, fields) {
  const values = {};
  fields.forEach((field) => {
    if (!field.param) return;
    const value = shared && shared[field.key];
    if (value !== undefined && value !== null && String(value) !== '') values[field.key] = String(value);
  });
  return values;
}

/** 分享参数 → 筛选状态（只回填声明过的键）。 */
function readFilterShare(shared, keys) {
  const filters = {};
  (keys || []).forEach((key) => {
    if (shared && shared[key] !== undefined) filters[key] = shared[key];
  });
  return filters;
}

module.exports = {
  buildFieldQuery,
  buildFieldShare,
  buildFilterQuery,
  buildSearchQuery,
  countFieldValues,
  hasActiveFilter,
  hasValue,
  normalizeFilters,
  readFieldShare,
  readFilterShare,
  sameFilters,
};
