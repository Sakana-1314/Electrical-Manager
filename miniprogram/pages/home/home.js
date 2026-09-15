const toastModule = require('tdesign-miniprogram/toast/index');
const { extractMaterialUuid } = require('../../utils/material');
const { canOutbound, isFeatureDisabled, SECONDARY_WAREHOUSE_LITE } = require('../../utils/features');
const { getMessages, setNavigationBarTitle, t } = require('../../utils/i18n');
const {
  ensureProject,
  getCurrentProject,
  getEnabledProjects,
  switchProject,
  takeProjectSwitchNotice,
} = require('../../utils/project');
const { apiBaseUrl } = require('../../config/index');
const { uploadTime: buildUploadTime } = require('../../config/build-info');
const { getAppearanceOptions, setThemeMode, withTheme } = require('../../utils/theme');
const Toast = toastModule.default || toastModule;

const SHARE_IMAGE_URL = `${apiBaseUrl.replace(/\/api\/v1\/?$/, '')}/logo.png`;

function formatDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return t('unknown');
  }
  const pad = (part) => String(part).padStart(2, '0');
  return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

Page(withTheme({
  data: {
    user: null,
    scanning: false,
    // 功能配置接口返回前保持 false：避免精简模式下扫码出库卡片先渲染再隐藏造成闪烁。
    featureReady: false,
    liteMode: false,
    userProfileVisible: false,
    appearanceExpanded: false,
    // 当前项目：`currentProjectId` 为 0 表示还没解析出来（显示「未选择」）。
    projectsExpanded: false,
    projectOptions: [],
    currentProjectId: 0,
    currentProjectLabel: t('projectNotSelected'),
    themeOptions: getAppearanceOptions(),
    miniProgramUpdatedAt: buildUploadTime || t('unknown'),
    i18n: getMessages(),
  },

  async onLoad() {
    setNavigationBarTitle('appTitle');
    try {
      const [session, featureModes] = await Promise.all([
        getApp().globalData.authPromise,
        getApp().globalData.featureSettingsPromise,
      ]);
      if (session.account_disabled) {
        wx.reLaunch({ url: '/pages/disabled/disabled' });
        return;
      }
      if (session.registration_disabled) {
        wx.reLaunch({ url: '/pages/registration-closed/registration-closed' });
        return;
      }
      if (session.requires_profile) {
        wx.reLaunch({ url: '/pages/bind/bind' });
        return;
      }
      this.setData({
        user: {
          ...session.user,
          registered_at: formatDateTime(session.user.created_at),
        },
        featureReady: true,
        liteMode: featureModes.secondary_warehouse_mode === SECONDARY_WAREHOUSE_LITE,
      });
    } catch (error) {
      this.showError(error);
    }
  },

  onShow() {
    // 每次回到首页都同步一次项目：项目列表一次会话只拉一次，重复调用不产生额外请求。
    this.loadCurrentProject();
  },

  /**
   * 拉取项目列表并把当前项目同步到「个人信息」弹窗。
   *
   * 等静默登录完成再请求，避免冷启动时无 token 触发重复登录；项目接口失败时静默降级：
   * 弹窗退回本机缓存 / 「未选择」，业务请求仍由后端落到默认项目。
   */
  async loadCurrentProject() {
    let session = null;
    try {
      session = await getApp().globalData.authPromise;
    } catch (_error) {
      // 静默登录失败由 onLoad 的既有分支提示，这里继续用本机缓存渲染弹窗。
    }
    // 账号待审核 / 注册关闭 / 未绑定：页面正在跳转，不再额外请求项目。
    if (
      session &&
      (session.account_disabled || session.registration_disabled || session.requires_profile)
    ) {
      return;
    }
    await ensureProject();
    const currentProject = getCurrentProject();
    this.setData({
      projectOptions: getEnabledProjects().map((project) => ({
        id: project.id,
        label: `${project.code} ${project.name}`,
      })),
      currentProjectId: currentProject ? currentProject.id : 0,
      currentProjectLabel: currentProject ? currentProject.label : t('projectNotSelected'),
    });
    // 切换项目是整页重启，提示由重启前的标记带过来；此时页面已渲染，toast 组件可用。
    if (takeProjectSwitchNotice()) {
      Toast({
        context: this,
        selector: '#home-toast',
        message: t('projectSwitched'),
        theme: 'success',
        direction: 'column',
      });
    }
  },

  openInventory() {
    if (!this.ensureFeatureEnabled('inventory_mode')) return;
    wx.navigateTo({ url: '/pages/inventory/inventory' });
  },

  openHuaXingInventory() {
    if (!this.ensureFeatureEnabled('huaxing_inventory_mode')) return;
    wx.navigateTo({ url: '/pages/huaxing-inventory/huaxing-inventory' });
  },

  openHazards() {
    if (!this.ensureFeatureEnabled('hazards_mode')) return;
    wx.navigateTo({ url: '/pages/hazards/hazards' });
  },

  openPurchasePlans() {
    if (!this.ensureFeatureEnabled('purchase_plans_mode')) return;
    wx.navigateTo({ url: '/pages/purchase-plans/purchase-plans' });
  },

  openPurchaseRecords() {
    if (!this.ensureFeatureEnabled('purchase_records_mode')) return;
    wx.navigateTo({ url: '/pages/purchase-records/purchase-records' });
  },

  openMaterialCodes() {
    if (!this.ensureFeatureEnabled('material_codes_mode')) return;
    wx.navigateTo({ url: '/pages/material-codes/material-codes' });
  },

  ensureFeatureEnabled(modeKey) {
    if (isFeatureDisabled(modeKey)) {
      this.showError(new Error(t('featureNotOpen')));
      return false;
    }
    return true;
  },

  onShareAppMessage() {
    return {
      title: t('shareHome'),
      path: '/pages/home/home',
      imageUrl: SHARE_IMAGE_URL,
    };
  },

  showUserProfile() {
    this.setData({ userProfileVisible: true });
  },

  onUserProfileVisibleChange(event) {
    const visible = event.detail.visible;
    // 关闭弹窗时收起外观与项目下拉，下次打开恢复收起状态。
    this.setData(
      visible
        ? { userProfileVisible: true }
        : { userProfileVisible: false, appearanceExpanded: false, projectsExpanded: false },
    );
  },

  toggleAppearance() {
    this.setData({ appearanceExpanded: !this.data.appearanceExpanded });
  },

  toggleProjects() {
    this.setData({ projectsExpanded: !this.data.projectsExpanded });
  },

  /** 选择项目：切换后整页重启（见 utils/project.js 的 switchProject），本页无需刷新数据。 */
  onProjectSelect(event) {
    const projectId = Number(event.currentTarget.dataset.projectId);
    if (!projectId || projectId === this.data.currentProjectId) {
      this.setData({ projectsExpanded: false });
      return;
    }
    switchProject(projectId);
  },

  onThemeModeChange(event) {
    setThemeMode(this, event.detail.value);
    // 选完即收起，展开态只用于选择过程。
    this.setData({ appearanceExpanded: false });
  },

  openRecords() {
    this.setData({ userProfileVisible: false, appearanceExpanded: false, projectsExpanded: false });
    wx.navigateTo({ url: '/pages/records/records' });
  },

  async scanMaterial() {
    if (!canOutbound()) {
      this.showError(new Error(t('outboundNotOpen')));
      return;
    }
    this.setData({ scanning: true });
    try {
      const scanResult = await new Promise((resolve, reject) => {
        wx.scanCode({ success: resolve, fail: reject });
      });
      const materialUuid = extractMaterialUuid(scanResult.path || scanResult.result);
      if (!materialUuid) {
        throw new Error(t('materialUuidMissing'));
      }
      wx.navigateTo({ url: `/pages/outbound/outbound?uuid=${materialUuid}` });
    } catch (error) {
      if (!String(error.errMsg || '').includes('cancel')) {
        this.showError(error);
      }
    } finally {
      this.setData({ scanning: false });
    }
  },

  showError(error) {
    Toast({
      context: this,
      selector: '#home-toast',
      message: error.message || t('actionFailed'),
      theme: 'error',
      direction: 'column',
    });
  },
}));
