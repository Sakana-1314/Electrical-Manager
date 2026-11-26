const toastModule = require('tdesign-miniprogram/toast/index');
const { getMessages, t } = require('../../utils/i18n');
const {
  FIELD_KEYS,
  WORD_MAX,
  normalizeFields,
  orderedWords,
  readSettings,
  writeSettings,
} = require('../../utils/watermark');
const Toast = toastModule.default || toastModule;

/**
 * 水印四行的排版：字号与行距都以照片宽度的 1% 为单位，
 * 任意分辨率下相对比例一致，实时叠加层与 Canvas 成品共用同一组比例。
 */
const MARK_ROWS = {
  time: { size: 9.5, weight: '600', lead: 11 },
  dateWeek: { size: 4, weight: 'normal', lead: 6 },
  location: { size: 4.2, weight: 'normal', lead: 6.4 },
  matter: { size: 5.2, weight: '600', lead: 7.2 },
};

/** 保存到相册的成品宽度上限：现场记录够用，也不会因为超长边撑爆单次合成内存。 */
const OUTPUT_MAX_WIDTH = 1440;

/** 白字 + 底部阴影：canvas 里没有主题令牌，色值集中在这里，避免散落在绘制逻辑里。 */
const MARK_TEXT_STRONG = 'rgba(255, 255, 255, 1)';
const MARK_TEXT_SOFT = 'rgba(255, 255, 255, 0.94)';
const MARK_SHADOW = 'rgba(0, 0, 0, 0.6)';
const MARK_BAND = ['rgba(0, 0, 0, 0)', 'rgba(0, 0, 0, 0.5)'];

