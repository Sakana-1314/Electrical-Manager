// 接口地址解析：config/index.js 只配置域名（origin），/api/v1 前缀由这里统一追加。
// 已带路径的配置原样使用（兼容把完整接口前缀写进配置的旧写法），结尾斜杠统一去掉。
const { apiBaseUrl: configured } = require('./index');

function resolveApiBaseUrl(value) {
  const base = String(value || '').trim().replace(/\/+$/, '');
  if (!base) return '';
  return /^https?:\/\/[^/]+$/i.test(base) ? `${base}/api/v1` : base;
}

module.exports = {
  apiBaseUrl: resolveApiBaseUrl(configured),
  resolveApiBaseUrl,
};
