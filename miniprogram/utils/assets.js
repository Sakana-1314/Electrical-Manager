/**
 * 小程序静态资源：已不在代码包里，统一放到网页前端（EdgeOne Pages）按地址引用。
 *
 * - 资源文件放在仓库 `web/public/miniprogram/`，随网页前端一起发布；
 * - 网页前端域名固定为 `https://electrical.yangrucheng.top`（与 `APP_WEB_BASE_URL` 同源），
 *   需要把它加进小程序后台的 downloadFile / request 合法域名后才能离线外的环境稳定加载；
 * - 分享卡片 `imageUrl` 用网络地址时，微信要求域名可访问（https），这里统一拼接。
 */

const WEB_ORIGIN = 'https://electrical.yangrucheng.top';
const ASSETS_BASE = `${WEB_ORIGIN}/miniprogram`;

/** 拼网页前端上的静态资源地址（name 例如 `share-logo.png`）。 */
function assetUrl(name) {
  return `${ASSETS_BASE}/${String(name).replace(/^\/+/, '')}`;
}

/** 分享卡片图：首页与水印相机共用同一张。 */
function shareLogoUrl() {
  return assetUrl('share-logo.png');
}

module.exports = {
  ASSETS_BASE,
  WEB_ORIGIN,
  assetUrl,
  shareLogoUrl,
};
