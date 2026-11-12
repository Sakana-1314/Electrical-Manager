const { loginSilently } = require('./utils/auth');
const { request } = require('./utils/request');
const { DEFAULT_MODES } = require('./utils/features');
const { getMessages, initializeI18n } = require('./utils/i18n');

App({
  globalData: {
    authPromise: null,
    pendingMaterialUuid: '',
    user: null,
    accountDisabled: false,
    runtimeModes: null,
    runtimeSettingsPromise: null,
    locale: 'zh-CN',
    messages: getMessages(),
  },

  onLaunch() {
    this.globalData.locale = initializeI18n();
    this.globalData.messages = getMessages();
    this.globalData.runtimeSettingsPromise = request({
      url: '/system-settings/mini-program-features',
      auth: false,
    })
      .then((modes) => {
        this.globalData.runtimeModes = modes || DEFAULT_MODES;
        return this.globalData.runtimeModes;
      })
      .catch(() => {
        this.globalData.runtimeModes = DEFAULT_MODES;
        return DEFAULT_MODES;
      });
    this.installAuthPromise();
    this.globalData.authPromise = this.startLogin();
  },

  /**
   * authPromise 做成访问器：登录失败（弱网、微信接口抖动）后，下一个读取它的页面会自动重新登录。
   * 原来失败的 Promise 会一直留在 globalData 上，登录请求是 POST 不自动重试，
   * 于是一次失败就让所有页面都卡在报错里，直到用户杀掉小程序重进。
   * 页面照旧 `await getApp().globalData.authPromise`，无需改动；storeSession 里的赋值走 setter。
   */
  installAuthPromise() {
    const data = this.globalData;
    let current = null;
    let failed = false;
    const markFailed = (promise) => {
      promise.catch(() => {
        if (current === promise) failed = true;
      });
      return promise;
    };
    Object.defineProperty(data, 'authPromise', {
      configurable: true,
      enumerable: true,
      get: () => {
        if (failed) {
          failed = false;
          current = markFailed(this.startLogin());
        }
        return current;
      },
      set: (value) => {
        failed = false;
        current = value ? markFailed(value) : value;
      },
    });
  },

  startLogin() {
    return loginSilently()
      .then((session) => {
        this.globalData.user = session.user;
        return session;
      })
      .catch((error) => {
        if (!['ACCOUNT_DISABLED', 'MINI_PROGRAM_REGISTRATION_DISABLED'].includes(error.code)) {
          throw error;
        }
        wx.removeStorageSync('miniProgramAccessToken');
        wx.removeStorageSync('miniProgramRegistrationToken');
        wx.removeStorageSync('miniProgramUser');
        if (error.code === 'ACCOUNT_DISABLED') {
          this.globalData.accountDisabled = true;
          wx.reLaunch({ url: '/pages/disabled/disabled' });
          return { account_disabled: true, user: null, requires_profile: false };
        }
        wx.reLaunch({ url: '/pages/registration-closed/registration-closed' });
        return { registration_disabled: true, user: null, requires_profile: false };
      });
  },

  onPageNotFound() {
    wx.reLaunch({ url: '/pages/home/home' });
  },
});
