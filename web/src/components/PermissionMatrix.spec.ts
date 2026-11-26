import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

/** 取最后一次 emit 的第一个参数（TS target 不含 ES2022，不能用 Array#at）。 */
function lastEmit(wrapper: ReturnType<typeof mountMatrix>): string[] {
  const events = wrapper.emitted('update:modelValue') ?? []
  return events[events.length - 1]?.[0] as string[]
}
import PermissionMatrix from './PermissionMatrix.vue'

/** 权限位目录的测试替身：与后端 PermissionCatalog 同结构（key / module / action / label / bit）。 */
const OPTIONS = [
  { key: 'system:admin', module: 'system', action: 'admin', label: '系统管理', bit: 1 },
  { key: 'warehouse:read', module: 'warehouse', action: 'read', label: '二级库 Pro 查看', bit: 2 },
  {
    key: 'warehouse:write',
    module: 'warehouse',
    action: 'write',
    label: '二级库 Pro 读写',
    bit: 4,
  },
  { key: 'lite:read', module: 'lite', action: 'read', label: '二级库 Lite 查看', bit: 8192 },
  { key: 'lite:write', module: 'lite', action: 'write', label: '二级库 Lite 导入', bit: 16384 },
]

function mountMatrix(modelValue: string[] = []) {
  return mount(PermissionMatrix, { props: { options: OPTIONS, modelValue } })
}

describe('PermissionMatrix（权限勾选矩阵）', () => {
  it('按模块分组渲染，系统管理排在最前，模块名用 Pro / Lite', () => {
    const wrapper = mountMatrix()
    const names = wrapper.findAll('.matrix-card-name').map((node) => node.text())
    expect(names).toEqual(['系统管理', '二级库 Pro', '二级库 Lite'])
  })

  it('导入型写权限显示「导入」，普通写权限显示「读写」', () => {
    const wrapper = mountMatrix()
    const pills = wrapper
      .findAll('.matrix-pill')
      .map((node) => node.text().replace(/[+✓]/g, '').trim())
    expect(pills).toEqual(['可管理', '查看', '读写', '查看', '导入'])
  })

  it('勾选写权限自动补上同模块查看，取消查看同时取消写', async () => {
    const wrapper = mountMatrix()
    const write = wrapper.findAll('.matrix-pill')[2]!
    await write.trigger('click')
    expect(lastEmit(wrapper)).toEqual(['warehouse:write', 'warehouse:read'])

    // 取消查看：同时清掉同模块写权限（用已勾选的状态单独挂一次）
    const checked = mountMatrix(['warehouse:read', 'warehouse:write'])
    await checked.findAll('.matrix-pill')[1]!.trigger('click')
    expect(lastEmit(checked)).toEqual([])
  })

  it('整组全选与取消只影响该模块', async () => {
    const wrapper = mountMatrix(['system:admin'])
    const groupToggle = wrapper.findAll('.matrix-group-toggle')[2]!
    await groupToggle.trigger('click')
    expect(lastEmit(wrapper)).toEqual(['system:admin', 'lite:read', 'lite:write'])
  })

  it('顶部「全选 / 清空全部」按已选数量切换文案', async () => {
    const all = OPTIONS.map((item) => item.key)
    const wrapper = mountMatrix(all)
    const toggle = wrapper.findAll('.matrix-actions button')[0]!
    expect(toggle.text()).toBe('清空全部')
    await toggle.trigger('click')
    expect(lastEmit(wrapper)).toEqual([])

    const empty = mountMatrix()
    expect(empty.findAll('.matrix-actions button')[0]!.text()).toBe('全选')
  })

  it('顶部统计已选项数，选中模块显示命中数量', () => {
    const wrapper = mountMatrix(['lite:read', 'lite:write'])
    expect(wrapper.find('.matrix-summary').text()).toContain('已选 2 / 5 项')
    expect(wrapper.findAll('.matrix-card')[2]!.text()).toContain('2/2')
  })
})
