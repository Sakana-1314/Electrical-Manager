// 功能可见性：只看用户权限位（登录会话返回的 permissions），不再有全局运行模式配置。
// 二级库 Pro（物资 / 出入库）与二级库 Lite（Excel 导入台账）是两套独立权限，可单独授予，
// 同时持有时首页两个入口都展示、两套数据都能进（库存页按入口的 source 参数取对应数据源）。

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
 * 库存页数据源：Pro 与 Lite 共用同一个库存页，由入口的 `source` 参数决定走哪套数据。
 *
 * - `source=lite` / `source=pro`：对应入口只在该权限存在时展示，正常不会越权；
 *   权限被收回后旧链接仍能打开，此时退到另一套有权限的数据源（都没有就按原参数走，由后端 403）。
 * - 没带 `source`（历史分享链接 / 旧版本入口）：按权限兜底，有 Pro 用 Pro，否则用 Lite。
 *
 * @param {string} [source] 入口传入的数据源（`pro` / `lite`）
 * @returns {'pro'|'lite'}
 */
function resolveInventorySource(source) {
  if (source === 'lite') return hasLiteInventory() ? 'lite' : 'pro';
  if (source === 'pro') return hasStandardInventory() ? 'pro' : 'lite';
  return hasStandardInventory() ? 'pro' : 'lite';
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
  inventoryPro: 'warehouse:read',
  inventoryLite: 'lite:read',
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
  getPermissions,
  hasPermission,
  hasStandardInventory,
  hasLiteInventory,
  resolveInventorySource,
  entryEnabled,
  canOutbound,
  canManageStock,
  canWriteHazards,
};
