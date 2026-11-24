import { describe, expect, it } from 'vitest'
import { matchPinyin, pinyinSelectFilter, pinyinTreeSelectFilter } from '@/utils/pinyinFilter'

describe('matchPinyin', () => {
  it('命中全拼、首字母与带空格输入', () => {
    expect(matchPinyin('luo', '螺栓')).toBe(true)
    expect(matchPinyin('luoshu', '螺栓')).toBe(true)
    expect(matchPinyin('luo shuan', '螺栓')).toBe(true)
    expect(matchPinyin('LS', '螺栓')).toBe(true)
  })

  it('保留原文、字母与数字的包含匹配', () => {
    expect(matchPinyin('螺', '六角螺栓 M8*30')).toBe(true)
    expect(matchPinyin('m8', '六角螺栓 M8*30')).toBe(true)
    expect(matchPinyin('dn50falan', 'DN50 法兰')).toBe(true)
  })

  it('不匹配时返回 false，空输入视为全部命中', () => {
    expect(matchPinyin('xyz', '螺栓')).toBe(false)
    expect(matchPinyin('  ', '螺栓')).toBe(true)
  })

  it('多音字按 pinyin-pro 的默认读音匹配', () => {
    expect(matchPinyin('chongqing', '重庆')).toBe(true)
    expect(matchPinyin('zq', '重庆')).toBe(false)
  })
})

describe('pinyinSelectFilter', () => {
  it('label 为字符串时按 label 匹配', () => {
    expect(pinyinSelectFilter('ls', { label: '螺栓', value: 1 })).toBe(true)
    expect(pinyinSelectFilter('abc', { label: '螺栓', value: 1 })).toBe(false)
  })

  it('label 非字符串时回落到 value', () => {
    expect(pinyinSelectFilter('ls', { label: () => '螺栓', value: '螺栓' })).toBe(true)
    expect(pinyinSelectFilter('1', { label: () => '一', value: 1 })).toBe(true)
  })
})

describe('pinyinTreeSelectFilter', () => {
  it('按节点标签匹配拼音', () => {
    expect(pinyinTreeSelectFilter('ljls', { label: '六角螺栓', key: 1 })).toBe(true)
    expect(pinyinTreeSelectFilter('xyz', { label: '六角螺栓', key: 1 })).toBe(false)
  })

  it('标签无法转文本时保留节点', () => {
    expect(pinyinTreeSelectFilter('abc', { key: 1 })).toBe(true)
  })
})
