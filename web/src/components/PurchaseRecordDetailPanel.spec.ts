import { mount } from '@vue/test-utils'
import { NImage } from 'naive-ui'
import { describe, expect, it } from 'vitest'
import type { PurchaseRecord } from '@/api/generated'
import PurchaseRecordDetailPanel from './PurchaseRecordDetailPanel.vue'

const record: PurchaseRecord = {
  line_id: 1,
  purchase_request_id: 2,
  purchase_material_id: 3,
  plan_no: 'JH20260101',
  plan_date: '2026-01-02',
  purchase_order_no: 'CG20260103',
  trace_no: 'ZS-01',
  contract_no: null,
  vessel_no: null,
  consolidation_date: null,
  consolidation_port: null,
  sailing_date: null,
  contract_sign_date: null,
  unit_price: '12.5',
  status: '已入库',
  material_code: 'L012-05048',
  category: '备品备件',
  demand_department: '生产调度中心',
  material_name: '内丝三通',
  model_spec: 'DN15',
  unit_name: '个',
  purchase_qty: '2',
  actual_demand_person: '吴冰',
  purchase_responsible: '李建军',
  salesperson: '马晓东',
  plan_remark: '计划备注',
  record_remark: '记录备注',
  usage: '检修',
  subitem_no: '201',
  images: [],
  stock_material_id: null,
  purchase_date: '2026-01-04',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-05T00:00:00Z',
  version: 1,
}

function mountPanel(value: PurchaseRecord = record) {
  return mount(PurchaseRecordDetailPanel, {
    props: { record: value },
    global: { components: { NImage } },
  })
}

describe('PurchaseRecordDetailPanel', () => {
  it('按分组展示申购记录的关键字段', () => {
    const wrapper = mountPanel()
    const text = wrapper.text()

    for (const section of ['单据信息', '物资信息', '人员信息', '备注']) {
      expect(text).toContain(section)
    }
    for (const value of [
      'JH20260101',
      '2026/01/02',
      '2026/01/04',
      'CG20260103',
      'ZS-01',
      'L012-05048',
      '内丝三通',
      'DN15',
      '2 个',
      '12.50 元',
      '生产调度中心',
      '李建军',
      '计划备注',
      '记录备注',
    ]) {
      expect(text).toContain(value)
    }
  })

  it('空字段显示占位符，采购与发运无值时不渲染该分组', () => {
    const wrapper = mountPanel({
      ...record,
      material_code: null,
      purchase_order_no: null,
      trace_no: '\\',
      plan_remark: null,
      record_remark: null,
    })
    const text = wrapper.text()

    expect(text).toContain('物料编码')
    expect(text).toContain('—')
    expect(text).not.toContain('采购与发运')
  })

  it('有采购与发运或图片时展示对应分组', () => {
    const wrapper = mountPanel({
      ...record,
      contract_no: 'HT-01',
      vessel_no: 'V-01',
      images: [
        {
          id: '10000000-0000-4000-8000-000000000001',
          original_name: '到货.png',
          mime_type: 'image/png',
          size_bytes: 1024,
          width: 32,
          height: 32,
        },
      ],
    })
    const text = wrapper.text()

    expect(text).toContain('采购与发运')
    expect(text).toContain('HT-01')
    expect(text).toContain('图片附件')
  })
})