Page({
  data: {
    // shoot：先拍后写（定格一张再写文案）；write：先写后拍（文案定稿后实时叠加取景）。
    mode: 'shoot',
    devicePosition: 'back',
    flash: 'off',
    zoom: 1,
    maxZoom: 8,
    zooming: false,
    zoomText: '1x',

    popupVisible: false,
    busy: false,
    pending: '',
    armed: false,

    // 水印项目各自是否启用：进页面时取本机设置的「默认启用」，拍摄中可临时改。
    fields: normalizeFields(null),
    location: '',
    matter: '',
    clock: { date: '', time: '', week: '' },
    // 实时叠加层与 Canvas 共用的四行文本（空串表示该行不显示）。
    mark: { time: '', dateWeek: '', locationLine: '', matter: '' },

    words: [],
    matterCursor: -1,
    matterFocus: false,
    keyboardHeight: 0,
    reviewImageStyle: '',
    reviewMarkStyle: '',

    i18n: getMessages(),
  },

  onLoad() {
    this.ensurePermission();
    this.applySettings();
  },

  /**
   * 回到页面时重读本机设置：从「水印设置」页改完常用词 / 默认开关后返回即生效。
   *
   * 拍摄中途（已定格或已定稿）不覆盖现场改过的开关，免得把当前这次拍摄的选择冲掉。
   */
  onShow() {
    if (this.data.busy || this.data.pending || this.data.armed) return;
    this.applySettings();
  },

  onReady() {
    this.onKeyboardHeight = (res) => this.setKeyboardHeight(res.height || 0);
    wx.onKeyboardHeightChange(this.onKeyboardHeight);
    this.refreshClock();
    this.layoutReviewImage();
  },

  onUnload() {
    clearTimeout(this._blurTimer);
    if (this.onKeyboardHeight) wx.offKeyboardHeightChange(this.onKeyboardHeight);
  },

  /** 读本机设置：常用词按「置顶在前、其余保持原顺序」排好，水印项目回到默认启用值。 */
  applySettings() {
    let settings;
    try {
      settings = readSettings();
    } catch (error) {
      console.error('读取水印设置失败', error);
      this.showError(t('watermarkReadFailed'));
      return;
    }
    this.setData(
      { words: orderedWords(settings), fields: normalizeFields(settings.fields) },
      () => this.refreshMark(),
    );
  },

  /** 进页面先申请「摄像头 + 相册」授权：只对尚未决定过的权限弹窗，已拒绝的不反复打扰。 */
  ensurePermission() {
    const scopes = ['scope.camera', 'scope.writePhotosAlbum'];
    wx.getSetting()
      .then(({ authSetting = {} }) => {
        const undecided = scopes.filter((scope) => authSetting[scope] === undefined);
        const next = (index) => {
          if (index >= undecided.length) return;
          wx.authorize({
            scope: undecided[index],
            success: () => next(index + 1),
            fail: () => next(index + 1),
          });
        };
        next(0);
      })
      .catch((error) => console.error('读取授权状态失败', error));
  },

  /** 取一次当前时间并刷新水印文本：拍摄、定稿、进入页面各刷新一次。 */
  refreshClock() {
    const now = new Date();
    const pad = (part) => String(part).padStart(2, '0');
    this.setData(
      {
        clock: {
          date: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
          time: `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`,
          week: t(`weekday${now.getDay()}`),
        },
      },
      () => this.refreshMark(),
    );
  },

  /**
   * 按启用的项目拼出四行水印文本，自上而下：时间 → 日期 星期 → 地点 → 文案。
   *
   * 实时叠加层与 Canvas 成品都读这一份结果，两处永远一致；某行没内容时整行不占位，
   * 不会在照片上留下空白行。
   */
  refreshMark() {
    const { fields, clock, location, matter } = this.data;
    const dateWeek = [fields.date ? clock.date : '', fields.week ? clock.week : '']
      .filter(Boolean)
      .join(' ');
    this.setData({
      mark: {
        time: fields.time ? clock.time : '',
        dateWeek,
        locationLine: fields.location && location
          ? t('watermarkLocationLine', { location })
          : '',
        matter: fields.matter ? matter : '',
      },
    });
  },

  switchMode(e) {
    const mode = e.currentTarget.dataset.mode;
    if (mode === this.data.mode) return;
    this.setData({ mode, popupVisible: false, pending: '', armed: false, keyboardHeight: 0 });
    if (mode === 'write') this.setData({ popupVisible: true });
  },

  toggleFlash() {
    this.setData({ flash: this.data.flash === 'off' ? 'torch' : 'off' });
  },

  switchCamera() {
    this.setData({ devicePosition: this.data.devicePosition === 'back' ? 'front' : 'back' });
  },

  onCameraError(error) {
    console.error('相机启动失败', error.detail);
    this.showError(t('watermarkCameraFailed'));
  },

  onInitDone(e) {
    const maxZoom = e.detail && e.detail.maxZoom;
    if (maxZoom > 1) this.setData({ maxZoom: Math.min(maxZoom, 10) });
  },

  /** 变焦：手势时 60ms 节流调原生 setZoom，档位点击与手势收尾始终同步到原生。 */
  setZoom(zoom, fromGesture = false) {
    const next = Math.min(this.data.maxZoom, Math.max(1, Math.round(zoom * 10) / 10));
    this.setData({ zoom: next, zoomText: `${next}x`, zooming: fromGesture });
    if (fromGesture) {
      const now = Date.now();
      if (this._lastZoomAt && now - this._lastZoomAt < 60) return;
      this._lastZoomAt = now;
    }
    wx.createCameraContext().setZoom({ zoom: next });
  },

  setZoomStep(e) {
    this.setZoom(Number(e.currentTarget.dataset.zoom));
  },

  pinchDistance(touches) {
    return Math.hypot(
      touches[0].clientX - touches[1].clientX,
      touches[0].clientY - touches[1].clientY,
    );
  },

  zoomStart(e) {
    if (e.touches.length !== 2) return;
    this._pinchDistance = this.pinchDistance(e.touches);
    this._pinchZoom = this.data.zoom;
  },

  zoomMove(e) {
    if (e.touches.length !== 2 || !this._pinchDistance) return;
    this.setZoom((this._pinchZoom * this.pinchDistance(e.touches)) / this._pinchDistance, true);
  },

  zoomEnd() {
    this._pinchDistance = 0;
    this.setData({ zooming: false });
    this.setZoom(this.data.zoom);
  },

  /** 拍摄页临时开关某个水印项目：只影响本次拍摄，不改本机默认设置。 */
  toggleField(e) {
    const key = e.currentTarget.dataset.field;
    if (!FIELD_KEYS.includes(key)) return;
    this.setData({ [`fields.${key}`]: e.detail.value }, () => this.refreshMark());
  },

  onLocationInput(e) {
    this.setData({ location: e.detail.value }, () => this.refreshMark());
  },

  /** 文案输入：记下光标位置，常用词才能插到光标处而不是一律追加到末尾。 */
  onMatterInput(e) {
    const value = e.detail.value || '';
    this._matterCursor = typeof e.detail.cursor === 'number' ? e.detail.cursor : value.length;
    this.setData({ matter: value }, () => this.refreshMark());
  },

  onMatterFocus() {
    this._matterFocused = true;
    clearTimeout(this._blurTimer);
  },

  onMatterBlur() {
    this._matterFocused = false;
    // 部分机型收起键盘不上报高度：失焦后兜底复位，避免表单一直让位。
    clearTimeout(this._blurTimer);
    this._blurTimer = setTimeout(() => {
      if (!this._matterFocused) this.setKeyboardHeight(0);
    }, 250);
  },

  onKeyboardChange(e) {
    this.setKeyboardHeight(e.detail.height || 0);
  },

  setKeyboardHeight(height) {
    if (height === this.data.keyboardHeight) return;
    this.setData({ keyboardHeight: height }, () => this.measureReviewForm());
  },

  /** 量取表单高度：键盘弹出时按剩余空间压小预览图，表单跟着键盘上移。 */
  measureReviewForm() {
    wx.createSelectorQuery()
      .select('.review-form')
      .boundingClientRect()
      .exec((res) => {
        const rect = res && res[0];
        if (!rect || !rect.height) return;
        this._formHeight = rect.height;
        this.layoutReviewImage();
      });
  },

  /** 预览图按可用空间等比缩放（3:4），水印叠加层按同一比例缩放，所见即所得。 */
  layoutReviewImage() {
    const info = typeof wx.getWindowInfo === 'function' ? wx.getWindowInfo() : wx.getSystemInfoSync();
    const maxWidth = info.windowWidth * 0.6;
    const maxHeight = (maxWidth * 4) / 3;
    const keyboardHeight = this.data.keyboardHeight;
    if (keyboardHeight && !this._formHeight) this.measureReviewForm();
    const free = keyboardHeight && this._formHeight
      ? info.windowHeight - keyboardHeight - this._formHeight
      : maxHeight;
    const height = Math.min(maxHeight, Math.max(free, maxHeight / 2));
    const scale = height / maxHeight;
    this.setData({
      reviewImageStyle: `width: ${(height * 3) / 4}px; height: ${height}px`,
      reviewMarkStyle: scale === 1 ? '' : `width: calc(100% / ${scale}); transform: scale(${scale})`,
    });
  },

  chooseLocation() {
    wx.chooseLocation()
      .then((res) => {
        const location = `${res.name || ''}${res.address || ''}`.trim();
        if (location) this.setData({ location }, () => this.refreshMark());
      })
      .catch(() => this.showInfo(t('watermarkLocationCancelled')));
  },

  /** 点常用词插入到文案光标处：插入后把焦点还给输入框，光标停在词尾继续打字。 */
  insertWord(e) {
    const word = e.currentTarget.dataset.word;
    if (!word) return;
    const value = this.data.matter || '';
    const caret = Math.min(Math.max(this._matterCursor >= 0 ? this._matterCursor : value.length, 0), value.length);
    const next = value.slice(0, caret) + word + value.slice(caret);
    const cursor = caret + word.length;
    this._matterCursor = cursor;
    if (!this._matterFocused) {
      this.setData({ matter: next, matterCursor: cursor }, () => this.refreshMark());
      return;
    }
    this.setData({ matter: next, matterCursor: cursor, matterFocus: false }, () => {
      this.setData({ matterFocus: true }, () => this.refreshMark());
    });
  },

  /** 把当前文案存为常用词（去重、限长），并写回本机设置。 */
  addWord() {
    const word = (this.data.matter || '').trim();
    if (!word) return this.showInfo(t('watermarkWordNeedMatter'));
    if (word.length > WORD_MAX) {
      return this.showInfo(t('watermarkWordTooLong', { count: WORD_MAX }));
    }
    const settings = readSettings();
    if (settings.words.includes(word)) return this.showInfo(t('watermarkWordExisted'));
    settings.words = settings.words.concat(word);
    const saved = writeSettings(settings);
    this.setData({ words: orderedWords(saved) });
    this.showInfo(t('watermarkSettingsSaved'), 'success');
  },

  /** 长按常用词：确认后删除，同时把它从置顶列表里摘掉，两处设置不会打架。 */
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
        const saved = writeSettings(settings);
        this.setData({ words: orderedWords(saved) });
        this.showInfo(t('watermarkWordDeleted'), 'success');
      },
    });
  },

  openForm() {
    this.setData({ popupVisible: true });
  },

  closeForm() {
    this.setData({ popupVisible: false, mode: 'shoot', armed: false, keyboardHeight: 0 });
  },

  onPopupChange(e) {
    if (!e.detail.visible) this.closeForm();
  },

  /** 先写后拍：文案定稿后把水印叠到实时画面，点快门直接合成保存。 */
  onFormConfirm() {
    this.setData({ armed: true, popupVisible: false, keyboardHeight: 0 });
    this.refreshClock();
  },

  /** 点快门：先拍后写定格一张进评审；先写后拍在定稿后直接合成。 */
  shoot() {
    if (this.data.busy) return;
    if (this.data.mode === 'shoot') {
      this.takePhoto((path) => {
        this.setData({ pending: path }, () => this.measureReviewForm());
        this.refreshClock();
      });
      return;
    }
    if (this.data.armed) {
      this.takePhoto((path) => this.composeAndSave(path));
      return;
    }
    this.setData({ popupVisible: true });
  },

  takePhoto(callback) {
    wx.createCameraContext()
      .takePhoto({
        quality: 'high',
        success: (res) => {
          const path = res.tempImagePath || res.tempPhotoPath;
          if (!path) return this.showError(t('watermarkPhotoMissing'));
          callback(path);
        },
        fail: (error) => {
          console.error('拍摄失败', error);
          this.showError(t('watermarkTakeFailed'));
        },
      });
  },

  retake() {
    this.setData({ pending: '', keyboardHeight: 0 });
  },

  saveReview() {
    if (this.data.busy || !this.data.pending) return;
    this.composeAndSave(this.data.pending);
  },

  /** 把照片与水印画进离屏 canvas，导出临时文件后存相册。 */
  composeAndSave(path) {
    if (!path || this.data.busy) return;
    this.setData({ busy: true });
    wx.showLoading({ title: t('watermarkShooting'), mask: true });

    wx.createSelectorQuery()
      .select('#watermark-canvas')
      .fields({ node: true, size: true })
      .exec((res) => {
        const canvas = res && res[0] && res[0].node;
        if (!canvas) return this.finish(t('watermarkCanvasFailed'));
        const ctx = canvas.getContext('2d');
        if (!ctx) return this.finish(t('watermarkCanvasFailed'));
        const image = canvas.createImage();
        image.onload = () => {
          try {
            this.drawWatermark(canvas, ctx, image);
          } catch (error) {
            console.error('绘制水印失败', error);
            return this.finish(t('watermarkComposingFailed'));
          }
          const width = canvas.width;
          const height = canvas.height;
          wx.canvasToTempFilePath({
            canvas,
            x: 0,
            y: 0,
            width,
            height,
            success: (out) => this.saveToAlbum(out.tempFilePath),
            fail: (error) => {
              console.error('合成失败', error);
              this.finish(t('watermarkComposingFailed'));
            },
          });
        };
        image.onerror = (error) => {
          console.error('图片读取失败', error);
          this.finish(t('watermarkPhotoReadFailed'));
        };
        image.src = path;
      });
  },

  /**
   * 按片源尺寸绘制：照片铺满画布，左下角自下而上落笔（文案 → 地点 → 日期 星期 → 时间）。
   *
   * 所有尺寸以照片宽度的 1% 为单位，所以 4:3 / 16:9、前置后置、任意分辨率下
   * 水印的相对位置与字号比例都一致。
   */
  drawWatermark(canvas, ctx, image) {
    const sourceWidth = image.width;
    const sourceHeight = image.height;
    // 画布按原图比例、但长边不超过上限：手机直出 4000px+ 的照片整张解码进画布会爆内存，
    // 现场记录按 1440px 就足够清楚，水印比例不受影响（仍以画布宽度为基准）。
    const scale = Math.min(1, OUTPUT_MAX_WIDTH / sourceWidth);
    const width = Math.round(sourceWidth * scale);
    const height = Math.round(sourceHeight * scale);
    canvas.width = width;
    canvas.height = height;
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(image, 0, 0, width, height);

    const rows = this.buildMarkRows();
    if (!rows.length) return;

    const unit = width / 100;
    const padX = 5 * unit;
    const padBottom = 6 * unit;
    const totalLead = rows.reduce((sum, row) => sum + row.lead * unit, 0);
    const bandTop = height - padBottom - totalLead - 2 * unit;

    // 底部由透明到半透明的渐变带：白字压在亮画面上也能读清。
    const gradient = ctx.createLinearGradient(0, bandTop, 0, height);
    gradient.addColorStop(0, MARK_BAND[0]);
    gradient.addColorStop(1, MARK_BAND[1]);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, bandTop, width, height - bandTop);

    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.shadowColor = MARK_SHADOW;
    ctx.shadowBlur = 1.2 * unit;

    let y = height - padBottom;
    for (let index = rows.length - 1; index >= 0; index -= 1) {
      const row = rows[index];
      ctx.fillStyle = row.strong ? MARK_TEXT_STRONG : MARK_TEXT_SOFT;
      ctx.font = `${row.weight} ${row.size * unit}px sans-serif`;
      ctx.fillText(row.text, padX, y);
      y -= row.lead * unit;
    }
    ctx.shadowBlur = 0;
  },

  /** Canvas 与实时叠加层共用同一份四行文本，逐行带上排版参数。 */
  buildMarkRows() {
    const { mark } = this.data;
    return [
      mark.time && { text: mark.time, strong: true, ...MARK_ROWS.time },
      mark.dateWeek && { text: mark.dateWeek, ...MARK_ROWS.dateWeek },
      mark.locationLine && { text: mark.locationLine, ...MARK_ROWS.location },
      mark.matter && { text: mark.matter, strong: true, ...MARK_ROWS.matter },
    ].filter(Boolean);
  },

  saveToAlbum(path) {
    wx.saveImageToPhotosAlbum({
      filePath: path,
      success: () => this.finish(t('watermarkSaved'), 'success'),
      fail: (error) => {
        console.error('保存相册失败', error);
        if (String(error.errMsg || '').includes('auth deny')) {
          this.setData({ busy: false });
          wx.hideLoading();
          wx.showModal({
            title: t('watermarkAlbumPermissionTitle'),
            content: t('watermarkAlbumPermissionContent'),
            confirmText: t('watermarkAlbumPermissionConfirm'),
            showCancel: false,
            success: () => wx.openSetting(),
          });
          return;
        }
        this.finish(t('watermarkSaveFailed'));
      },
    });
  },

  /** 一次拍摄流程收尾：复位忙碌与定格状态，关 loading，再给结果提示。 */
  finish(message, theme = 'none') {
    this.setData({ busy: false, pending: '', keyboardHeight: 0 });
    wx.hideLoading();
    this.showInfo(message, theme);
  },

  openSetting() {
    wx.navigateTo({ url: '/pages/watermark-setting/watermark-setting' });
  },

  /** 轻提示统一走页面里的 t-toast；theme 只在成功 / 失败时传，普通提示不传图标。 */
  showInfo(message, theme) {
    Toast({
      context: this,
      selector: '#watermark-toast',
      message,
      direction: 'column',
      ...(theme ? { theme } : {}),
    });
  },

  showError(message) {
    this.showInfo(message, 'error');
  },

  onShareAppMessage() {
    return {
      title: t('watermarkShareTitle'),
      path: '/pages/watermark-camera/watermark-camera',
      imageUrl: '/assets/share-logo.png',
    };
  },
});
