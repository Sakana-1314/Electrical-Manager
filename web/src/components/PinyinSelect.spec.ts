import { mount, type VueWrapper } from '@vue/test-utils'
import { NSelect, type SelectOption } from 'naive-ui'
import { afterEach, describe, expect, it, vi } from 'vitest'
import PinyinSelect from '@/components/PinyinSelect.vue'

const options = [
  { label: '六角螺栓 M8*30', value: 1 },
  { label: '不锈钢法兰', value: 2 },
]
const innerFilter = (wrapper: VueWrapper) =>
  wrapper.findComponent(NSelect).props('filter') as (
    pattern: string,
    option: SelectOption,
  ) => boolean

let wrapper: VueWrapper | null = null

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
})

function mountSelect(props: Record<string, unknown> = {}) {
  wrapper = mount(PinyinSelect, {
    props: { options, filterable: true, ...props },
  })
  return wrapper
}

describe('PinyinSelect', () => {
  it('把拼音 filter 注入内部 n-select，其余属性照常透传', () => {
    const wrapper = mountSelect({ value: 1 })
    const select = wrapper.findComponent(NSelect)
    expect(select.props('filterable')).toBe(true)
    expect(select.props('value')).toBe(1)
    expect(select.props('options')).toEqual(options)
  })

  it('filter 保留原文匹配并叠加拼音匹配', () => {
    const filter = innerFilter(mountSelect())
    expect(filter('螺栓', options[0])).toBe(true)
    expect(filter('ljls', options[0])).toBe(true)
    expect(filter('luo shuan', options[0])).toBe(true)
    expect(filter('bxg', options[1])).toBe(true)
    expect(filter('xyz', options[0])).toBe(false)
  })

  it('调用方自定义 filter 先执行，未命中再走拼音', () => {
    const custom = vi.fn(
      (pattern: string, option: SelectOption) => option.value === 2 && pattern === 'zzz',
    )
    const filter = innerFilter(mountSelect({ filter: custom }))
    expect(filter('zzz', options[1])).toBe(true)
    expect(filter('ls', options[0])).toBe(true)
    expect(custom).toHaveBeenCalled()
  })

  it('选择事件透传给调用方', () => {
    const onUpdate = vi.fn()
    const wrapper = mountSelect({ 'onUpdate:value': onUpdate })
    wrapper.findComponent(NSelect).vm.$emit('update:value', 2)
    expect(onUpdate).toHaveBeenCalledWith(2)
  })
})
