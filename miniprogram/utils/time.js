const { t } = require('./i18n');

/** 绝对时间：`YYYY/MM/DD HH:mm`（与页面原有导入时间格式一致）。 */
function formatDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (part) => String(part).padStart(2, '0');
  return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * 相对时间：刚刚 / N分钟前 / N小时前 / N天N时前。
 * 超过 1 天时保留小时，让「2天3时前」这类信息量更足；未来时间按「刚刚」处理。
 */
function relativeLabel(value, now = Date.now()) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const minutes = Math.floor(Math.max(0, now - date.getTime()) / 60000);
  if (minutes < 1) return t('relativeJustNow');
  if (minutes < 60) return t('relativeMinutesAgo', { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t('relativeHoursAgo', { count: hours });
  const days = Math.floor(hours / 24);
  const restHours = hours % 24;
  if (restHours > 0) return t('relativeDaysHoursAgo', { days, hours: restHours });
  return t('relativeDaysAgo', { count: days });
}

/** 导入时间展示：绝对时间后带括号相对时间，如 `2026/11/10 10:00（2天3时前）`。 */
function importTimeLabel(value, now = Date.now()) {
  const absolute = formatDateTime(value);
  if (!absolute) return '';
  const relative = relativeLabel(value, now);
  return relative ? t('importTimeWithRelative', { time: absolute, relative }) : absolute;
}

module.exports = { formatDateTime, relativeLabel, importTimeLabel };
