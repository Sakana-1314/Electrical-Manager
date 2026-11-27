const { apiBaseUrl } = require('../config/api');
const { t } = require('./i18n');
const { formatDateTime } = require('./time');

// 库存状态 → t-tag 主题色。全局已统一为蓝色分级（见 app.wxss 语义变量）：
// success=中浅蓝（正常）、warning=主蓝（低库存）、danger=深蓝（无库存）。
const stockStatusMeta = {
  normal: { labelKey: 'normalStock', theme: 'success' },
  out_of_stock: { labelKey: 'outOfStock', theme: 'danger' },
  low_stock: { labelKey: 'lowStock', theme: 'warning' },
};

/**
 * 库存读模型 → 列表卡展示字段。
 *
 * first_inbound_label 是二级库 Pro 卡片左上角的「首次入库时间」（后端 first_inbound_at）；
 * 没有入库流水时为空串，卡片顶栏该格不渲染。Lite 条目没有该字段，不受影响。
 */
function decorateStock(item) {
  const meta = stockStatusMeta[item.stock_status] || stockStatusMeta.normal;
  return {
    ...item,
    stock_status_label: t(meta.labelKey),
    stock_status_theme: meta.theme,
    first_inbound_label: item.first_inbound_at ? formatDateTime(item.first_inbound_at) : '',
  };
}

function imageUrl(fileId, size) {
  const url = `${apiBaseUrl}/files/images/${fileId}`;
  return size ? `${url}?size=${size}` : url;
}

module.exports = {
  decorateStock,
  imageUrl,
};
