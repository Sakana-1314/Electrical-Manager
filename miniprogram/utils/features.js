const MODE_DISABLED = 'disabled';
const MODE_QUERY_ONLY = 'query_only';
const MODE_READ_WRITE = 'read_write';
const SECONDARY_WAREHOUSE_FULL = 'full';
const SECONDARY_WAREHOUSE_LITE = 'lite';

// 拉取失败或尚未加载时的兜底：等价于现状全开放（库存可出库、其余只读可进）。
const DEFAULT_MODES = {
  inventory_mode: MODE_READ_WRITE,
  huaxing_inventory_mode: MODE_QUERY_ONLY,
  purchase_plans_mode: MODE_QUERY_ONLY,
  purchase_records_mode: MODE_QUERY_ONLY,
  material_codes_mode: MODE_QUERY_ONLY,
  ledger_mode: MODE_QUERY_ONLY,
  hazards_mode: MODE_READ_WRITE,
  secondary_warehouse_mode: SECONDARY_WAREHOUSE_FULL,
};

function getModes() {
  const app = getApp();
  return (app && app.globalData && app.globalData.featureModes) || DEFAULT_MODES;
}

/** 当前用户的权限并集（登录会话返回，见后端 MiniProgramUserRead.permissions）。 */
function getPermissions() {
  const app = getApp();
  const user = app && app.globalData && app.globalData.user;
  return (user && user.permissions) || [];
}

/** 是否持有某权限键（如 warehouse:write）；无权限时功能入口 / 写操作不渲染。 */
function hasPermission(key) {
  return getPermissions().indexOf(key) !== -1;
}

function isFeatureDisabled(key) {
  return getModes()[key] === MODE_DISABLED;
}

// 二级库精简模式：独立表 + 只读，不支持出入库。
function isLiteMode() {
  return getModes().secondary_warehouse_mode === SECONDARY_WAREHOUSE_LITE;
}

// 出库（写操作）：全局开关允许 + 用户持有二级库写权限。
function canOutbound() {
  return !isLiteMode() && getModes().inventory_mode === MODE_READ_WRITE && hasPermission('warehouse:write');
}

// 隐患登记 / 整改（写操作）：全局开关允许 + 用户持有隐患写权限。
function canWriteHazards() {
  return getModes().hazards_mode === MODE_READ_WRITE && hasPermission('hazard:write');
}

/** 各功能入口对应的读权限键：全局开关之外，再按用户权限过滤入口。 */
const ENTRY_PERMISSION = {
  inventory: 'warehouse:read',
  huaxing: 'huaxing:read',
  purchasePlans: 'purchase:read',
  purchaseRecords: 'purchase:read',
  ledger: 'ledger:read',
  hazards: 'hazard:read',
  materialCodes: 'codes:read',
};

function entryEnabled(key) {
  return !isFeatureDisabled(key) && hasPermission(ENTRY_PERMISSION[key]);
}

module.exports = {
  MODE_DISABLED,
  MODE_QUERY_ONLY,
  MODE_READ_WRITE,
  SECONDARY_WAREHOUSE_FULL,
  SECONDARY_WAREHOUSE_LITE,
  DEFAULT_MODES,
  getModes,
  getPermissions,
  hasPermission,
  isFeatureDisabled,
  isLiteMode,
  entryEnabled,
  canOutbound,
  canWriteHazards,
};
