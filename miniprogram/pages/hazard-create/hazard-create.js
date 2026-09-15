const toastModule = require('tdesign-miniprogram/toast/index');
const { request, uploadImage } = require('../../utils/request');
const { createClientRequestId } = require('../../utils/material');
const { buildRedirectQuery } = require('../../utils/navigation');
const { getMessages, setNavigationBarTitle, t } = require('../../utils/i18n');
const { withTheme } = require('../../utils/theme');
const { decorateImage, todayString } = require('../../utils/hazard');
const Toast = toastModule.default || toastModule;

const DEFAULT_AREA = '华星现场';
const MAX_IMAGES = 9;
const HAZARD_LEVELS = ['一般隐患', '重大隐患'];

function addDays(dateString, days) {
  const date = new Date(`${dateString}T00:00:00`);
  date.setDate(date.getDate() + days);
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

Page(withTheme({
  data: {
    loading: true,
    submitting: false,
    units: [],
    types: [],
    unitOptions: [],
    typeOptions: [],
    unitPickerVisible: false,
    typePickerVisible: false,
    levelOptions: HAZARD_LEVELS.map((value) => ({ label: value, value })),
    form: {
      inspectionArea: DEFAULT_AREA,
      inspectionDate: '',
      description: '',
      suggestion: '',
      hazardUnitId: null,
      hazardUnitLabel: '',
      hazardPerson: '',
      hazardTypeId: null,
      hazardTypeLabel: '',
      dueDate: '',
      rectifyPerson: '',
      level: '一般隐患',
      remark: '',
      beforeImages: [],
    },
    i18n: getMessages(),
  },

  async onLoad() {
    setNavigationBarTitle('hazardCreateTitle');
    const today = todayString();
    this.setData({
      'form.inspectionDate': today,
      'form.dueDate': addDays(today, 7),
    });
    // 幂等 id：进入页面生成一次，提交重试复用，成功或彻底失败后作废。
    this.clientRequestId = createClientRequestId();
    try {
      const app = getApp();
      const session = await app.globalData.authPromise;
      if (session.account_disabled || session.registration_disabled) {
        return;
      }
      if (session.requires_profile) {
        const redirect = buildRedirectQuery('/pages/hazard-create/hazard-create');
        wx.reLaunch({ url: `/pages/bind/bind?redirect=${redirect}` });
        return;
      }
      await Promise.all([
        app.globalData.featureSettingsPromise,
        app.globalData.imageSettingsPromise,
      ]);
      const options = await request({ url: '/mini-program/hazards/form-options' });
      const units = options.units || [];
      const types = options.types || [];
      this.setData({
        units,
        types,
        // 弹层里用单选列表选择，标签带上责任人/大小类，选中后回填只读文案。
        unitOptions: units.map((unit) => ({
          label: `${unit.name}（${unit.person}）`,
          value: unit.id,
        })),
        typeOptions: types.map((item) => ({
          label: `${item.major} / ${item.minor}`,
          value: item.id,
        })),
      });
    } catch (error) {
      this.showError(error);
    } finally {
      this.setData({ loading: false });
    }
  },

  onFieldChange(event) {
    const field = event.currentTarget.dataset.field;
    if (!field) {
      return;
    }
    this.setData({ [`form.${field}`]: event.detail.value });
  },

  onLevelChange(event) {
    this.setData({ 'form.level': event.detail.value });
  },

  /** 检查日期变化：用户没手动改过「要求完成」时联动 +7 天。 */
  onInspectionDateChange(event) {
    const value = event.detail.value;
    const patch = { 'form.inspectionDate': value };
    if (!this.dueTouched) {
      patch['form.dueDate'] = addDays(value, 7);
    }
    this.setData(patch);
  },

  onDueDateChange(event) {
    this.dueTouched = true;
    this.setData({ 'form.dueDate': event.detail.value });
  },

  openUnitPicker() {
    this.setData({ unitPickerVisible: true });
  },

  closeUnitPicker() {
    this.setData({ unitPickerVisible: false });
  },

  openTypePicker() {
    this.setData({ typePickerVisible: true });
  },

  closeTypePicker() {
    this.setData({ typePickerVisible: false });
  },

  /** 责任单位选项：label 带上责任人，选中后只读回显责任人。 */
  onUnitSelect(event) {
    const unit = event.detail.value;
    const target = this.data.units.find((item) => item.id === unit);
    this.setData({
      unitPickerVisible: false,
      'form.hazardUnitId': target ? target.id : null,
      'form.hazardUnitLabel': target ? `${target.name}（${target.person}）` : '',
      'form.hazardPerson': target ? target.person : '',
    });
  },

  onTypeSelect(event) {
    const typeId = event.detail.value;
    const target = this.data.types.find((item) => item.id === typeId);
    this.setData({
      typePickerVisible: false,
      'form.hazardTypeId': target ? target.id : null,
      'form.hazardTypeLabel': target ? `${target.major} / ${target.minor}` : '',
    });
  },

  async addBeforeImages() {
    const remaining = MAX_IMAGES - this.data.form.beforeImages.length;
    if (remaining <= 0) {
      return;
    }
    try {
      const chosen = await new Promise((resolve, reject) => {
        wx.chooseMedia({
          count: remaining,
          mediaType: ['image'],
          sourceType: ['album', 'camera'],
          success: (result) => resolve(result.tempFiles || []),
          fail: (error) => reject(new Error(error.errMsg || t('hazardUploadFailed'))),
        });
      });
      for (const file of chosen) {
        const uploaded = await uploadImage(file.tempFilePath);
        const images = [...this.data.form.beforeImages, decorateImage(uploaded)];
        this.setData({ 'form.beforeImages': images });
      }
    } catch (error) {
      this.showError(error);
    }
  },

  removeBeforeImage(event) {
    const index = Number(event.currentTarget.dataset.index);
    const images = this.data.form.beforeImages.filter((_item, itemIndex) => itemIndex !== index);
    this.setData({ 'form.beforeImages': images });
  },

  previewImage(event) {
    const index = Number(event.currentTarget.dataset.index);
    const urls = this.data.form.beforeImages.map((image) => image.original_url);
    if (!urls.length) {
      return;
    }
    wx.previewImage({ current: urls[index], urls });
  },

  async submit() {
    const form = this.data.form;
    const description = form.description.trim();
    if (!description || !form.hazardUnitId || !form.hazardTypeId) {
      Toast({
        context: this,
        selector: '#hazard-create-toast',
        message: t('hazardRequiredTip'),
        theme: 'warning',
        direction: 'column',
      });
      return;
    }
    if (this.data.submitting) {
      return;
    }
    this.setData({ submitting: true });
    try {
      await request({
        url: '/mini-program/hazards',
        method: 'POST',
        // 带 client_request_id，服务端按键去重：弱网下可自动重发，不会重复登记。
        retry: true,
        data: {
          client_request_id: this.clientRequestId,
          inspection_area: form.inspectionArea.trim() || null,
          inspection_date: form.inspectionDate,
          description,
          suggestion: form.suggestion.trim() || null,
          hazard_unit_id: form.hazardUnitId,
          hazard_type_id: form.hazardTypeId,
          due_date: form.dueDate,
          rectify_person: form.rectifyPerson.trim() || null,
          level: form.level,
          remark: form.remark.trim() || null,
          before_image_ids: form.beforeImages.map((image) => image.id),
        },
      });
      // 登记成功：作废旧幂等键，返回列表（列表 onShow 会刷新）。
      this.clientRequestId = '';
      Toast({
        context: this,
        selector: '#hazard-create-toast',
        message: t('hazardCreateSuccess'),
        theme: 'success',
        direction: 'column',
      });
      setTimeout(() => wx.navigateBack(), 600);
    } catch (error) {
      this.showError(error);
    } finally {
      this.setData({ submitting: false });
    }
  },

  showError(error) {
    Toast({
      context: this,
      selector: '#hazard-create-toast',
      message: error.message || t('hazardsLoadFailed'),
      theme: 'error',
      direction: 'column',
    });
  },
}));
