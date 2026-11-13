const { t } = require('./i18n')

/** 申购记录状态色：列表与详情共用同一套映射，避免两处各自维护。 */
function purchaseStatusTheme(status) {
  if (status === '已入库') return 'success'
  if (status === '部分入库') return 'warning'
  if (status === '已采购') return 'primary'
  return 'default'
}

/** 申购记录列表 / 「该物料的申购记录」页共用的展示字段。 */
function decoratePurchaseRecord(item) {
  return {
    ...item,
    plan_date_label: String(item.plan_date || '').replace(/-/g, '/'),
    purchase_date_label: String(item.purchase_date || '').replace(/-/g, '/'),
    // 数量与单位拆开存：卡片数值用主色大字、单位做小字后缀（与其它列表页同一形态）。
    quantity: item.purchase_qty != null ? String(item.purchase_qty) : '',
    quantity_unit: item.unit_name || '',
    purchase_order_no_label: item.purchase_order_no || t('notSet'),
    status_theme: purchaseStatusTheme(item.status),
  }
}

module.exports = { decoratePurchaseRecord, purchaseStatusTheme }
