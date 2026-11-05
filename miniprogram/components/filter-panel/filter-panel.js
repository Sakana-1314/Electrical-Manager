/**
 * 列表页筛选面板：搜索框 + 「筛选」按钮 + 已选条件 + 底部筛选面板。
 *
 * 小程序列表页的筛选维度一多，常驻一行下拉就会把首屏挤满。这里把筛选收进底部弹层：
 * 收起态只占一行「搜索 + 筛选按钮（带已选数量）」，已选条件用一行可单删的胶囊回显。
 *
 * 分字段搜索 = **多个字段组合搜索**（与网页端「每个字段一个输入框」完全一致）：
 * 面板顶部把该页的每个字段都列成一个输入框，填哪几个就同时满足哪几个（AND），
 * 留空的字段不参与过滤。字段全部显式可见，不存在「看起来像多字段、实际只有一个生效」。
 *
 * 收起态的搜索框只做综合搜索（跨字段 OR），不放字段选择器——组合搜索统一在面板里做，
 * 避免两个入口语义重叠。
 *
 * 组件只管交互，取数仍由页面负责：
 * - `sections` 由页面按自己的维度组装，见 buildSection；
 * - 面板里改的值都进草稿，点「确定」才发 `change`；
 *   已选条件胶囊上的 × 与「清除筛选」立即发 `change`。
 * - 搜索框的输入 / 回车发 `search`，页面自己做防抖后取数。
 */
const { getMessages } = require('../../utils/i18n');

/** 分区类型：单选胶囊 / 多选胶囊 / 数值区间 / 日期区间。 */
const KIND_SINGLE = 'single';
const KIND_MULTI = 'multi';
const KIND_RANGE = 'range';
const KIND_DATE_RANGE = 'dateRange';

