/**
 * 列表页筛选面板：搜索框 + 「筛选」按钮 + 已选条件 + 底部筛选面板。
 *
 * 小程序列表页的筛选维度一多，常驻一行下拉就会把首屏挤满。这里把筛选收进底部弹层：
 * 收起态只占一行「搜索 + 筛选按钮（带已选数量）」，已选条件用一行可单删的胶囊回显。
 *
 * 分字段搜索（与网页端「每个字段一个输入框」对齐，但不占额外高度）：
 * - 搜索框左侧嵌一个字段选择器：默认「综合」= 跨字段搜；选中某个字段后，搜索框的值只作用于该字段。
 *   这一个选项就覆盖了「按型号 / 编号精确找」的最常用场景，且不增加任何常驻高度。
 * - 需要同时限定多个字段时，用面板顶部的「分字段搜索」区：一行 `[字段][值][添加]`，
 *   添加后变成可删除的条件行。条件从 1 行起按需增长，不用时不占位。
 *
 * 组件只管交互，取数仍由页面负责：
 * - `sections` 由页面按自己的维度组装，见 buildSection；
 * - 面板里改的值都进草稿，点「确定」才发 `change`；
 *   已选条件胶囊上的 × 与「清除筛选」立即发 `change`。
 * - 搜索框的输入 / 回车 / 字段切换统一发 `search`，页面自己做防抖后取数。
 */
const { getMessages } = require('../../utils/i18n');

/** 分区类型：单选胶囊 / 多选胶囊 / 数值区间 / 日期区间。 */
const KIND_SINGLE = 'single';
const KIND_MULTI = 'multi';
const KIND_RANGE = 'range';
const KIND_DATE_RANGE = 'dateRange';

