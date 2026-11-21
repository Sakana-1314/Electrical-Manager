const { imageUrl } = require('./inventory');

// 整改状态 → TDesign 标签主题（状态值本身是中文，直接展示不做翻译）。
const STATUS_THEMES = {
  待整改: 'warning',
  整改受阻: 'danger',
  已整改: 'success',
};

function todayString() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

// 逾期：要求完成时间早于今天且未整改（今天到期不算逾期，与后端统计口径一致）。
function isOverdue(dueDate, status) {
  if (status === '已整改') {
    return false;
  }
  return String(dueDate || '') < todayString();
}

function decorateImage(image) {
  return {
    ...image,
    preview_url: imageUrl(image.id, 192),
    original_url: imageUrl(image.id),
  };
}

function decorateHazard(item) {
  return {
    ...item,
    before_images: (item.before_images || []).map(decorateImage),
    after_images: (item.after_images || []).map(decorateImage),
    status_theme: STATUS_THEMES[item.status] || 'default',
    level_theme: item.level === '重大隐患' ? 'danger' : 'primary',
    date_label: String(item.inspection_date || '').replace(/-/g, '/'),
    due_label: String(item.due_date || '').replace(/-/g, '/'),
    type_label: [item.major, item.minor].filter(Boolean).join(' / '),
    overdue: isOverdue(item.due_date, item.status),
    // 空值留空：详情页不写「未填写」占位，列表卡需要占位时在模板里自行兜底。
    person_label: item.person || '',
    rectify_person_label: item.rectify_person || '',
    remark_label: item.remark || '',
    suggestion_label: item.suggestion || '',
  };
}

module.exports = {
  STATUS_THEMES,
  decorateHazard,
  decorateImage,
  isOverdue,
  todayString,
};
