const { imageUrl } = require('./inventory');
const { t } = require('./i18n');

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
    type_label: `${item.major} / ${item.minor}`,
    overdue: isOverdue(item.due_date, item.status),
    person_label: item.person || t('notSet'),
    rectify_person_label: item.rectify_person || t('notSet'),
    remark_label: item.remark || t('notSet'),
    suggestion_label: item.suggestion || t('notSet'),
  };
}

module.exports = {
  STATUS_THEMES,
  decorateHazard,
  decorateImage,
  isOverdue,
  todayString,
};
