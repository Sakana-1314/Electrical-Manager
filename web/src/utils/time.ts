export const formatShanghaiTime = (value?: string): string => {
  if (!value) return '—'
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date(value))
}

export const toIsoWithTimezone = (timestamp: number): string => {
  const date = new Date(timestamp)
  const shanghai = new Date(date.toLocaleString('en-US', { timeZone: 'Asia/Shanghai' }))
  const offsetMs = shanghai.getTime() - date.getTime()
  const adjusted = new Date(date.getTime() + offsetMs)
  const base = adjusted.toISOString().slice(0, 19)
  return `${base}+08:00`
}

export const toShanghaiDate = (timestamp: number): string => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(timestamp))
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value || ''
  return `${value('year')}-${value('month')}-${value('day')}`
}

/**
 * 日期字符串（YYYY-MM-DD）→ 东八区当日零点时间戳。
 *
 * 空值必须返回 null：可选日期（集港日期、发船日期等）留空时日期选择器应保持为空，
 * 不能默认成今天——否则打开一条未填写该字段的记录就会看到“今日日期”，直接保存还会把今天写进库里。
 */
export const dateToTimestamp = (value?: string | null): number | null =>
  value ? new Date(`${value}T00:00:00+08:00`).getTime() : null

export const formatDate = (value?: string): string => (value ? value.replace(/-/g, '/') : '—')

/**
 * 耗时展示（用于上传等有明确起止的过程）。
 *
 * 不足 1 分钟给「12秒」；超过 1 分钟给「1分05秒」，秒数补零让宽度稳定、读数不跳动；
 * 超过 1 小时给「1小时05分」（上传超时上限 30 分钟，走到这一档基本只在异常场景）。
 */
export const formatElapsed = (ms: number): string => {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  if (totalSeconds < 60) return `${totalSeconds}秒`
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  if (minutes < 60) return `${minutes}分${String(seconds).padStart(2, '0')}秒`
  const hours = Math.floor(minutes / 60)
  return `${hours}小时${String(minutes % 60).padStart(2, '0')}分`
}
