const toastModule = require('tdesign-miniprogram/toast/index');
const { request, uploadImage } = require('../../utils/request');
const { buildRedirectQuery } = require('../../utils/navigation');
const { hasPermission } = require('../../utils/features');
const { imageUrl } = require('../../utils/inventory');
const { getMessages, t } = require('../../utils/i18n');
const Toast = toastModule.default || toastModule;

const MAX_IMAGES = 9;

Page({
  data: {
    loading: true,
    submitting: false,
    isEdit: false,
    materialId: 0,
    version: 0,
    // 新建需要写权限；编辑还要能删除，按钮同权限位（warehouse:write）。
    canWrite: false,
    images: [],
    form: {
      name: '',
      nameId: '',
      alias: '',
      modelSpec: '',
      unitName: '',
      remark: '',
    },
    i18n: getMessages(),
  },

  async onLoad(options = {}) {
    const materialId = Number(options.id) || 0;
    this.materialUuid = options.uuid || '';
    this.setData({ isEdit: materialId > 0, materialId });
    try {
      const session = await getApp().globalData.authPromise;
      if (session.registration_disabled) return;
      if (session.requires_profile) {
        const redirect = buildRedirectQuery(
          `/pages/stock-material-form/stock-material-form?id=${materialId}&uuid=${this.materialUuid}`,
        );
        wx.reLaunch({ url: `/pages/bind/bind?redirect=${redirect}` });
        return;
      }
      const canWrite = hasPermission('warehouse:write');
      this.setData({ canWrite });
      if (materialId > 0) await this.loadMaterial();
      if (!canWrite && !this.data.isEdit) {
        // 只读用户直接打开新建页：提示无权限并返回。
        this.showError(new Error(t('stockNoPermission')));
        wx.navigateBack();
      }
    } catch (error) {
      this.showError(error);
    } finally {
      this.setData({ loading: false });
    }
  },

  /** 编辑时读详情（含图片与乐观锁版本），把字段回填到表单。 */
  async loadMaterial() {
    if (!this.materialUuid) {
      // 列表已带 uuid；缺失时退回按列表接口无法定位，提示重进列表。
      this.showError(new Error(t('invalidMaterial')));
      return;
    }
    const detail = await request({ url: `/mini-program/materials/${this.materialUuid}` });
    this.setData({
      version: detail.version || 0,
      images: (detail.images || []).map((image) => ({
        ...image,
        preview_url: imageUrl(image.id, 192),
      })),
      form: {
        name: detail.name || '',
        nameId: detail.name_id || '',
        alias: detail.alias || '',
        modelSpec: detail.model_spec || '',
        unitName: detail.unit_name || '',
        remark: detail.remark || '',
      },
    });
  },

  onFieldChange(event) {
    const { field } = event.currentTarget.dataset;
    this.setData({ [`form.${field}`]: event.detail.value });
  },

  async chooseImage() {
    const remaining = MAX_IMAGES - this.data.images.length;
    if (remaining <= 0) {
      this.showError(new Error(t('stockImageLimitReached', { count: MAX_IMAGES })));
      return;
    }
    try {
      const result = await new Promise((resolve, reject) => {
        wx.chooseMedia({
          count: remaining,
          mediaType: ['image'],
          sourceType: ['camera', 'album'],
          success: resolve,
          fail: reject,
        });
      });
      const files = (result.tempFiles || []).filter((file) => file.tempFilePath);
      if (!files.length) return;
      this.setData({ uploading: true });
      const uploaded = [];
      for (const file of files) {
        const image = await uploadImage(file.tempFilePath);
        uploaded.push({ ...image, preview_url: imageUrl(image.id, 192) });
      }
      this.setData({ images: [...this.data.images, ...uploaded] });
    } catch (error) {
      if (!String(error.errMsg || '').includes('cancel')) this.showError(error);
    } finally {
      this.setData({ uploading: false });
    }
  },

  removeImage(event) {
    const index = Number(event.currentTarget.dataset.index);
    const images = this.data.images.slice();
    images.splice(index, 1);
    this.setData({ images });
  },

  previewImage(event) {
    const current = event.currentTarget.dataset.url;
    const urls = this.data.images.map((image) => image.preview_url);
    wx.previewImage({ current, urls });
  },

  validateForm() {
    const { name, modelSpec, unitName } = this.data.form;
    if (!name.trim() || !modelSpec.trim() || !unitName.trim()) {
      return t('stockMaterialRequired');
    }
    return '';
  },

  async submit() {
    if (!this.data.canWrite) {
      this.showError(new Error(t('stockNoPermission')));
      return;
    }
    const validationMessage = this.validateForm();
    if (validationMessage) {
      this.showError(new Error(validationMessage));
      return;
    }
    if (this.data.submitting) return;
    const { name, nameId, alias, modelSpec, unitName, remark } = this.data.form;
    const payload = {
      name: name.trim(),
      name_id: nameId.trim() || null,
      alias: alias.trim() || null,
      model_spec: modelSpec.trim(),
      unit_name: unitName.trim(),
      remark: remark.trim() || null,
      image_ids: this.data.images.map((image) => String(image.id)),
    };
    this.setData({ submitting: true });
    try {
      if (this.data.isEdit) {
        await request({
          url: `/mini-program/stock-materials/${this.data.materialId}`,
          method: 'PATCH',
          data: { ...payload, version: this.data.version },
        });
      } else {
        await request({ url: '/mini-program/stock-materials', method: 'POST', data: payload });
      }
      Toast({
        context: this,
        selector: '#stock-material-form-toast',
        message: t('stockMaterialSaved'),
        theme: 'success',
        direction: 'column',
      });
      setTimeout(() => wx.navigateBack(), 400);
    } catch (error) {
      this.showError(error);
    } finally {
      this.setData({ submitting: false });
    }
  },

  async remove() {
    if (!this.data.canWrite || !this.data.isEdit) return;
    const confirmed = await new Promise((resolve) => {
      wx.showModal({
        title: t('stockMaterialDeleted'),
        content: t('stockMaterialDeleteConfirm', { name: this.data.form.name }),
        confirmText: t('confirm'),
        cancelText: t('cancel'),
        success: (res) => resolve(!!res.confirm),
        fail: () => resolve(false),
      });
    });
    if (!confirmed) return;
    try {
      await request({
        url: `/mini-program/stock-materials/${this.data.materialId}`,
        method: 'DELETE',
        header: { 'If-Match': String(this.data.version) },
      });
      Toast({
        context: this,
        selector: '#stock-material-form-toast',
        message: t('stockMaterialDeleted'),
        theme: 'success',
        direction: 'column',
      });
      setTimeout(() => wx.navigateBack(), 400);
    } catch (error) {
      this.showError(error);
    }
  },

  showError(error) {
    Toast({
      context: this,
      selector: '#stock-material-form-toast',
      message: (error && error.message) || t('actionFailed'),
      theme: 'error',
      direction: 'column',
    });
  },
});
