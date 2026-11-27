const toastModule = require('tdesign-miniprogram/toast/index');
const { request } = require('../../../../utils/request');
const { buildRedirectQuery } = require('../../../../utils/navigation');
const { createClientRequestId, extractMaterialUuid } = require('../../../../utils/material');
const { hasPermission } = require('../../../../utils/features');
const { getMessages, t } = require('../../../../utils/i18n');
const Toast = toastModule.default || toastModule;

Page({
  data: {
    loading: true,
    submitting: false,
    scanning: false,
    canWrite: false,
    // 已选物资：扫码或从物资档案列表带入；未选时先选物资再填数量。
    material: null,
    result: null,
    form: {
      quantity: '1',
      businessReason: '',
    },
    i18n: getMessages(),
  },

  async onLoad(options = {}) {
    const materialUuid = extractMaterialUuid(options.uuid) || extractMaterialUuid(options.scene);
    this.clientRequestId = '';
    try {
      const app = getApp();
      const session = await app.globalData.authPromise;
      if (session.registration_disabled) return;
      if (session.requires_profile) {
        const redirect = buildRedirectQuery(
          materialUuid
            ? `/packages/warehouse/pages/stock-inbound/stock-inbound?uuid=${materialUuid}`
            : '/packages/warehouse/pages/stock-inbound/stock-inbound',
        );
        wx.reLaunch({ url: `/pages/bind/bind?redirect=${redirect}` });
        return;
      }
      const canWrite = hasPermission('warehouse:write');
      this.setData({ canWrite });
      if (!canWrite) {
        this.showError(new Error(t('stockNoPermission')));
        return;
      }
      if (materialUuid) await this.loadMaterial(materialUuid);
    } catch (error) {
      this.showError(error);
    } finally {
      this.setData({ loading: false });
    }
  },

  async loadMaterial(materialUuid) {
    const material = await request({ url: `/mini-program/materials/${materialUuid}` });
    this.setData({ material, 'form.quantity': '1', result: null });
  },

  async scanMaterial() {
    this.setData({ scanning: true });
    try {
      const scanResult = await new Promise((resolve, reject) => {
        wx.scanCode({ success: resolve, fail: reject });
      });
      const materialUuid = extractMaterialUuid(scanResult.path || scanResult.result);
      if (!materialUuid) throw new Error(t('materialUuidMissing'));
      await this.loadMaterial(materialUuid);
    } catch (error) {
      if (!String(error.errMsg || '').includes('cancel')) this.showError(error);
    } finally {
      this.setData({ scanning: false });
    }
  },

  /** 未扫码时从物资档案列表挑一条（复用同一分页接口，按关键词搜）。 */
  async chooseMaterial() {
    try {
      const result = await request({
        url: '/mini-program/stock-materials',
        data: { page: 1, page_size: 20 },
      });
      const items = result.items || [];
      if (!items.length) {
        this.showError(new Error(t('stockMaterialEmpty')));
        return;
      }
      const picked = await new Promise((resolve) => {
        wx.showActionSheet({
          itemList: items.slice(0, 10).map((item) => `${item.name}（${item.model_spec}）`),
          success: (res) => resolve(items[res.tapIndex]),
          fail: () => resolve(null),
        });
      });
      if (picked) await this.loadMaterial(picked.uuid);
    } catch (error) {
      this.showError(error);
    }
  },

  onFieldChange(event) {
    const { field } = event.currentTarget.dataset;
    this.setData({ [`form.${field}`]: event.detail.value });
  },

  validateForm() {
    if (!this.data.material) return t('stockChooseMaterial');
    const quantity = Number(this.data.form.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) return t('invalidQuantity');
    return '';
  },

  async submit() {
    const validationMessage = this.validateForm();
    if (validationMessage) {
      this.showError(new Error(validationMessage));
      return;
    }
    if (this.data.submitting) return;
    const { material, form } = this.data;
    const quantity = form.quantity.trim();
    const businessReason = form.businessReason.trim();
    const confirmed = await new Promise((resolve) => {
      wx.showModal({
        title: t('stockInboundConfirmTitle'),
        content: t('stockInboundConfirmContent', {
          name: material.name,
          spec: material.model_spec || '-',
          quantity,
          unit: material.unit_name || '',
        }),
        confirmText: t('confirm'),
        cancelText: t('cancel'),
        success: (res) => resolve(!!res.confirm),
        fail: () => resolve(false),
      });
    });
    if (!confirmed) return;
    // 幂等键跟着单据内容走：内容不变（含超时重试）沿用同一个键，服务端不会重复入库。
    const fingerprint = [material.uuid, quantity, businessReason].join('|');
    if (!this.clientRequestId || this.submitFingerprint !== fingerprint) {
      this.submitFingerprint = fingerprint;
      this.clientRequestId = createClientRequestId();
    }
    this.setData({ submitting: true });
    try {
      const result = await request({
        url: '/mini-program/inbound',
        method: 'POST',
        retry: true,
        data: {
          client_request_id: this.clientRequestId,
          material_uuid: material.uuid,
          occurred_at: new Date().toISOString(),
          quantity,
          business_reason: businessReason,
        },
      });
      this.submitFingerprint = '';
      this.clientRequestId = '';
      this.setData({ result, material: { ...material, current_qty: result.after_qty } });
      Toast({
        context: this,
        selector: '#stock-inbound-toast',
        message: t('stockInboundSuccess', {
          quantity: result.after_qty,
          unit: result.unit_name || '',
        }),
        theme: 'success',
        direction: 'column',
      });
    } catch (error) {
      this.showError(error);
    } finally {
      this.setData({ submitting: false });
    }
  },

  resetForm() {
    this.setData({ material: null, result: null, form: { quantity: '1', businessReason: '' } });
  },

  showError(error) {
    Toast({
      context: this,
      selector: '#stock-inbound-toast',
      message: (error && error.message) || t('actionFailed'),
      theme: 'error',
      direction: 'column',
    });
  },
});
