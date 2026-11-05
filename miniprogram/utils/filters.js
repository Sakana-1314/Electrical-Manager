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
 * 分字段条件 → 请求参数。
 * 条件形如 `[{ field, value }]`，`fields` 声明每个字段落到哪个请求参数上；
 * 未声明的字段直接忽略（防止界面新增字段后把未知参数发给后端）。
 */
function buildFieldQuery(conditions, fields) {
  const query = {};
  (conditions || []).forEach((condition) => {
    const field = (fields || []).find((item) => item.value === condition.field);
    if (!field || !field.param || !condition.value) return;
    query[field.param] = condition.value;
  });
  return query;
}

/** 收起态搜索框：综合搜索走 keyword，选了字段则走该字段的参数。 */
function buildSearchQuery(keyword, searchField, fields) {
  const value = String(keyword || '').trim();
  if (!value) return {};
  const field = (fields || []).find((item) => item.value === searchField);
  if (!field || !field.param) return { keyword: value };
  return { [field.param]: value };
}

/**
 * 筛选状态 → 分享参数。
 * 数组用换行分隔（`|` 是后端的「任一」分隔符，分享值里用它会歧义），区间写 from / to 两个键。
 */
function buildFilterShare(filters, conditions, spec) {
  const params = {};
  Object.keys(spec || {}).forEach((key) => {
    const rule = spec[key];
    const value = filters && filters[key];
    if (!hasValue(value)) return;
    if (rule.kind === 'multi') {
      params[rule.param] = value.join('|');
      return;
    }
    if (rule.kind === 'range' || rule.kind === 'dateRange') {
      if (value.from) params[rule.fromParam] = value.from;
      if (value.to) params[rule.toParam] = value.to;
      return;
    }
    params[rule.param] = value;
  });
  (conditions || []).forEach((condition) => {
    const field = (spec && spec.__fields ? spec.__fields : []).find((item) => item.value === condition.field);
    if (field && field.param && condition.value) params[field.param] = condition.value;
  });
  return params;
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
  buildFilterQuery,
  buildFilterShare,
  buildSearchQuery,
  hasActiveFilter,
  hasValue,
  normalizeFilters,
  readFilterShare,
  sameFilters,
};
