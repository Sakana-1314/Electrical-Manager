const toastModule = require('tdesign-miniprogram/toast/index');
const { request } = require('../../utils/request');
const { getMessages, t } = require('../../utils/i18n');
const {
  ensureProject,
  getEnabledProjects,
  getCurrentProject,
  getCurrentProjectId,
  switchProject,
} = require('../../utils/project');
const { uploadTime: buildUploadTime } = require('../../config/build-info');
const Toast = toastModule.default || toastModule;

// 御坂学习中转小程序的 appId：半屏打开它，由它的 web-view 承载网页版（业务域名已配置）。
const WEB_VERSION_APP_ID = 'wxb42fe32e6e071916';

function formatDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return t('unknown');
  }
  const pad = (part) => String(part).padStart(2, '0');
  return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

Page({
  data: {
    loading: true,
    failed: false,
    user: null,
    // 「进入网页版」按钮的请求中态
    openingWeb: false,
    // 当前项目：`currentProjectId` 为 0 表示还没解析出来（显示「未选择」）；
    // 切换项目走 t-picker 滚轮选择器（打开时定位到当前项目，确认后才切换）。
    projectPickerVisible: false,
    // 选项用组件约定的 `{ label, value }`（t-picker-item 以 value 作 wx:key），value 即项目 id。
    projectOptions: [],
    projectPickerValue: [],
    currentProjectId: 0,
    currentProjectLabel: t('projectNotSelected'),
    miniProgramUpdatedAt: buildUploadTime || t('unknown'),
    i18n: getMessages(),
  },

  onLoad() {
    void this.loadProfile();
  },

  onShow() {
    // 每次回到本页都同步一次项目：项目列表一次会话只拉一次，重复调用不产生额外请求。
    void this.loadProjectState();
  },

  /**
   * 用户与功能模式：与首页共用 globalData（登录态 / 功能配置都已在进入前解析），
   * 页面间不经 URL 参数传数据。登录态异常时兜底读 globalData.user。
   */
  async loadProfile() {
    this.setData({ loading: true, failed: false });
    try {
      const app = getApp();
      let session = null;
      try {
        session = await app.globalData.authPromise;
      } catch (_error) {
        // 静默登录失败：退回 globalData.user 渲染，失败态由下方 user 判空兜底。
      }
      if (session && session.registration_disabled) {
        wx.reLaunch({ url: '/pages/registration-closed/registration-closed' });
        return;
      }
      if (session && session.requires_profile) {
        wx.reLaunch({ url: '/pages/bind/bind' });
        return;
      }
      const user = (session && session.user) || getApp().globalData.user;
      if (!user) {
        throw new Error(t('requestFailed'));
      }
      // 权限位数量展示在账号信息里（管理端与小程序端共用同一套权限位）。
      const permissionCountLabel = t('permissionCount', { count: (user.permissions || []).length });
      this.setData({
        user: {
          ...user,
          registered_at: formatDateTime(user.created_at),
        },
        permissionCountLabel,
        loading: false,
      });
    } catch (_error) {
      this.setData({ loading: false, failed: true });
    }
  },

  retry() {
    void this.loadProfile();
  },

  /**
   * 拉取项目列表并同步当前项目展示。
   *
   * 等静默登录完成再请求，避免冷启动时无 token 触发重复登录；项目接口失败时静默降级：
   * 本页退回本机缓存 / 「未选择」，业务请求仍由后端落到默认项目。
   */
  async loadProjectState() {
    let session = null;
    try {
      session = await getApp().globalData.authPromise;
    } catch (_error) {
      // 静默登录失败由 loadProfile 的既有分支处理，这里继续用本机缓存渲染。
    }
    // 注册关闭 / 未绑定：页面正在跳转，不再额外请求项目。
    if (
      session &&
      (session.registration_disabled || session.requires_profile)
    ) {
      return;
    }
    await ensureProject();
    const currentProject = getCurrentProject();
    // 标签统一取 utils/project.js 里的 label（只显示名称，不外显编码）；
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
  },

  /** 打开项目选择器：没有可选项目时只提示，不弹空选择器。 */
  openProjectPicker() {
    if (!this.data.projectOptions.length) {
      Toast({
        context: this,
        selector: '#profile-toast',
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

  /** 确认选择：切换后整页重启回首页（见 utils/project.js 的 switchProject），本页无需刷新数据。 */
  onProjectPickerConfirm(event) {
    const [projectId] = event.detail.value || [];
    this.setData({ projectPickerVisible: false });
    if (!projectId || projectId === this.data.currentProjectId) return;
    switchProject(projectId);
  },

  /**
   * 进入网页版：把登录响应里的网页端 JWT（`web_access_token`）直接交给 `/web-open`，不再额外换票。
   *
   * 小程序登录时后端同时下发两枚令牌：小程序自己用的 `mini_program` 令牌，以及给网页端用的
   * `management_access` 令牌（与网页密码登录同款、同一用户与权限位）。网页拿到后者后直接当
   * 管理端登录态用（用户信息仍由网页 `/auth/me` 拉取）。网页地址也来自登录响应
   * （`web_base_url`，后端 `APP_WEB_BASE_URL`），所以这里不需要为了拿地址再请求一次接口。
   *
   * 兼容：后端未配置 `APP_WEB_BASE_URL`、或旧版登录响应没有 `web_access_token` / `web_base_url`
   * 时，回退到 `/auth/web-open/tickets` 一次性票据，票据 2 分钟有效、只能兑换一次。
   *
   * 为什么走中转小程序：本小程序的主体类型不支持 `web-view` 组件，没法自己内嵌网页；
   * 御坂学习小程序专门用 `web-view` 承载任意已配置域名的 H5，因此用
   * `wx.openEmbeddedMiniProgram` 半屏打开它，由它加载带 token 的 `/web-open` 地址。
   * 中转小程序不可用时直接提示失败（没有 web-view 兜底页）。
   */
  async openWebVersion() {
    if (this.data.openingWeb) return;
    this.setData({ openingWeb: true });
    try {
      const session = await getApp().globalData.authPromise;
      const webToken = String((session && session.web_access_token) || '');
      const webBaseUrl = String((session && session.web_base_url) || '').replace(/\/+$/, '');
      let url = '';
      if (webToken && webBaseUrl) {
        const projectId = getCurrentProjectId();
        const query = [`token=${encodeURIComponent(webToken)}`, 'path=/'];
        if (projectId) query.push(`project_id=${projectId}`);
        url = `${webBaseUrl}/web-open?${query.join('&')}`;
      } else {
        // 兼容旧后端 / 未配置网页地址：仍用一次性票据换拼好的地址。
        const result = await request({
          url: '/auth/web-open/tickets',
          method: 'POST',
          data: { path: '/' },
        });
        if (!result || !result.url) throw new Error(t('webOpenFailed'));
        url = result.url;
      }
      const webPath = `/packages/static-package/pages/web/web?url=${encodeURIComponent(url)}`;
      const opened = await new Promise((resolve) => {
        wx.openEmbeddedMiniProgram({
          appId: WEB_VERSION_APP_ID,
          path: webPath,
          envVersion: 'release',
          allowFullScreen: true,
          success: () => resolve(true),
          fail: () => resolve(false),
        });
      });
      if (!opened) throw new Error(t('webOpenFailed'));
    } catch (error) {
      Toast({
        context: this,
        selector: '#profile-toast',
        message: (error && error.message) || t('webOpenFailed'),
        theme: 'error',
        direction: 'column',
      });
    } finally {
      this.setData({ openingWeb: false });
    }
  },
});
