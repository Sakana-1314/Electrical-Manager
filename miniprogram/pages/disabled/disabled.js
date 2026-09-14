const { getMessages, setNavigationBarTitle } = require('../../utils/i18n');
const { withTheme } = require('../../utils/theme');

Page(withTheme({
  data: { i18n: getMessages() },
  onLoad() {
    setNavigationBarTitle('disabledTitle');
  },
  onShow() {
    if (typeof wx.hideHomeButton === 'function') {
      wx.hideHomeButton();
    }
  },
}));
