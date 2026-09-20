/**
 * 分享链接里的搜索与筛选参数。
 *
 * 列表页转发给同事时，把当前的搜索词与筛选值一并写进分享 path；对方点开分享卡片后
 * **已注册直接落到同一份筛选结果**，未注册则先走绑定页、注册完再由 redirect 回跳到同一份结果
 * （见 `buildRedirectQuery` 与绑定页的回跳逻辑）。
 *
 * 编解码约定：
 * - 写：`buildSharePath` 对每个值 `encodeURIComponent`，避免中文、`&`、`=`、`#` 破坏 query 结构。
 * - 读：小程序 `onLoad(options)` 的 query **不会自动解码**，所以 `readShareParams` 统一解码；
 *   同时对个别已解码 / 含裸 `%` 的值做防御性兜底（解码失败就按原样使用），不会抛错。
 */

/** 值是否值得写进分享链接：空串 / null / undefined 一律省略，保持链接干净。 */
function hasShareValue(value) {
  return value !== undefined && value !== null && String(value) !== '';
}

/**
 * 组装分享路径：过滤空值并逐项编码。
 * @param {string} route 形如 "/pages/ledger/ledger"
 * @param {Record<string, unknown>} [params] 搜索 / 筛选状态
 * @returns {string} 形如 "/pages/ledger/ledger?keyword=%E7%86%94%E6%96%AD"；无有效参数时返回 route
 */
function buildSharePath(route, params = {}) {
  const query = Object.keys(params)
    .filter((key) => hasShareValue(params[key]))
    .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(String(params[key]))}`)
    .join('&');
  return query ? `${route}?${query}` : route;
}

/** 防御性解码：已是明文（或含裸 `%`）时原样返回，不抛错。 */
function decodeShareValue(value) {
  const text = String(value);
  try {
    return decodeURIComponent(text);
  } catch (_error) {
    return text;
  }
}

/**
 * 从页面 `onLoad(options)` 取出分享参数（只认白名单 key，避免把 redirect 等参数写进状态）。
 * @param {Record<string, string>} [options] 页面 onLoad 的 options
 * @param {string[]} [keys] 该页支持的参数名
 * @returns {Record<string, string>} 只含实际出现且有值的参数
 */
function readShareParams(options = {}, keys = []) {
  const result = {};
  keys.forEach((key) => {
    const raw = options[key];
    if (!hasShareValue(raw)) return;
    result[key] = decodeShareValue(raw);
  });
  return result;
}

/**
 * 把分享带来的筛选值补进下拉选项。
 *
 * 分享链接里的值可能已经不在当前选项里（例如那个人名下已没有在途计划，筛选项里就没了他），
 * 此时 t-dropdown-item 找不到匹配项，会回落到默认的「全部××」文案——但列表其实仍在按该值过滤，
 * 界面与数据就对不上了。这里把缺失的值补成一项，保证「看到什么就是筛了什么」。
 *
 * @param {Array<{label: string, value: string}>} options 现有选项
 * @param {string} value 分享带来的筛选值（空串表示不限，直接返回原选项）
 * @returns {Array<{label: string, value: string}>} 补齐后的选项（不改动入参）
 */
function withSharedOption(options, value) {
  if (!hasShareValue(value)) return options;
  if (options.some((option) => option.value === value)) return options;
  return [{ label: value, value }, ...options];
}

/** 分享值是否落在允许集合内：页签 / 固定枚举这类不能凭空造选项，非法值直接忽略。 */
function isAllowedShareValue(value, allowed) {
  return allowed.indexOf(value) !== -1;
}

module.exports = {
  buildSharePath,
  decodeShareValue,
  isAllowedShareValue,
  readShareParams,
  withSharedOption,
};
