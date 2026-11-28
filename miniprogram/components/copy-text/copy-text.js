const toastModule = require('tdesign-miniprogram/toast/index');
const { getMessages, t } = require('../../utils/i18n');
const Toast = toastModule.default || toastModule;

/**
 * 可点击复制的字段值：值非空时按虚线下划线展示，点击整段写入剪贴板并提示「已复制」。
 * 空值不渲染任何节点（与详情页「空字段留空」的口径一致）。
 */
Component({
  properties: {
    value: {
      type: String,
      value: '',
    },
  },
  methods: {
    onCopy() {
      const value = String(this.data.value || '');
      if (!value) return;
      wx.setClipboardData({
        data: value,
        success: () => {
          Toast({
            context: this,
            selector: '#copy-text-toast',
            message: t('copied'),
            theme: 'success',
            direction: 'column',
          });
        },
      });
    },
  },
});
