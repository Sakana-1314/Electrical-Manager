import { mount, type VueWrapper } from '@vue/test-utils'
import { NTreeSelect } from 'naive-ui'
import { afterEach, describe, expect, it } from 'vitest'
import PinyinTreeSelect from '@/components/PinyinTreeSelect.vue'

const bolt = { key: 1, label: '六角螺栓' }
const options = [{ key: 'root', label: '五金件', children: [bolt] }]

let wrapper: VueWrapper | null = null

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
})

describe('PinyinTreeSelect', () => {
  it('把拼音 filter 注入内部 n-tree-select，其余属性照常透传', () => {
    wrapper = mount(PinyinTreeSelect, {
      props: { options, filterable: true, value: 1 },
    })
    const select = wrapper.findComponent(NTreeSelect)
    expect(select.props('filterable')).toBe(true)
    expect(select.props('value')).toBe(1)
    const filter = select.props('filter') as (
      pattern: string,
      option: { label?: string },
    ) => boolean
    expect(filter('ljls', bolt)).toBe(true)
    expect(filter('lsx', bolt)).toBe(false)
  })
})
