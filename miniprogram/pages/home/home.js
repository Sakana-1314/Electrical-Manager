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
    // 当前项目：`currentProjectId` 为 0 表示还没解析出来（显示「未选择」）；
    // 切换项目走 t-picker 滚轮选择器（打开时定位到当前项目，确认后才切换）。
    projectPickerVisible: false,
    // 选项用组件约定的 `{ label, value }`（t-picker-item 以 value 作 wx:key），value 即项目 id。
    projectOptions: [],
    projectPickerValue: [],
    // 选择器从「个人信息」弹窗里打开：弹窗本身是 z-index 11500 的 t-popup，
    // 这里把选择器面板与其遮罩都抬到弹窗之上（仍低于 Toast 的 12001），避免面板被弹窗压住。
    projectPickerPopupProps: { zIndex: 11700, overlayProps: { zIndex: 11600 } },
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
    // 标签统一取 utils/project.js 里的 label（只显示名称，不外显编码），避免两处拼法不一致；
    // 选项字段用组件约定的 label / value（value 即项目 id，t-picker-item 以它作 wx:key）。
    const projectOptions = getEnabledProjects().map((project) => ({
      label: project.label,
      value: project.id,
    }));
    const currentProjectId = currentProject ? currentProject.id : 0;
    this.setData({
      projectOptions,
      // 选择器的 value 是「每列选中值」数组；当前项目不在启用列表里（被停用等）时留空，
      // 由组件自己定位到首项，避免传了无效 id 后回显空白。
      projectPickerValue: projectOptions.some((project) => project.value === currentProjectId)
        ? [currentProjectId]
        : [],
      currentProjectId,
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
    // 关闭弹窗时收起外观下拉与项目选择器，下次打开恢复收起状态。
    this.setData(
      visible
        ? { userProfileVisible: true }
        : { userProfileVisible: false, appearanceExpanded: false, projectPickerVisible: false },
    );
  },

  toggleAppearance() {
    this.setData({ appearanceExpanded: !this.data.appearanceExpanded });
  },

  /** 打开项目选择器：没有可选项目时只提示，不弹空选择器。 */
  openProjectPicker() {
    if (!this.data.projectOptions.length) {
      Toast({
        context: this,
        selector: '#home-toast',
        message: t('noAvailableProject'),
        theme: 'warning',
        direction: 'column',
      });
      return;
    }
    this.setData({ projectPickerVisible: true });
  },

  closeProjectPicker() {
    this.setData({ projectPickerVisible: false });
  },

  /** 点遮罩或自动收起也会走 visible-change，必须同步回 data，否则下次点开不再弹出。 */
  onProjectPickerVisibleChange(event) {
    this.setData({ projectPickerVisible: event.detail.visible });
  },

  /** 确认选择：切换后整页重启（见 utils/project.js 的 switchProject），本页无需刷新数据。 */
  onProjectPickerConfirm(event) {
    const [projectId] = event.detail.value || [];
    this.setData({ projectPickerVisible: false });
    if (!projectId || projectId === this.data.currentProjectId) return;
    switchProject(projectId);
  },

  onThemeModeChange(event) {
    setThemeMode(this, event.detail.value);
    // 选完即收起，展开态只用于选择过程。
    this.setData({ appearanceExpanded: false });
  },

  openRecords() {
    this.setData({
      userProfileVisible: false,
      appearanceExpanded: false,
      projectPickerVisible: false,
    });
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
