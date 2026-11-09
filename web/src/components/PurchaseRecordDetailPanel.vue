<script setup lang="ts">
import { computed } from 'vue'
import type { PurchaseRecord } from '@/api/generated'
import { formatUnitPrice } from '@/utils/purchase'
import { formatDate, formatShanghaiTime } from '@/utils/time'
import ImageThumbnails from '@/components/ImageThumbnails.vue'

const props = defineProps<{ record: PurchaseRecord }>()

type DetailItem = {
  label: string
  value: string
  /** 备注、用途这类长文本占满整行。 */
  wide?: boolean
}

type DetailSection = {
  title: string
  items: DetailItem[]
}

/** 空值统一显示占位符；兼容历史数据里的反斜杠空值标记。 */
function text(value: string | number | null | undefined): string {
  const raw = value === null || value === undefined ? '' : String(value).trim()
  return raw && raw !== '\\' ? raw : '—'
}

function dateText(value: string | null | undefined): string {
  return value ? formatDate(value) : '—'
}

function quantityText(record: PurchaseRecord): string {
  const quantity = record.purchase_qty ? String(record.purchase_qty) : ''
  if (!quantity) return '—'
  return `${quantity}${record.unit_name ? ` ${record.unit_name}` : ''}`
}

const hasShipping = computed(() =>
  [
    props.record.contract_no,
    props.record.vessel_no,
    props.record.consolidation_date,
    props.record.consolidation_port,
    props.record.sailing_date,
    props.record.contract_sign_date,
  ].some((value) => text(value) !== '—'),
)

const sections = computed<DetailSection[]>(() => {
  const record = props.record
  const result: DetailSection[] = [
    {
      title: '单据信息',
      items: [
        { label: '申购计划号', value: text(record.plan_no) },
        { label: '需求日期', value: dateText(record.plan_date) },
        { label: '申购日期', value: dateText(record.purchase_date) },
        { label: '申购单号', value: text(record.purchase_order_no) },
        { label: '追溯号', value: text(record.trace_no) },
        { label: '状态', value: text(record.status) },
        { label: '类别', value: text(record.category) },
        { label: '需求部门', value: text(record.demand_department) },
        { label: '子项号', value: text(record.subitem_no) },
      ],
    },
    {
      title: '物资信息',
      items: [
        { label: '物资名称', value: text(record.material_name) },
        { label: '物料编码', value: text(record.material_code) },
        { label: '型号规格', value: text(record.model_spec) },
        { label: '申购数量', value: quantityText(record) },
        { label: '单价', value: formatUnitPrice(record.unit_price) || '—' },
        { label: '用途', value: text(record.usage), wide: true },
      ],
    },
    {
      title: '人员信息',
      items: [
        { label: '提报员工', value: text(record.actual_demand_person) },
        { label: '实际需求人', value: text(record.purchase_responsible) },
        { label: '业务员', value: text(record.salesperson) },
      ],
    },
    {
      title: '备注',
      items: [
        { label: '申购计划备注', value: text(record.plan_remark), wide: true },
        { label: '申购记录备注', value: text(record.record_remark), wide: true },
        {
          label: '最后更新',
          value: record.updated_at ? formatShanghaiTime(record.updated_at) : '—',
        },
      ],
    },
  ]
  if (hasShipping.value) {
    result.push({
      title: '采购与发运',
      items: [
        { label: '合同号', value: text(record.contract_no) },
        { label: '船号', value: text(record.vessel_no) },
        { label: '集港日期', value: dateText(record.consolidation_date) },
        { label: '集港港口', value: text(record.consolidation_port) },
        { label: '发船日期', value: dateText(record.sailing_date) },
        { label: '合同签订日期', value: dateText(record.contract_sign_date) },
      ],
    })
  }
  return result
})

const images = computed(() => props.record.images ?? [])
</script>

<template>
  <div class="record-detail-panel">
    <section v-for="section in sections" :key="section.title" class="detail-section">
      <h4 class="detail-section__title">{{ section.title }}</h4>
      <dl class="detail-grid">
        <div
          v-for="item in section.items"
          :key="item.label"
          class="detail-item"
          :class="{ 'is-wide': item.wide }"
        >
          <dt>{{ item.label }}</dt>
          <dd>{{ item.value }}</dd>
        </div>
      </dl>
    </section>
    <section v-if="images.length" class="detail-section">
      <h4 class="detail-section__title">图片附件</h4>
      <ImageThumbnails :images="images" />
    </section>
  </div>
</template>

<style scoped>
.record-detail-panel {
  padding: 6px 8px 10px;
}

.detail-section + .detail-section {
  margin-top: 14px;
}

.detail-section__title {
  margin: 0 0 8px;
  color: var(--color-text);
  font-size: 13px;
  font-weight: 600;
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
  gap: 8px 20px;
  margin: 0;
}

.detail-item {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 2px;
}

.detail-item.is-wide {
  grid-column: 1 / -1;
}

.detail-item dt {
  color: var(--color-text-muted);
  font-size: 12px;
}

.detail-item dd {
  margin: 0;
  color: var(--color-text);
  font-size: 13px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
