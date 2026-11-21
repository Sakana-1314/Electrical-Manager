const toastModule = require('tdesign-miniprogram/toast/index');
const { request } = require('../../utils/request');
const { imageUrl } = require('../../utils/inventory');
const { buildRedirectQuery } = require('../../utils/navigation');
const { getMessages, t } = require('../../utils/i18n');
const { purchaseStatusTheme } = require('../../utils/purchase');
const Toast = toastModule.default || toastModule;

/** 详情字段未填写时留空（不显示「未填写」占位）。 */
function present(value) {
  const text = String(value ?? '').trim();
  return text && !['\\', '/', '-', '—'].includes(text) ? text : '';
}

/** 日期标签：后端给 YYYY-MM-DD，页面统一显示 YYYY/MM/DD（与申购日期一致）；空值留空。 */
function dateLabel(value) {
  return String(value || '').trim().replace(/-/g, '/');
}

/** 单价标签：后端是 DECIMAL(18,2) 字符串；空值 / 非数值留空。 */
function priceLabel(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? `${parsed.toFixed(2)} 元` : '';
}

Page({
  data: {
    record: null,
    loading: true,
    failed: false,
    // 申购信息默认折叠「申购单号 / 需求部门 / 备注」三项，点标题右侧箭头展开全部。
    infoExpanded: false,
    i18n: getMessages(),
  },

  async onLoad(options) {
    this.recordId = Number(options.line_id || 0);
    try {
      const session = await getApp().globalData.authPromise;
      if (session.registration_disabled) return;
      if (session.requires_profile) {
        const redirect = buildRedirectQuery(
          `/pages/purchase-record-detail/purchase-record-detail?line_id=${this.recordId}`,
        );
        wx.reLaunch({ url: `/pages/bind/bind?redirect=${redirect}` });
        return;
      }
      await this.loadRecord(this.recordId);
    } catch (error) {
      this.setData({ loading: false, failed: true });
      this.showError(error);
    }
  },

  async loadRecord(id) {
    if (!Number.isInteger(id) || id <= 0) {
      this.setData({ loading: false, failed: true });
      this.showError(new Error(t('invalidPurchaseRecord')));
      return;
    }
    this.setData({ loading: true, failed: false });
    try {
      const result = await request({ url: `/mini-program/purchase-records/${id}` });
      const record = {
        ...result,
        plan_date_label: dateLabel(result.plan_date),
        purchase_date_label: dateLabel(result.purchase_date),
        quantity_label: `${result.purchase_qty} ${result.unit_name}`,
        purchase_order_no_label: present(result.purchase_order_no),
        material_code_label: present(result.material_code),
        material_code_copyable: Boolean(present(result.material_code)),
        demand_department_label: present(result.demand_department),
        actual_demand_person_label: present(result.actual_demand_person),
        usage_label: present(result.usage),
        salesperson_label: present(result.salesperson),
        remark_label: present(result.remark),
        trace_no_label: present(result.trace_no),
        subitem_no_label: present(result.subitem_no),
        // 采购与发运（同步脚本回写）：空值同样留空
        unit_price_label: priceLabel(result.unit_price),
        contract_no_label: present(result.contract_no),
        contract_sign_date_label: dateLabel(result.contract_sign_date),
        vessel_no_label: present(result.vessel_no),
        consolidation_date_label: dateLabel(result.consolidation_date),
        consolidation_port_label: present(result.consolidation_port),
        sailing_date_label: dateLabel(result.sailing_date),
        image_count_label: t('imageCount', { count: (result.images || []).length }),
        status_theme: purchaseStatusTheme(result.status),
        images: (result.images || []).map((image) => ({
          ...image,
          preview_url: imageUrl(image.id, 192),
          original_url: imageUrl(image.id),
        })),
      };
      this.recordId = id;
      this.setData({ record });
      wx.pageScrollTo({ scrollTop: 0, duration: 0 });
    } catch (error) {
      this.setData({ failed: true });
      this.showError(error);
    } finally {
      this.setData({ loading: false });
    }
  },

  /** 申购信息折叠/展开：默认收起申购单号、需求部门、备注三项。 */
  toggleInfo() {
    this.setData({ infoExpanded: !this.data.infoExpanded });
  },

  previewImage(event) {
    const urls = this.data.record.images.map((image) => image.original_url);
    wx.previewImage({ current: urls[event.currentTarget.dataset.index], urls });
  },

  copyMaterialCode(event) {
    const code = String(event.currentTarget.dataset.code || '').trim();
    if (!code) return;
    wx.setClipboardData({
      data: code,
      success: () => {
        Toast({
          context: this,
          selector: '#purchase-record-detail-toast',
          message: t('copied'),
          theme: 'success',
          direction: 'column',
        });
      },
    });
  },

  onShareAppMessage() {
    const record = this.data.record;
    return {
      title: record ? `${t('sharePurchaseRecord')} · ${record.material_name}` : t('sharePurchaseRecord'),
      path: `/pages/purchase-record-detail/purchase-record-detail?line_id=${this.recordId}`,
    };
  },

  retry() {
    void this.loadRecord(this.recordId);
  },

  showError(error) {
    Toast({
      context: this,
      selector: '#purchase-record-detail-toast',
      message: error.message || t('purchaseRecordDetailFailed'),
      theme: 'error',
      direction: 'column',
    });
  },
});
