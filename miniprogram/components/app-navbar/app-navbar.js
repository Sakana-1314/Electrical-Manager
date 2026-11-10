/**
 * 全站统一导航栏：TDesign t-navbar 的薄封装。
 *
 * - 页面统一 `navigationStyle: custom`，由本组件承担状态栏、胶囊避让与标题渲染；
 * - 无历史可返回时（分享 / 直接打开）回首页，避免停在无法退出的死页面。
 */
Component({
  properties: {
    title: { type: String, value: '' },
    back: { type: Boolean, value: true },
    delta: { type: Number, value: 1 },
  },

  methods: {
    onBackFail() {
      wx.reLaunch({ url: '/pages/home/home' });
    },
  },
});