Component({
  properties: {
    /** 搜索框当前值（综合搜索，页面持有，便于分享参数回填）。 */
    keyword: { type: String, value: '' },
    placeholder: { type: String, value: '' },
    /**
     * 分字段搜索的字段清单：[{ key, label, placeholder }]。
     *
     * 每个字段渲染成一个输入框，多字段同时填写即组合搜索（AND）。
     * 为空数组时不渲染该区块（该页没有分字段搜索）。
     */
    fieldDefs: {
      type: Array,
      value: [],
      observer(defs) {
        this.setData({ fieldDefsView: (defs || []).slice() });
        this.refresh();
      },
    },
    /** 已生效的分字段值：`{ [fieldKey]: value }`，空串表示该字段不参与过滤。 */
    fieldValues: {
      type: Object,
      value: {},
      observer(values) {
        if (!this.data.visible) {
          this.setData({ draftFields: { ...(values || {}) } });
        }
        this.refresh();
      },
    },
    /** 筛选分区：[{ key, title, kind, options }]，见 buildSection。 */
    sections: {
      type: Array,
      value: [],
      observer() {
        this.refresh();
      },
    },
    /** 已生效的筛选值：`{ [sectionKey]: string | string[] | {from,to} }`，空值表示不限。 */
    active: {
      type: Object,
      value: {},
      observer(active) {
        // 面板打开时用户正在改草稿：此时外部同步过来的值不能覆盖草稿。
        if (!this.data.visible) {
          this.setData({ draft: cloneFilters(active || {}) });
        }
        this.refresh();
      },
    },
    /**
     * 选项加载失败：由页面在 filter-options 请求失败时置 true。
     *
     * 候选值拉不到时面板只剩「全部」，用户分不清是「没有可选项」还是「加载失败」；
     * 这里在面板里给一行可点重试的提示，而不是弹一个打断式的 toast
     * （列表本身是好的，弹错误提示会让人以为页面坏了）。
     */
    optionsFailed: { type: Boolean, value: false },
  },

  data: {
    visible: false,
    /** 面板内的草稿值，点「确定」才回传给页面。 */
    draft: {},
    /** 面板内的分字段草稿：`{ [fieldKey]: value }`。 */
    draftFields: {},
    /** 字段清单 + 当前值（WXML 里直接读）。 */
    fieldDefsView: [],
    fieldRows: [],
    /** 带选中标记的分区视图（WXML 里直接读，避免模板内做对象下标比较）。 */
    sectionsView: [],
    activeCount: 0,
    /** 日期区间选择器的弹层状态与临时值。 */
    datePickerVisible: false,
    datePickerValue: '',
    datePickerSection: '',
    datePickerBound: '',
    // t-picker / date-time-picker 从底部面板内打开，需抬高面板与遮罩层级。
    pickerPopupProps: { zIndex: 11700, overlayProps: { zIndex: 11600 } },
    i18n: getMessages(),
  },

  methods: {
    /** 由 sections / active / draft / 分字段派生视图与胶囊。 */
    refresh() {
      const sections = this.data.sections || [];
      const active = this.data.active || {};
      const draft = this.data.draft || {};
      const fieldValues = this.data.fieldValues || {};
      const draftFields = this.data.draftFields || {};
      const defs = this.data.fieldDefs || [];

      const sectionsView = sections.map((section) => {
        const kind = section.kind || KIND_SINGLE;
        const current = draft[section.key];
        const selectedValues = kind === KIND_MULTI ? current || [] : [];
        return {
          key: section.key,
          title: section.title,
          kind,
          fromLabel: section.fromLabel || '',
          toLabel: section.toLabel || '',
          rangeFrom: current && current.from !== undefined ? current.from : '',
          rangeTo: current && current.to !== undefined ? current.to : '',
          options: (section.options || []).map((option) => ({
            label: option.label,
            value: option.value,
            selected: kind === KIND_MULTI
              ? selectedValues.indexOf(option.value) >= 0
              : (current || '') === option.value,
          })),
        };
      });

      // 分字段输入框：组件是受控的，值取自草稿（打开面板后改的就是草稿）。
      const fieldRows = defs.map((def) => ({
        key: def.key,
        label: def.label,
        placeholder: def.placeholder || '',
        value: draftFields[def.key] || '',
      }));

      // 只数生效条件的个数给筛选按钮做角标；具体条件在面板里看（收起态不再铺一行胶囊）。
      let activeCount = 0;
      defs.forEach((def) => {
        if (String(fieldValues[def.key] || '').trim()) activeCount += 1;
      });
      sections.forEach((section) => {
        const kind = section.kind || KIND_SINGLE;
        const value = active[section.key];
        if (kind === KIND_MULTI) {
          activeCount += (value || []).length;
          return;
        }
        if (kind === KIND_RANGE || kind === KIND_DATE_RANGE) {
          if (value && (value.from || value.to)) activeCount += 1;
          return;
        }
        if (value) activeCount += 1;
      });

      this.setData({ sectionsView, fieldRows, activeCount });
    },

    onSearchInput(event) {
      this.triggerEvent('search', { value: event.detail.value || '' });
    },

    onSearchSubmit(event) {
      this.triggerEvent('search', { value: (event.detail && event.detail.value) || '' });
    },

    // ---------------- 分字段组合搜索 ----------------

    /** 输入某个字段：只改草稿，点「确定」才生效。 */
    onFieldInput(event) {
      const { field } = event.currentTarget.dataset;
      if (!field) return;
      const draftFields = { ...this.data.draftFields };
      draftFields[field] = (event.detail && event.detail.value) || '';
      this.setData({ draftFields });
      this.refresh();
    },

    /** 清空某个字段（输入框右侧的 ×）。 */
    clearField(event) {
      const { field } = event.currentTarget.dataset;
      if (!field) return;
      const draftFields = { ...this.data.draftFields };
      delete draftFields[field];
      this.setData({ draftFields });
      this.refresh();
    },

    // ---------------- 面板开关 ----------------

    openSheet() {
      this.setData({
        visible: true,
        draft: cloneFilters(this.data.active || {}),
        draftFields: { ...(this.data.fieldValues || {}) },
      });
      this.refresh();
    },

    closeSheet() {
      this.setData({ visible: false });
    },

    onVisibleChange(event) {
      this.setData({ visible: !!event.detail.visible });
    },

    // ---------------- 单选项 ----------------

    /** 单选：再点同一个已选项等于取消该条件。 */
    selectOption(event) {
      const { section, value } = event.currentTarget.dataset;
      if (!section) return;
      const draft = { ...this.data.draft };
      draft[section] = draft[section] === value ? '' : value;
      this.setData({ draft });
      this.refresh();
    },

    /** 多选：点一下加入 / 移出。 */
    toggleOption(event) {
      const { section, value } = event.currentTarget.dataset;
      if (!section || !value) return;
      const draft = { ...this.data.draft };
      const current = Array.isArray(draft[section]) ? draft[section].slice() : [];
      const index = current.indexOf(value);
      if (index >= 0) current.splice(index, 1);
      else current.push(value);
      draft[section] = current;
      this.setData({ draft });
      this.refresh();
    },

    // ---------------- 区间 ----------------

    onRangeInput(event) {
      const { section, bound } = event.currentTarget.dataset;
      if (!section || !bound) return;
      const draft = { ...this.data.draft };
      const current = { ...(draft[section] || {}) };
      current[bound] = (event.detail && event.detail.value) || '';
      draft[section] = current;
      this.setData({ draft });
      this.refresh();
    },

    // ---------------- 日期区间 ----------------

    /** 打开日期选择器：默认停在该端点已有的值上，没有就停在今天。 */
    openDatePicker(event) {
      const { section, bound } = event.currentTarget.dataset;
      if (!section || !bound) return;
      const current = (this.data.draft || {})[section] || {};
      const existing = current[bound] || toDateString(new Date());
      this.setData({
        datePickerVisible: true,
        datePickerSection: section,
        datePickerBound: bound,
        datePickerValue: existing,
      });
    },

    onDatePickerConfirm(event) {
      const value = (event.detail && event.detail.value) || this.data.datePickerValue;
      const { datePickerSection: section, datePickerBound: bound } = this.data;
      this.setData({ datePickerVisible: false });
      if (!section || !bound) return;
      const draft = { ...this.data.draft };
      const current = { ...(draft[section] || {}) };
      current[bound] = value;
      draft[section] = current;
      this.setData({ draft });
      this.refresh();
    },

    onDatePickerVisibleChange(event) {
      this.setData({ datePickerVisible: !!event.detail.visible });
    },

    // ---------------- 确认 / 重置 / 胶囊 ----------------

    resetDraft() {
      this.setData({ draft: {}, draftFields: {} });
      this.refresh();
    },

    confirmSheet() {
      const values = normalizeDraft(this.data.draft, this.data.sections || []);
      const fields = trimFields(this.data.draftFields, this.data.fieldDefs || []);
      this.setData({ visible: false });
      this.triggerEvent('change', { values, fields });
    },

    /** 选项加载失败时的「重新加载」：页面收到后重拉 filter-options 并重建分区。 */
    retryOptions() {
      this.triggerEvent('retryoptions');
    },
  },
});

