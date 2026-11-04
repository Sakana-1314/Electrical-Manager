/**
 * 列表页筛选状态的小工具。
 *
 * 五个列表页（库存 / 华星 / 申购计划 / 申购记录 / 隐患）都维护同一形状的 `filters`：
 * key 与分享参数同名，空串表示不限。这里只放三件与取数无关的纯逻辑，避免每页各写一份：
 * - `normalizeFilters`：把面板回传的 values 归一成 `{ [key]: value }`（缺省补空串）；
 * - `hasActiveFilter`：是否有生效的筛选（空态文案与数量角标据此区分）；
 * - `sameFilters`：两次筛选是否等价（面板点「确定」但没改条件时不用重新请求）。
 */
function normalizeFilters(values, keys) {
  const out = {};
  keys.forEach((key) => {
    out[key] = (values && values[key]) || '';
  });
  return out;
}

function hasActiveFilter(filters, keys) {
  return keys.some((key) => !!(filters && filters[key]));
}

function sameFilters(current, next, keys) {
  return keys.every((key) => ((current && current[key]) || '') === ((next && next[key]) || ''));
}

module.exports = {
  hasActiveFilter,
  normalizeFilters,
  sameFilters,
};
