const { getMessages } = require('../../utils/i18n');

Page({
  data: { i18n: getMessages() },
  onLoad() {
  },
  onShow() {
    if (typeof wx.hideHomeButton === 'function') {
      wx.hideHomeButton();
    }
  },
});
