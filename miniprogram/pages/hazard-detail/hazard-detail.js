const toastModule = require('tdesign-miniprogram/toast/index');
const { request, uploadImage, clearRequestCache } = require('../../utils/request');
const { buildRedirectQuery } = require('../../utils/navigation');
const { getMessages, setNavigationBarTitle, t } = require('../../utils/i18n');
const { withTheme } = require('../../utils/theme');
const { canWriteHazards } = require('../../utils/features');
const { decorateHazard, decorateImage } = require('../../utils/hazard');
const Toast = toastModule.default || toastModule;

const HAZARD_STATUSES = ['待整改', '整改受阻', '已整改'];
// 单侧图片上限与网页端一致（后端同样是 9 张）。
const MAX_IMAGES = 9;

Page(withTheme({
  data: {
    hazardId: 0,
    hazard: null,
    loading: true,
    saving: false,
    canWrite: false,
    statusOptions: HAZARD_STATUSES.map((value) => ({ label: value, value })),
    form: {
      status: '待整改',
      rectifyPerson: '',
      remark: '',
      afterImages: [],
    },
    i18n: getMessages(),
  },

  async onLoad(options = {}) {
    setNavigationBarTitle('hazardDetailTitle');
    const hazardId = Number(options.id || 0);
    this.setData({ hazardId });
    try {
      const app = getApp();
      const session = await app.globalData.authPromise;
      if (session.account_disabled || session.registration_disabled) {
        return;
      }
      if (session.requires_profile) {
        const redirect = buildRedirectQuery(`/pages/hazard-detail/hazard-detail?id=${hazardId}`);
        wx.reLaunch({ url: `/pages/bind/bind?redirect=${redirect}` });
        return;
      }
      if (!hazardId) {
        this.showError(new Error(t('invalidHazard')));
        return;
      }
      await Promise.all([
        app.globalData.featureSettingsPromise,
        app.globalData.imageSettingsPromise,
      ]);
      this.setData({ canWrite: canWriteHazards() });
      await this.loadHazard();
    } catch (error) {
      this.showError(error);
    } finally {
      this.setData({ loading: false });
    }
  },

  async loadHazard() {
    const result = await request({ url: `/mini-program/hazards/${this.data.hazardId}` });
    const hazard = decorateHazard(result);
    this.setData({
      hazard,
      form: {
        status: hazard.status,
        rectifyPerson: hazard.rectify_person || '',
        remark: hazard.remark || '',
        afterImages: hazard.after_images || [],
      },
    });
  },

  onStatusChange(event) {
    this.setData({ 'form.status': event.detail.value });
  },

  onFieldChange(event) {
    const field = event.currentTarget.dataset.field;
    if (!field) {
      return;
    }
    this.setData({ [`form.${field}`]: event.detail.value });
  },

  async addAfterImages() {
    const remaining = MAX_IMAGES - this.data.form.afterImages.length;
    // 上传进行中不再受理新的选图：否则连点「添加」会并发多轮上传，总数越过 9 张上限
    if (remaining <= 0 || this.uploading) {
      return;
    }
    this.uploading = true;
    try {
      const chosen = await new Promise((resolve, reject) => {
        wx.chooseMedia({
          count: remaining,
          mediaType: ['image'],
          // 优先压缩图：现场拍的原图常有数 MB，在车间弱网下上传要几十秒
          sizeType: ['compressed'],
          sourceType: ['album', 'camera'],
          success: (result) => resolve(result.tempFiles || []),
          fail: (error) => reject(new Error(error.errMsg || t('hazardUploadFailed'))),
        });
      });
      for (const file of chosen) {
        const uploaded = await uploadImage(file.tempFilePath);
        const images = [...this.data.form.afterImages, decorateImage(uploaded)];
        this.setData({ 'form.afterImages': images });
      }
    } catch (error) {
      this.showError(error);
    } finally {
      this.uploading = false;
    }
  },

  removeAfterImage(event) {
    const index = Number(event.currentTarget.dataset.index);
    const images = this.data.form.afterImages.filter((_item, itemIndex) => itemIndex !== index);
    this.setData({ 'form.afterImages': images });
  },

  previewImage(event) {
    const group = event.currentTarget.dataset.group;
    const index = Number(event.currentTarget.dataset.index);
    // 可编辑时整改后图片渲染的是 form.afterImages（含刚上传、尚未保存的），预览必须用同一份，
    // 否则下标对不上（预览到别的图，或 current 为 undefined）。
    const afterImages = this.data.canWrite ? this.data.form.afterImages : this.data.hazard.after_images;
    const images = group === 'before' ? this.data.hazard.before_images : afterImages;
    const urls = (images || []).map((image) => image.original_url);
    if (!urls.length) {
      return;
    }
    wx.previewImage({ current: urls[index], urls });
  },

  async saveFollowUp() {
    const hazard = this.data.hazard;
    if (!hazard || this.data.saving || this.uploading) {
      return;
    }
    this.setData({ saving: true });
    try {
      const updated = await request({
        url: `/mini-program/hazards/${hazard.id}`,
        method: 'PATCH',
        data: {
          status: this.data.form.status,
          rectify_person: this.data.form.rectifyPerson.trim() || null,
          remark: this.data.form.remark.trim() || null,
          after_image_ids: this.data.form.afterImages.map((image) => image.id),
          version: hazard.version,
        },
      });
      clearRequestCache('/mini-program/hazards');
      const decorated = decorateHazard(updated);
      this.setData({
        hazard: decorated,
        form: {
          status: decorated.status,
          rectifyPerson: decorated.rectify_person || '',
          remark: decorated.remark || '',
          afterImages: decorated.after_images || [],
        },
      });
      Toast({
        context: this,
        selector: '#hazard-detail-toast',
        message: t('hazardSaveSuccess'),
        theme: 'success',
        direction: 'column',
      });
    } catch (error) {
      this.showError(error);
    } finally {
      this.setData({ saving: false });
    }
  },

  showError(error) {
    Toast({
      context: this,
      selector: '#hazard-detail-toast',
      message: error.message || t('hazardDetailFailed'),
      theme: 'error',
      direction: 'column',
    });
  },

  onShareAppMessage() {
    const hazard = this.data.hazard;
    return {
      title: hazard ? `${t('shareHazardDetail')} · ${hazard.description}` : t('shareHazardDetail'),
      path: `/pages/hazard-detail/hazard-detail?id=${this.data.hazardId}`,
    };
  },
}));
