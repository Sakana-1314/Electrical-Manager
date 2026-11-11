const toastModule = require('tdesign-miniprogram/toast/index');
const { extractMaterialUuid } = require('../../utils/material');
const { canOutbound, entryEnabled, SECONDARY_WAREHOUSE_LITE } = require('../../utils/features');
const { getMessages, t } = require('../../utils/i18n');
const { ensureProject, takeProjectSwitchNotice } = require('../../utils/project');
const Toast = toastModule.default || toastModule;

// 分享卡片图放在代码包里，不依赖接口域名（接口域名只提供 API，不保证有 /logo.png）。
const SHARE_IMAGE_URL = '/assets/share-logo.png';

Page({
  data: {
    user: null,
    scanning: false,
    // 登录态与功能配置都返回后才置 true：加载期间只显示加载态，不渲染功能入口，
    // 避免入口先全量冒出、拿到配置后再逐个收起（精简模式与「禁用」项都会这样闪一下）。
    featureReady: false,
    // 首次加载失败：停在错误态给「重新加载」，而不是一直转圈。
    loadFailed: false,
    // 首页入口是否展示：功能被管理员设为「禁用」的入口直接不渲染（原来全部常驻、点了才提示未开放）。
    // 这些值只在 featureReady 置位时一并写入，渲染入口前已是最终结果。
    entryVisible: {
      inventory: true,
      huaxing: true,
      purchasePlans: true,
      purchaseRecords: true,
      ledger: true,
      hazards: true,
      materialCodes: true,
    },
    liteMode: false,
    // 扫码出库入口：精简模式或库存只读/禁用时不渲染（原来常驻、点了才提示未开放）。
    canScan: false,
    i18n: getMessages(),
  },

  async onLoad() {
    await this.loadSession();
  },

  /**
   * 加载登录态与功能配置。
   *
   * 两者都到齐后才一次性写入 user / entryVisible / liteMode 并置 featureReady，
   * 让页面从「加载中」直接切到完整入口，不出现入口先渲染再隐藏的闪烁。
   * 失败时停在错误态（loadFailed），由用户点「重新加载」重试。
   */
  async loadSession() {
    this.setData({ featureReady: false, loadFailed: false });
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
      const liteMode = featureModes.secondary_warehouse_mode === SECONDARY_WAREHOUSE_LITE;
      this.setData({
        user: session.user,
        featureReady: true,
        // 入口 = 全局功能开关开启 且 用户权限并集里有对应模块的读权限（RBAC 下放：有权限才看得到）。
        entryVisible: {
          inventory: entryEnabled('inventory'),
          huaxing: entryEnabled('huaxing'),
          purchasePlans: entryEnabled('purchasePlans'),
          purchaseRecords: entryEnabled('purchaseRecords'),
          ledger: entryEnabled('ledger'),
          hazards: entryEnabled('hazards'),
          materialCodes: entryEnabled('materialCodes'),
        },
        liteMode,
        canScan: canOutbound(),
      });
    } catch (error) {
      this.setData({ loadFailed: true });
      this.showError(error);
    }
  },

  /** 错误态里的「重新加载」：重新走一遍登录与功能配置。 */
  retryLoad() {
    void this.loadSession();
  },

  onShow() {
    // 每次回到首页都同步一次项目：项目列表一次会话只拉一次，重复调用不产生额外请求。
    this.syncCurrentProject();
  },

  /**
   * 保证当前项目已解析（业务请求要带 X-Project-Id）。
   *
   * 等静默登录完成再请求，避免冷启动时无 token 触发重复登录；解析失败静默降级：
   * 请求由后端落到默认项目。项目详情 / 切换在「个人信息」页（pages/profile），
   * 用户与功能模式经 getApp().globalData 共享，不经页面参数传递。
   */
  async syncCurrentProject() {
    let session = null;
    try {
      session = await getApp().globalData.authPromise;
    } catch (_error) {
      // 静默登录失败由 onLoad 的既有分支提示，这里继续走本机缓存的解析。
    }
    // 账号待审核 / 注册关闭 / 未绑定：页面正在跳转，不再额外请求项目。
    if (
      session &&
      (session.account_disabled || session.registration_disabled || session.requires_profile)
    ) {
      return;
    }
    await ensureProject();
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

  openLedger() {
    if (!this.ensureFeatureEnabled('ledger_mode')) return;
    wx.navigateTo({ url: '/pages/ledger/ledger' });
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

  /** 操作员徽章：整块跳转「个人信息」页（原弹窗改为独立页面）。 */
  openProfile() {
    wx.navigateTo({ url: '/pages/profile/profile' });
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
});
