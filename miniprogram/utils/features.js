// 功能可见性：只看用户权限位（登录会话返回的 permissions），不再有全局运行模式配置。
// 二级库 Pro（物资 / 出入库）与二级库 Lite（Excel 导入台账）是两套独立权限，可单独授予。

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

/** 二级库 Pro（库存查询 / 扫码出库 / 出入库流水）。 */
function hasStandardInventory() {
  return hasPermission('warehouse:read');
}

/** 二级库 Lite（Excel 导入的只读台账）。 */
function hasLiteInventory() {
  return hasPermission('lite:read');
}

/**
 * 库存页数据源：两种二级库在小程序里共用同一个库存页。
 * 同时持有两种权限时优先展示二级库 Pro（有物资详情 / 出入库联动）；只有 Lite 权限才用 Lite 数据源。
 */
function inventoryUseLite() {
  return !hasStandardInventory() && hasLiteInventory();
}

// 出库（写操作）：用户持有二级库 Pro 写权限位。
function canOutbound() {
  return hasPermission('warehouse:write');
}

/** 二级库管理（物资档案增删改 / 扫码入库）：与出库同属二级库 Pro 写权限。 */
function canManageStock() {
  return hasPermission('warehouse:write');
}

// 隐患登记 / 整改（写操作）：用户持有隐患写权限位。
function canWriteHazards() {
  return hasPermission('hazard:write');
}

/** 各功能入口对应的读权限键：入口是否展示只看权限位。 */
const ENTRY_PERMISSION = {
  inventory: 'standard-or-lite',
  huaxing: 'huaxing:read',
  purchasePlans: 'purchase:read',
  purchaseRecords: 'purchase:read',
  ledger: 'ledger:read',
  hazards: 'hazard:read',
  materialCodes: 'purchase:read',
};

function entryEnabled(key) {
  const permission = ENTRY_PERMISSION[key];
  if (permission === 'standard-or-lite') return hasStandardInventory() || hasLiteInventory();
  return hasPermission(permission);
}

module.exports = {
  getPermissions,
  hasPermission,
  hasStandardInventory,
  hasLiteInventory,
  inventoryUseLite,
  entryEnabled,
  canOutbound,
  canManageStock,
  canWriteHazards,
};
