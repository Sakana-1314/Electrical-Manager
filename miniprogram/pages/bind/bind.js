const toastModule = require('tdesign-miniprogram/toast/index');
const { request } = require('../../utils/request');
const { storeSession } = require('../../utils/auth');
const { REDIRECT_KEY, extractRedirect, takeRedirect } = require('../../utils/navigation');
const { getMessages, t } = require('../../utils/i18n');
const Toast = toastModule.default || toastModule;

Page({
  data: {
    displayName: '',
    departmentName: '华星检修维护部电气车间',
    loading: false,
    buttonLabel: 'enterHome',
    i18n: getMessages(),
  },

  async onLoad(options = {}) {
    // 回跳目标：显式 redirect 参数优先（各页面在 requires_profile 时带上）；缺席时兜底读
    // 小程序启动参数——分享卡片等冷启动场景，启动路径就是接收方要去的页面。
    const redirect = extractRedirect(options) || this.takeLaunchRedirect();
    if (redirect) {
      wx.setStorageSync(REDIRECT_KEY, redirect);
    } else {
      wx.removeStorageSync(REDIRECT_KEY);
    }
    // 按钮文案随回跳目标变化：扫码出库 / 继续原页面 / 进入首页。
    this.setData({ buttonLabel: this.resolveButtonLabel(redirect) });
    try {
      const session = await getApp().globalData.authPromise;
      if (session.registration_disabled) {
        wx.reLaunch({ url: '/pages/registration-closed/registration-closed' });
        return;
      }
      if (!session.requires_profile) {
        wx.reLaunch({ url: '/pages/home/home' });
      }
    } catch (error) {
      this.showError(error);
    }
  },

  /** 从小程序启动参数恢复目的页面：首页 / 绑定页自身不算目的地，其余 /pages/ 路径带回 query。 */
  takeLaunchRedirect() {
    let launch = null;
    try {
      launch = wx.getLaunchOptionsSync();
    } catch (_error) {
      return '';
    }
    const path = launch && launch.path ? `/${launch.path}` : '';
    if (
      !path.startsWith('/pages/') ||
      path.startsWith('/pages/home/') ||
      path.startsWith('/pages/bind/')
    ) {
      return '';
    }
    const query = Object.keys(launch.query || {})
      .filter((key) => launch.query[key] !== undefined && launch.query[key] !== '')
      .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(String(launch.query[key]))}`)
      .join('&');
    return query ? `${path}?${query}` : path;
  },

  resolveButtonLabel(redirect) {
    if (getApp().globalData.pendingMaterialUuid) {
      return 'enterOutbound';
    }
    if (redirect) {
      return 'continueAfterBind';
    }
    return 'enterHome';
  },

  onNameChange(event) {
    this.setData({ displayName: event.detail.value });
  },

  onDepartmentChange(event) {
    this.setData({ departmentName: event.detail.value });
  },

  async submitProfile() {
    const displayName = this.data.displayName.trim();
    const departmentName = this.data.departmentName.trim();
    if (!displayName) {
      this.showError(new Error(t('nameRequired')));
      return;
    }
    if (!departmentName) {
      this.showError(new Error(t('departmentRequired')));
      return;
    }
    this.setData({ loading: true });
    try {
      const session = await request({
        url: '/mini-program/profile',
        method: 'POST',
        data: {
          display_name: displayName,
          department_name: departmentName,
        },
        token: wx.getStorageSync('miniProgramRegistrationToken'),
      });
      storeSession(session);
      const materialUuid = getApp().globalData.pendingMaterialUuid;
      // 回跳优先级：扫码场景（pendingMaterialUuid）→ 分享/直达场景（redirect）→ 首页。
      const redirect = takeRedirect();
      wx.reLaunch({
        url: materialUuid
          ? `/pages/outbound/outbound?uuid=${materialUuid}`
          : redirect || '/pages/home/home',
      });
    } catch (error) {
      this.showError(error);
    } finally {
      this.setData({ loading: false });
    }
  },

  showError(error) {
    Toast({
      context: this,
      selector: '#profile-toast',
      message: error.message || t('actionFailed'),
      theme: 'error',
      direction: 'column',
    });
  },
});