/** 深拷贝筛选值（含数组与区间对象），避免草稿与已生效值共享引用。 */
function cloneFilters(filters) {
  const out = {};
  Object.keys(filters || {}).forEach((key) => {
    const value = filters[key];
    if (Array.isArray(value)) out[key] = value.slice();
    else if (value && typeof value === 'object') out[key] = { ...value };
    else out[key] = value;
  });
  return out;
}

/** 提交前把草稿归一：空的区间对象 / 空数组直接去掉，避免把「没选」当成条件发出去。 */
function normalizeDraft(draft, sections) {
  const out = {};
  sections.forEach((section) => {
    const kind = section.kind || KIND_SINGLE;
    const value = draft[section.key];
    if (kind === KIND_MULTI) {
      if (Array.isArray(value) && value.length) out[section.key] = value.slice();
      return;
    }
    if (kind === KIND_RANGE || kind === KIND_DATE_RANGE) {
      const from = value && value.from ? String(value.from).trim() : '';
      const to = value && value.to ? String(value.to).trim() : '';
      if (from || to) out[section.key] = { from, to };
      return;
    }
    if (value) out[section.key] = value;
  });
  return out;
}

/** 提交前去掉空字段：只保留真正填了值的，避免空串参与过滤。 */
function trimFields(fieldValues, defs) {
  const out = {};
  defs.forEach((def) => {
    const value = String((fieldValues && fieldValues[def.key]) || '').trim();
    if (value) out[def.key] = value;
  });
  return out;
}

/** 本地日期字符串（YYYY-MM-DD），日期选择器的初始值与提交格式都用它。 */
function toDateString(date) {
  const pad = (part) => String(part).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

module.exports = { KIND_SINGLE, KIND_MULTI, KIND_RANGE, KIND_DATE_RANGE };
