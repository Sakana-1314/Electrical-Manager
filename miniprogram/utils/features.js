const SECONDARY_WAREHOUSE_FULL = 'full';
const SECONDARY_WAREHOUSE_LITE = 'lite';

// 公开运行模式：只剩二级库完整 / 精简模式（管理端与小程序端共用）。
// 功能是否展示与可写不再有配置：统一按用户权限位判断（登录会话返回的 permissions）。
const DEFAULT_MODES = {
  secondary_warehouse_mode: SECONDARY_WAREHOUSE_FULL,
};

function getModes() {
  const app = getApp();
  return (app && app.globalData && app.globalData.runtimeModes) || DEFAULT_MODES;
}

/** 当前用户的权限位展开的权限键（登录会话返回，见后端 MiniProgramUserRead.permissions）。 */
function getPermissions() {
  const app = getApp();
  const user = app && app.globalData && app.globalData.user;
  return (user && user.permissions) || [];
}

/** 是否持有某权限键（如 warehouse:write）；无权限时功能入口 / 写操作不渲染。 */
function hasPermission(key) {
  return getPermissions().indexOf(key) !== -1;
}

// 二级库精简模式：独立表 + 只读，不支持出入库。
function isLiteMode() {
  return getModes().secondary_warehouse_mode === SECONDARY_WAREHOUSE_LITE;
}

// 出库（写操作）：非精简模式且用户持有二级库写权限位。
function canOutbound() {
  return !isLiteMode() && hasPermission('warehouse:write');
}

// 隐患登记 / 整改（写操作）：用户持有隐患写权限位。
function canWriteHazards() {
  return hasPermission('hazard:write');
}

/** 各功能入口对应的读权限键：入口是否展示只看权限位。 */
const ENTRY_PERMISSION = {
  inventory: 'warehouse:read',
  huaxing: 'huaxing:read',
  purchasePlans: 'purchase:read',
  purchaseRecords: 'purchase:read',
  ledger: 'ledger:read',
  hazards: 'hazard:read',
  materialCodes: 'purchase:read',
};

function entryEnabled(key) {
  return hasPermission(ENTRY_PERMISSION[key]);
}

module.exports = {
  SECONDARY_WAREHOUSE_FULL,
  SECONDARY_WAREHOUSE_LITE,
  DEFAULT_MODES,
  getModes,
  getPermissions,
  hasPermission,
  isLiteMode,
  entryEnabled,
  canOutbound,
  canWriteHazards,
};