Component({
  properties: {
    /** 搜索框当前值（页面持有，便于分享参数回填）。 */
    keyword: { type: String, value: '' },
    placeholder: { type: String, value: '' },
    /**
     * 搜索字段候选：[{ label, value }]，首项通常是「综合」（value 为空串）。
     * 为空数组时不渲染字段选择器（该页没有分字段搜索）。
     */
    searchFields: {
      type: Array,
      value: [],
      observer(fields) {
        this.setData({ searchFieldOptions: (fields || []).slice() });
        this.refresh();
      },
    },
    /** 当前搜索字段（空串 = 综合）。 */
    searchField: { type: String, value: '' },
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
    /** 分字段搜索条件：[{ field, value }]，field 为 searchFields 里的 value。 */
    fieldConditions: {
      type: Array,
      value: [],
      observer(conditions) {
        if (!this.data.visible) {
          this.setData({ draftConditions: cloneConditions(conditions || []) });
        }
        this.refresh();
      },
    },
  },

  data: {
    visible: false,
    /** 面板内的草稿值，点「确定」才回传给页面。 */
    draft: {},
    /** 面板内的分字段条件草稿（`[{ field, value }]`）。 */
    draftConditions: [],
    /** 带选中标记的分区视图（WXML 里直接读，避免模板内做对象下标比较）。 */
    sectionsView: [],
    /** 收起态的已选条件胶囊（含分字段条件）。 */
    chips: [],
    activeCount: 0,
    /** 分字段搜索区的「待添加」字段与值。 */
    conditionField: '',
    conditionValue: '',
    /** 字段选择器的候选与当前索引（t-picker 用）。 */
    searchFieldOptions: [],
    searchFieldIndex: 0,
    searchFieldPickerVisible: false,
    conditionFieldPickerVisible: false,
    conditionFieldLabel: '',
    /** 当前搜索字段的文案（收起态显示在字段选择器上）。 */
    searchFieldLabel: '',
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
    /** 由 sections / active / draft / 条件派生视图与胶囊。 */
    refresh() {
      const sections = this.data.sections || [];
      const active = this.data.active || {};
      const draft = this.data.draft || {};
      const conditions = this.data.fieldConditions || [];
      const searchFields = this.data.searchFields || [];

      const sectionsView = sections.map((section) => {
        const kind = section.kind || KIND_SINGLE;
        const current = draft[section.key];
        const selectedValues = kind === KIND_MULTI ? current || [] : [];
        return {
          key: section.key,
          title: section.title,
          kind,
          // 区间类分区没有 options，展示的是两个输入框 / 日期。
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

      const chips = [];
      sections.forEach((section) => {
        const kind = section.kind || KIND_SINGLE;
        const value = active[section.key];
        if (kind === KIND_MULTI) {
          (value || []).forEach((item) => {
            const matched = (section.options || []).find((option) => option.value === item);
            chips.push({ key: section.key, value: item, label: `${section.title}：${matched ? matched.label : item}` });
          });
          return;
        }
        if (kind === KIND_RANGE || kind === KIND_DATE_RANGE) {
          if (!value || (!value.from && !value.to)) return;
          const text =
            value.from && value.to
              ? `${value.from} ~ ${value.to}`
              : value.from
                ? `≥ ${value.from}`
                : `≤ ${value.to}`;
          chips.push({ key: section.key, value: '', label: `${section.title}：${text}` });
          return;
        }
        if (!value) return;
        const matched = (section.options || []).find((option) => option.value === value);
        // 分享带来的值可能已不在选项里：回显原值，别显示成「不限」。
        chips.push({ key: section.key, value: '', label: `${section.title}：${matched ? matched.label : value}` });
      });

      // 分字段条件也当作可删除的胶囊，字段名取 searchFields 的文案。
      conditions.forEach((condition, index) => {
        const field = searchFields.find((item) => item.value === condition.field);
        if (!field || !condition.value) return;
        chips.push({
          conditionIndex: index,
          label: `${field.label}：${condition.value}`,
        });
      });

      // 条件行的展示文案（WXML 里不拼字符串）。
      const draftConditions = (this.data.draftConditions || []).map((condition) => {
        const field = searchFields.find((item) => item.value === condition.field);
        return { ...condition, display: `${field ? field.label : condition.field}：${condition.value}` };
      });

      const fieldOf = (value) => searchFields.find((item) => item.value === value);
      const searchFieldLabel = (fieldOf(this.data.searchField) || {}).label || '';
      const conditionFieldLabel = (fieldOf(this.data.conditionField) || {}).label || '';

      this.setData({
        sectionsView,
        chips,
        activeCount: chips.length,
        draftConditions,
        searchFieldLabel,
        conditionFieldLabel,
      });
    },

    onSearchInput(event) {
      this.triggerEvent('search', { value: event.detail.value || '', field: this.data.searchField });
    },

    onSearchSubmit(event) {
      const value = (event.detail && event.detail.value) || '';
      this.triggerEvent('search', { value, field: this.data.searchField });
    },

    // ---------------- 搜索字段切换 ----------------

    openSearchFieldPicker() {
      const fields = this.data.searchFields || [];
      if (!fields.length) return;
      const index = Math.max(0, fields.findIndex((field) => field.value === this.data.searchField));
      this.setData({ searchFieldPickerVisible: true, searchFieldIndex: index });
    },

    onSearchFieldPickerConfirm(event) {
      const fields = this.data.searchFields || [];
      const index = Number((event.detail.value || [])[0] || 0);
      const field = fields[index];
      this.setData({ searchFieldPickerVisible: false });
      if (!field || field.value === this.data.searchField) return;
      // 切字段立即生效：搜索词保留，结果随之从「综合」切到单字段。
      this.triggerEvent('search', { value: this.data.keyword, field: field.value });
    },

    onSearchFieldPickerVisibleChange(event) {
      this.setData({ searchFieldPickerVisible: !!event.detail.visible });
    },

    // ---------------- 面板开关 ----------------

    openSheet() {
      const fields = this.data.searchFields || [];
      this.setData({
        visible: true,
        draft: cloneFilters(this.data.active || {}),
        draftConditions: cloneConditions(this.data.fieldConditions || []),
        // 分字段搜索默认停在「综合」以外的第一个字段，避免默认等于综合搜索而没有意义。
        conditionField: fields.length > 1 ? fields[1].value : fields.length ? fields[0].value : '',
        conditionValue: '',
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

    // ---------------- 分字段条件 ----------------

    openConditionFieldPicker() {
      const fields = this.data.searchFields || [];
      if (!fields.length) return;
      const index = Math.max(0, fields.findIndex((field) => field.value === this.data.conditionField));
      this.setData({ conditionFieldPickerVisible: true, searchFieldIndex: index });
    },

    onConditionFieldPickerConfirm(event) {
      const fields = this.data.searchFields || [];
      const index = Number((event.detail.value || [])[0] || 0);
      const field = fields[index];
      this.setData({ conditionFieldPickerVisible: false });
      if (!field) return;
      this.setData({ conditionField: field.value });
    },

    onConditionFieldPickerVisibleChange(event) {
      this.setData({ conditionFieldPickerVisible: !!event.detail.visible });
    },

    onConditionValueInput(event) {
      this.setData({ conditionValue: (event.detail && event.detail.value) || '' });
    },

    /** 添加一条分字段条件；同一字段再添加时覆盖原值（与网页端一个字段一个输入框一致）。 */
    addCondition() {
      const field = this.data.conditionField;
      const value = String(this.data.conditionValue || '').trim();
      if (!field || !value) return;
      const conditions = this.data.draftConditions
        .filter((condition) => condition.field !== field)
        .concat({ field, value });
      this.setData({ draftConditions: conditions, conditionValue: '' });
      this.refresh();
    },

    removeCondition(event) {
      const index = Number(event.currentTarget.dataset.index);
      const conditions = this.data.draftConditions.slice();
      if (Number.isNaN(index) || index < 0 || index >= conditions.length) return;
      conditions.splice(index, 1);
      this.setData({ draftConditions: conditions });
      this.refresh();
    },

    // ---------------- 确认 / 重置 / 胶囊 ----------------

    resetDraft() {
      this.setData({ draft: {}, draftConditions: [] });
      this.refresh();
    },

    confirmSheet() {
      const values = normalizeDraft(this.data.draft, this.data.sections || []);
      const conditions = this.data.draftConditions.slice();
      this.setData({ visible: false });
      this.triggerEvent('change', { values, conditions });
    },

    /** 已选条件胶囊上的 ×：立即去掉这一项（不必再开面板点确定）。 */
    removeChip(event) {
      const { key, value, conditionIndex } = event.currentTarget.dataset;
      // 分字段条件的 × 也是立即生效。
      if (conditionIndex !== undefined && conditionIndex !== null && conditionIndex !== '') {
        const conditions = (this.data.fieldConditions || []).slice();
        conditions.splice(Number(conditionIndex), 1);
        this.triggerEvent('change', {
          values: cloneFilters(this.data.active || {}),
          conditions,
        });
        return;
      }
      if (!key) return;
      const values = cloneFilters(this.data.active || {});
      const section = (this.data.sections || []).find((item) => item.key === key);
      const kind = (section && section.kind) || KIND_SINGLE;
      if (kind === KIND_MULTI) {
        values[key] = (values[key] || []).filter((item) => item !== value);
      } else {
        delete values[key];
      }
      this.triggerEvent('change', { values, conditions: (this.data.fieldConditions || []).slice() });
    },

    resetAll() {
      this.triggerEvent('change', { values: {}, conditions: [] });
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

/** 本地日期字符串（YYYY-MM-DD），日期选择器的初始值与提交格式都用它。 */
function toDateString(date) {
  const pad = (part) => String(part).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function cloneConditions(conditions) {
  return (conditions || []).map((condition) => ({ ...condition }));
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

module.exports = { KIND_SINGLE, KIND_MULTI, KIND_RANGE, KIND_DATE_RANGE };
