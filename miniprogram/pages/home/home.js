const toastModule = require('tdesign-miniprogram/toast/index');
const { parseScanResult } = require('../../utils/scan');
const {
  canManageStock,
  canOutbound,
  entryEnabled,
  hasStandardInventory,
} = require('../../utils/features');
const { getMessages, t } = require('../../utils/i18n');
const { shareLogoUrl } = require('../../utils/assets');
const { ensureProject, takeProjectSwitchNotice } = require('../../utils/project');
const Toast = toastModule.default || toastModule;

// 分享卡片图放在网页前端（EdgeOne）按地址引用，不再占用小程序包体积。

Page({
  data: {
    user: null,
    scanning: false,
    // 登录态与权限位都返回后才置 true：加载期间只显示加载态，不渲染功能入口，
    // 避免入口先全量冒出、拿到权限后再逐个收起。
    featureReady: false,
    // 首次加载失败：停在错误态给「重新加载」，而不是一直转圈。
    loadFailed: false,
    // 首页入口是否展示：只看用户权限位（登录会话的 permissions），无读权限的入口不渲染。
    // 这些值只在 featureReady 置位时一并写入，渲染入口前已是最终结果。
    entryVisible: {
      // 二级库 Pro / Lite 是两套独立权限：同时持有时两个入口都展示，互不遮挡。
      inventoryPro: true,
      inventoryLite: true,
      stockManage: true,
      huaxing: true,
      purchasePlans: true,
      purchaseRecords: true,
      ledger: true,
      hazards: true,
      materialCodes: true,
    },
    // 扫一扫是所有扫码类操作的统一入口（物资码、网页登录码），入口不按权限隐藏：
    // 只操作二级库 Lite 的用户同样要用它确认网页登录。扫到物资码后再按权限分流。
    // 描述文案：有出库写权限提示进入出库确认，只有二级库 Pro 读权限提示查看详情，
    // 都没有时提示识别物资或网页登录码。
    scanDescription: '',
    i18n: getMessages(),
  },

  async onLoad() {
    await this.loadSession();
  },

  /**
   * 加载登录态，并按权限位算出首页入口。
   *
   * 登录态到齐后一次性写入 user / entryVisible / scanDescription 并置 featureReady，
   * 让页面从「加载中」直接切到完整入口，不出现入口先渲染再隐藏的闪烁。
   * 失败时停在错误态（loadFailed），由用户点「重新加载」重试。
   */
  async loadSession() {
    this.setData({ featureReady: false, loadFailed: false });
    try {
      const session = await getApp().globalData.authPromise;
      if (session.registration_disabled) {
        wx.reLaunch({ url: '/pages/registration-closed/registration-closed' });
        return;
      }
      if (session.requires_profile) {
        wx.reLaunch({ url: '/pages/bind/bind' });
        return;
      }
      this.setData({
        user: session.user,
        featureReady: true,
        // 入口 = 用户权限位里有对应模块的读权限（管理端与小程序端同一套权限）。
        entryVisible: {
          // 二级库 Pro / Lite 分别在各自权限位下展示：同时持有时两个入口都能进。
          inventoryPro: entryEnabled('inventoryPro'),
          inventoryLite: entryEnabled('inventoryLite'),
          // 二级库管理（物资档案 / 扫码入库）按写权限出现，与出库同一个权限位。
          stockManage: canManageStock(),
          huaxing: entryEnabled('huaxing'),
          purchasePlans: entryEnabled('purchasePlans'),
          purchaseRecords: entryEnabled('purchaseRecords'),
          ledger: entryEnabled('ledger'),
          hazards: entryEnabled('hazards'),
          materialCodes: entryEnabled('materialCodes'),
        },
        scanDescription: canOutbound()
          ? t('scanDescription')
          : hasStandardInventory()
            ? t('scanDescriptionView')
            : t('scanDescriptionGeneric'),
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
   * 请求由后端落到默认项目。项目详情 / 切换在「个人信息」页（packages/account），
   * 用户与功能模式经 getApp().globalData 共享，不经页面参数传递。
   */
  async syncCurrentProject() {
    let session = null;
    try {
      session = await getApp().globalData.authPromise;
    } catch (_error) {
      // 静默登录失败由 onLoad 的既有分支提示，这里继续走本机缓存的解析。
    }
    // 注册关闭 / 未绑定：页面正在跳转，不再额外请求项目。
    if (
      session &&
      (session.registration_disabled || session.requires_profile)
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

  /** 二级库 Pro：库存查询 / 扫码出库 / 出入库记录（warehouse:read）。 */
  openInventoryPro() {
    wx.navigateTo({ url: '/packages/warehouse/pages/inventory/inventory?source=pro' });
  },

  /** 二级库 Lite：Excel 导入的只读台账（lite:read）。 */
  openInventoryLite() {
    wx.navigateTo({ url: '/packages/warehouse/pages/inventory/inventory?source=lite' });
  },

  /** 二级库管理：物资档案 + 扫码入库（写权限位才出现）。 */
  openStockManage() {
    wx.navigateTo({ url: '/packages/warehouse/pages/stock-materials/stock-materials' });
  },

  /** 水印相机：现场拍照工具，所有已登录用户都可用，不看权限位。 */
  openWatermark() {
    wx.navigateTo({ url: '/packages/tools/pages/watermark-camera/watermark-camera' });
  },

  openHuaXingInventory() {
    wx.navigateTo({ url: '/packages/huaxing/pages/huaxing-inventory/huaxing-inventory' });
  },

  openHazards() {
    wx.navigateTo({ url: '/packages/hazard/pages/hazards/hazards' });
  },

  openPurchasePlans() {
    wx.navigateTo({ url: '/packages/procurement/pages/purchase-plans/purchase-plans' });
  },

  openPurchaseRecords() {
    wx.navigateTo({ url: '/packages/procurement/pages/purchase-records/purchase-records' });
  },

  openMaterialCodes() {
    wx.navigateTo({ url: '/packages/procurement/pages/material-codes/material-codes' });
  },

  openLedger() {
    wx.navigateTo({ url: '/packages/ledger/pages/ledger/ledger' });
  },

  onShareAppMessage() {
    return {
      title: t('shareHome'),
      path: '/pages/home/home',
      imageUrl: shareLogoUrl(),
    };
  },

  /** 操作员徽章：整块跳转「个人信息」页（原弹窗改为独立页面）。 */
  openProfile() {
    wx.navigateTo({ url: '/packages/account/pages/profile/profile' });
  },

  /**
   * 扫一扫：所有扫码类操作的统一入口。
   *
   * 网页登录码 → 网页登录确认页；物资码 → 有出库写权限进出库确认，
   * 只有二级库 Pro 读权限时看物资详情，两种权限都没有时明确提示。
   * 入口本身不按权限隐藏（二级库 Lite 用户也要用它确认网页登录）。
   */
  async startScan() {
    this.setData({ scanning: true });
    try {
      const scanResult = await new Promise((resolve, reject) => {
        wx.scanCode({ success: resolve, fail: reject });
      });
      const { webLoginScene, materialUuid } = parseScanResult(scanResult);
      // 登录码与物资码的 scene 都是 32 位十六进制，parseScanResult 已先按页面路径区分。
      if (webLoginScene) {
        wx.navigateTo({
          url: `/pages/web-login/web-login?scene=${encodeURIComponent(webLoginScene)}`,
        });
        return;
      }
      if (!materialUuid) {
        this.showError(new Error(t('scanUnrecognized')));
        return;
      }
      if (canOutbound()) {
        wx.navigateTo({ url: `/pages/outbound/outbound?uuid=${materialUuid}` });
        return;
      }
      if (hasStandardInventory()) {
        wx.navigateTo({ url: `/packages/warehouse/pages/material-detail/material-detail?uuid=${materialUuid}` });
        return;
      }
      this.showError(new Error(t('scanNoWarehousePermission')));
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
