/**
 * 全站统一导航栏：TDesign t-navbar 的薄封装。
 *
 * - 页面统一 `navigationStyle: custom`，由本组件承担状态栏、胶囊避让与标题渲染；
 * - `theme-class` 由页面传入（withTheme 注入的 themeClass），让导航栏跟随明暗档位；
 * - 无历史可返回时（分享 / 直接打开）回首页，避免停在无法退出的死页面。
 */
Component({
  properties: {
    title: { type: String, value: '' },
    back: { type: Boolean, value: true },
    delta: { type: Number, value: 1 },
    themeClass: { type: String, value: '' },
  },

  methods: {
    onBackFail() {
      wx.reLaunch({ url: '/pages/home/home' });
    },
  },
});
