const { extractMaterialUuid } = require('./material');

// 网页扫码登录的小程序码固定指向这个页面，scene 是去掉连字符的登录会话 UUID。
// 与物资码（pages/outbound/outbound，scene 是去掉连字符的物资 UUID）同为 32 位十六进制，
// 只看 scene 分不出来，必须先认页面路径。
const WEB_LOGIN_PAGE = 'pages/web-login/web-login';

/**
 * 从扫码结果里取网页登录会话 id。
 *
 * wx.scanCode 扫小程序码时 path 形如 "pages/web-login/web-login?scene=xxx"，
 * 部分基础库只在 result 里给同样的字符串；两处都按「页面路径 + scene 参数」解析。
 * @param {string} value scanResult.path / scanResult.result
 * @returns {string} 会话 id；不是登录码时返回空串。
 */
function extractWebLoginScene(value) {
  let source = String(value || '');
  try {
    source = decodeURIComponent(source);
  } catch (_error) {
    source = String(value || '');
  }
  if (source.toLowerCase().indexOf(WEB_LOGIN_PAGE) === -1) {
    return '';
  }
  const match = source.match(/[?&](?:scene|session)=([^&#\s]+)/i);
  return match ? match[1].trim() : '';
}

/**
 * 解析扫码结果，返回互斥的 { webLoginScene, materialUuid }。
 *
 * 登录码优先判定：它的 32 位十六进制 scene 可能正好满足紧凑 UUID 的版本位规则，
 * 若先跑物资解析，登录码会被误认成物资 UUID 而打开一个不存在的物资。
 * @param {{ path?: string, result?: string }} scanResult wx.scanCode 的返回
 */
function parseScanResult(scanResult = {}) {
  const path = String(scanResult.path || '');
  const result = String(scanResult.result || '');
  const webLoginScene = extractWebLoginScene(path) || extractWebLoginScene(result);
  if (webLoginScene) {
    return { webLoginScene, materialUuid: '' };
  }
  return { webLoginScene: '', materialUuid: extractMaterialUuid(path) || extractMaterialUuid(result) };
}

module.exports = {
  extractWebLoginScene,
  parseScanResult,
};
