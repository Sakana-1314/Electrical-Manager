const toastModule = require('tdesign-miniprogram/toast/index');
const { getMessages, t } = require('../../../../utils/i18n');
const {
  FIELD_KEYS,
  normalizeFields,
  orderedWords,
  readSettings,
  writeSettings,
} = require('../../../../utils/watermark');
const Toast = toastModule.default || toastModule;

/** 水印项目在设置页的展示顺序与文案键（与 `utils/watermark.js` 的 FIELD_KEYS 同源）。 */
const FIELD_LABELS = {
  time: 'watermarkFieldTime',
  date: 'watermarkFieldDate',
  week: 'watermarkFieldWeek',
  location: 'watermarkFieldLocation',
  matter: 'watermarkFieldMatter',
};

Page({
  data: {
    words: [],
    pinned: [],
    wordCountLabel: '',
    fields: normalizeFields(null),
    // 逐项开关的渲染行：{ key, label, enabled }
    fieldRows: [],
    i18n: getMessages(),
  },

  onLoad() {
    this.loadSettings();
  },

  /** 读本机设置并铺开渲染数据：常用词按置顶在前、其余原顺序，开关行按固定顺序。 */
  loadSettings() {
    let settings;
    try {
      settings = readSettings();
    } catch (error) {
      console.error('读取水印设置失败', error);
      this.showError(t('watermarkReadFailed'));
      return;
    }
    this.applyToView(settings);
  },

  applyToView(settings) {
    const fields = normalizeFields(settings.fields);
    const pinnedSet = new Set(settings.pinned);
    const words = orderedWords(settings);
    this.setData({
      fields,
      pinned: settings.pinned,
      // 列表按「置顶在前」排好，每项带 pinned 标记，方便图钉与角标直接渲染。
      words: words.map((word) => ({ word, pinned: pinnedSet.has(word) })),
      wordCountLabel: t('watermarkWordCount', { count: words.length }),
      fieldRows: FIELD_KEYS.map((key) => ({
        key,
        label: t(FIELD_LABELS[key]),
        enabled: fields[key],
      })),
    });
  },

  /** 保存设置并回写视图；保存后重新归一（置顶只留存在的词、开关至少留一项）。 */
  persist(settings, message) {
    let saved;
    try {
      saved = writeSettings(settings);
    } catch (error) {
      console.error('保存水印设置失败', error);
      this.showError(t('watermarkSaveFailed'));
      return;
    }
    this.applyToView(saved);
    if (message) this.showInfo(message, 'success');
  },

  /**
   * 置顶 / 取消置顶：置顶列表本身就是显示顺序，
   * 点图钉把词放到列表最前，再点一次退回原来的常用词顺序。
   */
  togglePin(e) {
    const word = e.currentTarget.dataset.word;
    if (!word) return;
    const settings = readSettings();
    if (settings.pinned.includes(word)) {
      settings.pinned = settings.pinned.filter((item) => item !== word);
    } else {
      settings.pinned = [word].concat(settings.pinned);
    }
    this.persist(settings);
  },

  /** 长按（或「删除」）移除常用词，同时从置顶里摘掉。 */
  removeWord(e) {
    const word = e.currentTarget.dataset.word;
    if (!word) return;
    wx.showModal({
      title: t('watermarkWordDeleteTitle'),
      content: t('watermarkWordDeleteConfirm', { word }),
      success: (res) => {
        if (!res.confirm) return;
        const settings = readSettings();
        settings.words = settings.words.filter((item) => item !== word);
        settings.pinned = settings.pinned.filter((item) => item !== word);
        this.persist(settings, t('watermarkWordDeleted'));
      },
    });
  },

  /**
   * 切换某个水印项目的默认启用状态。
   *
   * 五项全关会让照片完全不带水印，没有意义也无从回退，所以最后一项不允许关，
   * 关的时候明确提示原因而不是让开关静默弹回。
   */
  toggleField(e) {
    const key = e.currentTarget.dataset.field;
    if (!FIELD_KEYS.includes(key)) return;
    const enabled = e.detail.value;
    const settings = readSettings();
    const nextFields = { ...settings.fields, [key]: enabled };
    const enabledCount = FIELD_KEYS.filter((item) => nextFields[item]).length;
    if (enabledCount === 0) {
      this.showInfo(t('watermarkFieldLockedHint'));
      this.applyToView(settings);
      return;
    }
    settings.fields = nextFields;
    this.persist(settings);
  },

  /** 「全部恢复默认」：五项都打开、保留常用词与置顶。 */
  resetFields() {
    const settings = readSettings();
    settings.fields = normalizeFields(null);
    this.persist(settings, t('watermarkSettingsSaved'));
  },

  /** 轻提示统一走页面里的 t-toast；theme 只在成功 / 失败时传，普通提示不传图标。 */
  showInfo(message, theme) {
    Toast({
      context: this,
      selector: '#watermark-setting-toast',
      message,
      direction: 'column',
      ...(theme ? { theme } : {}),
    });
  },

  showError(message) {
    this.showInfo(message, 'error');
  },
});
