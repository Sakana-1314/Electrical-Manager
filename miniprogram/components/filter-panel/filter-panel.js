/**
 * 列表页筛选面板：搜索框 + 「筛选」按钮 + 已选条件 + 底部筛选面板。
 *
 * 小程序列表页的筛选维度一多，常驻一行下拉就会把首屏挤满（申购记录原先只有状态 + 子项号，
 * 再补类别 / 业务员 / 提报员工就放不下了）。这里把筛选收进底部弹层：收起态只占一行
 * 「搜索 + 筛选按钮（带已选数量）」，已选条件用一行可单删的胶囊回显，列表高度不受影响。
 *
 * 组件只管交互，取数仍由页面负责：
 * - `sections` 由页面按自己的维度组装（key / title / options，options 为 `{ label, value }`）；
 * - 面板里点选项只改草稿，点「确定」才发 `change`，一次改多项后统一生效；
 *   已选条件胶囊上的 × 与「清除筛选」立即发 `change`。
 * - 搜索框的输入 / 回车统一发 `search`，页面自己做防抖后取数。
 */
const { getMessages } = require('../../utils/i18n');

Component({
  properties: {
    /** 搜索框当前值（页面持有，便于分享参数回填）。 */
    keyword: { type: String, value: '' },
    placeholder: { type: String, value: '' },
    /** 筛选分区：[{ key, title, options: [{ label, value }] }]，每个分区单选，value 为 '' 表示不限。 */
    sections: {
      type: Array,
      value: [],
      observer() {
        this.refresh();
      },
    },
    /** 已生效的筛选值：`{ [sectionKey]: value }`，空串 / 缺省表示不限。 */
    active: {
      type: Object,
      value: {},
      observer(active) {
        // 面板打开时用户正在改草稿：此时外部同步过来的值不能覆盖草稿。
        if (!this.data.visible) {
          this.setData({ draft: { ...(active || {}) } });
        }
        this.refresh();
      },
    },
  },

  data: {
    visible: false,
    /** 面板内的草稿值，点「确定」才回传给页面。 */
    draft: {},
    /** 带 selected 标记的分区视图（WXML 里直接读，避免模板内做对象下标比较）。 */
    sectionsView: [],
    chips: [],
    activeCount: 0,
    i18n: getMessages(),
  },

  methods: {
    /** 由 sections + active + draft 派生分区视图与已选条件胶囊。 */
    refresh() {
      const sections = this.data.sections || [];
      const active = this.data.active || {};
      const draft = this.data.draft || {};
      const sectionsView = sections.map((section) => ({
        key: section.key,
        title: section.title,
        options: (section.options || []).map((option) => ({
          label: option.label,
          value: option.value,
          selected: (draft[section.key] || '') === option.value,
        })),
      }));
      const chips = [];
      sections.forEach((section) => {
        const value = active[section.key];
        if (!value) return;
        const matched = (section.options || []).find((option) => option.value === value);
        chips.push({
          key: section.key,
          // 分享带来的值可能已不在选项里（如该员工名下已无在途记录）：回显原值，别显示成「不限」。
          label: `${section.title}：${matched ? matched.label : value}`,
        });
      });
      this.setData({ sectionsView, chips, activeCount: chips.length });
    },

    onSearchInput(event) {
      this.triggerEvent('search', { value: event.detail.value || '' });
    },

    onSearchSubmit(event) {
      this.triggerEvent('search', { value: (event.detail && event.detail.value) || '' });
    },

    openSheet() {
      this.setData({ visible: true, draft: { ...(this.data.active || {}) } });
      this.refresh();
    },

    closeSheet() {
      this.setData({ visible: false });
    },

    onVisibleChange(event) {
      this.setData({ visible: !!event.detail.visible });
    },

    /** 面板里点选项：只改草稿（再点同一个已选项等于取消该条件）。 */
    selectOption(event) {
      const { section, value } = event.currentTarget.dataset;
      if (!section) return;
      const draft = { ...this.data.draft };
      draft[section] = draft[section] === value ? '' : value;
      this.setData({ draft });
      this.refresh();
    },

    resetDraft() {
      this.setData({ draft: {} });
      this.refresh();
    },

    confirmSheet() {
      const values = { ...this.data.draft };
      this.setData({ visible: false });
      this.triggerEvent('change', { values });
    },

    /** 已选条件胶囊上的 ×：立即去掉这一项（不必再开面板点确定）。 */
    removeChip(event) {
      const { key } = event.currentTarget.dataset;
      if (!key) return;
      const values = { ...(this.data.active || {}) };
      delete values[key];
      this.triggerEvent('change', { values });
    },

    resetAll() {
      this.triggerEvent('change', { values: {} });
    },
  },
});
