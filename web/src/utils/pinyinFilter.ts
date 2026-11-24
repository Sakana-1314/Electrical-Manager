import { pinyin } from 'pinyin-pro'
import type { SelectFilter, TreeSelectOption } from 'naive-ui'

/**
 * 下拉框的拼音筛选：把选项文本预转成「原文 + 全拼 + 首字母」索引并缓存。
 *
 * 输入 `luo` / `luoshu` / `luo shuan` / `ls` 都能命中「螺栓」，
 * 原有中文、字母、数字的包含匹配保持不变。转换按文本缓存，
 * 同一批选项在每次按键过滤时不重复查字典。
 */
const INDEX_CACHE_LIMIT = 5000
const indexCache = new Map<string, string[]>()

function searchIndex(text: string): string[] {
  const cached = indexCache.get(text)
  if (cached) return cached
  const full = pinyin(text, { toneType: 'none', type: 'array' }).join('')
  const initials = pinyin(text, { pattern: 'first', toneType: 'none', type: 'array' }).join('')
  // 三段分开存，避免「全拼末尾 + 首字母开头」拼出跨段的假匹配
  const index = [text, full, initials].map((part) => part.toLowerCase().replace(/\s+/g, ''))
  if (indexCache.size >= INDEX_CACHE_LIMIT) indexCache.clear()
  indexCache.set(text, index)
  return index
}

/** 文本是否命中输入；全拼、首字母、原文任一包含即算命中（忽略大小写与空格）。 */
export function matchPinyin(pattern: string, text: string): boolean {
  const needle = pattern.trim().toLowerCase().replace(/\s+/g, '')
  if (!needle) return true
  return searchIndex(text).some((part) => part.includes(needle))
}

/** n-select 的 filter：保持原生「label 是字符串时只看 label，否则看 value」的行为并叠加拼音匹配。 */
export const pinyinSelectFilter: SelectFilter = (pattern, option) => {
  const label = option.label
  if (typeof label === 'string') return matchPinyin(pattern, label)
  const { value } = option
  if (typeof value === 'string' || typeof value === 'number') {
    return matchPinyin(pattern, String(value))
  }
  return false
}

/** n-tree-select 的 filter：标签无法转文本（自定义渲染）时保留该节点，不误隐藏。 */
export function pinyinTreeSelectFilter(pattern: string, option: TreeSelectOption): boolean {
  const label = option.label
  if (typeof label !== 'string') return true
  return matchPinyin(pattern, label)
}
