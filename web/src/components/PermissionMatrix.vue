<script setup lang="ts">
import { computed } from 'vue'
import { NButton, NTag } from 'naive-ui'
import type { PermissionRead } from '@/api/generated'

/**
 * 权限位勾选矩阵（用户编辑弹窗与高级设置的「默认用户权限」共用）。
 *
 * - 每个模块一张小卡：模块名 + 该模块的权限胶囊（查看 / 读写 / 导入 / 管理）；
 * - 胶囊是带勾选标记的按钮，点一下切换，写权限自动带上同模块查看、取消查看同时取消写；
 * - 「全部」「清空」一次改完，顶部统计已选模块数，避免逐格点；
 * - 窄屏一张卡一行，胶囊自动换行。
 *
 * 勾选语义（写包含读）留在本组件里，页面只负责把 `modelValue` 存进表单。
 */
const props = defineProps<{
  /** 权限位目录（GET /permissions 原样传入）。 */
  options: PermissionRead[]
  /** 已选权限键（如 `lite:read`）。 */
  modelValue: string[]
}>()
const emit = defineEmits<{ 'update:modelValue': [value: string[]] }>()

/** 模块显示名：与侧栏 / 路由标题保持一致（二级库 Pro / 二级库 Lite）。 */
const MODULE_LABELS: Record<string, string> = {
  system: '系统管理',
  warehouse: '二级库 Pro',
  lite: '二级库 Lite',
  purchase: '申购',
  huaxing: '华星总库存',
  codes: '物料编码库',
  ledger: '台账',
  hazard: '隐患',
  work: '工单',
}
/** 模块的一句话说明：告诉使用者这组权限能打开哪些页面。 */
const MODULE_HINTS: Record<string, string> = {
  system: '用户 / 项目 / 高级设置 / 附件池 / 分享链接',
  warehouse: '库存查询、物资档案、入库出库与流水',
  lite: 'Excel 全量导入的只读台账',
  purchase: '申购计划、申购记录、物料编码库',
  huaxing: '平台总库存与导入',
  codes: '物料编码库',
  ledger: '台账条目与标签',
  hazard: '隐患登记、整改与复查',
  work: '工单、参与人与工时',
}
/** 权限胶囊文案：导入型写权限与普通读写区分开。 */
function actionLabel(item: PermissionRead): string {
  if ((item.module === 'lite' || item.module === 'huaxing') && item.action === 'write')
    return '导入'
  if (item.action === 'write') return '读写'
  if (item.action === 'read') return '查看'
  return '可管理'
}

const selected = computed(() => new Set(props.modelValue))
const groups = computed(() => {
  const map = new Map<string, PermissionRead[]>()
  for (const item of props.options) {
    const list = map.get(item.module) ?? []
    list.push(item)
    map.set(item.module, list)
  }
  // 系统管理排最前，其余按权限目录顺序。
  return Array.from(map, ([module, items]) => ({
    module,
    label: MODULE_LABELS[module] ?? module,
    hint: MODULE_HINTS[module] ?? '',
    items,
    checkedCount: items.filter((item) => selected.value.has(item.key)).length,
  })).sort((a, b) => (a.module === 'system' ? -1 : b.module === 'system' ? 1 : 0))
})
const allKeys = computed(() => props.options.map((item) => item.key))
const allChecked = computed(
  () => allKeys.value.length > 0 && allKeys.value.every((key) => selected.value.has(key)),
)

/** 写权限自动带查看；取消查看同时取消写（后端按位判断，缺查看位的写权限没有意义）。 */
function toggle(key: string, checked: boolean): void {
  const next = new Set(props.modelValue)
  if (checked) {
    next.add(key)
    if (key.endsWith(':write')) next.add(`${key.slice(0, -':write'.length)}:read`)
  } else {
    next.delete(key)
    if (key.endsWith(':read')) next.delete(`${key.slice(0, -':read'.length)}:write`)
  }
  emit('update:modelValue', [...next])
}

/** 整组切换：全选该模块的全部键，或整组清空。 */
function toggleGroup(items: PermissionRead[], checked: boolean): void {
  const next = new Set(props.modelValue)
  for (const item of items) {
    if (checked) next.add(item.key)
    else next.delete(item.key)
  }
  emit('update:modelValue', [...next])
}

function toggleAll(): void {
  emit('update:modelValue', allChecked.value ? [] : [...allKeys.value])
}
</script>

<template>
  <div class="permission-matrix">
    <div class="matrix-toolbar">
      <div class="matrix-summary">
        <n-tag size="small" round :type="selected.size ? 'info' : 'default'" :bordered="false">
          已选 {{ selected.size }} / {{ allKeys.length }} 项
        </n-tag>
        <span class="matrix-hint">写权限自动包含查看</span>
      </div>
      <div class="matrix-actions">
        <n-button size="tiny" quaternary @click="toggleAll">
          {{ allChecked ? '清空全部' : '全选' }}
        </n-button>
      </div>
    </div>

    <div class="matrix-grid">
      <div
        v-for="group in groups"
        :key="group.module"
        class="matrix-card"
        :class="{ 'matrix-card--active': group.checkedCount > 0 }"
      >
        <div class="matrix-card-head">
          <div class="matrix-card-title">
            <span class="matrix-card-name">{{ group.label }}</span>
            <n-tag v-if="group.checkedCount" size="tiny" type="success" :bordered="false" round>
              {{ group.checkedCount }}/{{ group.items.length }}
            </n-tag>
          </div>
          <button
            type="button"
            class="matrix-group-toggle"
            :title="
              group.checkedCount === group.items.length
                ? '取消该模块全部权限'
                : '选中该模块全部权限'
            "
            @click="toggleGroup(group.items, group.checkedCount !== group.items.length)"
          >
            {{ group.checkedCount === group.items.length ? '取消' : '全选' }}
          </button>
        </div>
        <div v-if="group.hint" class="matrix-card-hint">{{ group.hint }}</div>
        <div class="matrix-pills">
          <button
            v-for="item in group.items"
            :key="item.key"
            type="button"
            class="matrix-pill"
            :class="{ 'matrix-pill--on': selected.has(item.key) }"
            :aria-pressed="selected.has(item.key)"
            @click="toggle(item.key, !selected.has(item.key))"
          >
            <span class="matrix-pill-mark" aria-hidden="true">{{
              selected.has(item.key) ? '✓' : '+'
            }}</span>
            {{ actionLabel(item) }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.permission-matrix {
  display: flex;
  flex-direction: column;
  gap: var(--dialog-label-gap);
}

/* 顶部工具条：统计 + 一键全选，右侧对齐不撑高 */
.matrix-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--dialog-block-gap);
  flex-wrap: wrap;
}
.matrix-summary {
  display: flex;
  align-items: center;
  gap: var(--dialog-footer-gap);
  flex-wrap: wrap;
}
.matrix-hint {
  color: var(--color-text-muted);
  font-size: var(--dialog-caption-size);
  line-height: var(--dialog-caption-line-height);
}

.matrix-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--dialog-footer-gap);
}

/* 模块卡：选中时左侧主题色描边，默认浅底，避免整屏勾选框的呆板观感 */
.matrix-card {
  display: flex;
  flex-direction: column;
  gap: var(--dialog-label-gap);
  padding: var(--dialog-label-gap) var(--dialog-footer-gap);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--dialog-block-radius);
  background: var(--color-panel);
  transition:
    border-color 0.15s ease,
    background 0.15s ease;
}
.matrix-card--active {
  border-color: var(--color-primary);
  background: var(--color-primary-soft);
}

.matrix-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--dialog-label-gap);
  min-width: 0;
}
.matrix-card-title {
  display: flex;
  align-items: center;
  gap: var(--dialog-footer-gap);
  min-width: 0;
}
.matrix-card-name {
  overflow: hidden;
  color: var(--color-text-strong);
  font-size: var(--dialog-label-size);
  font-weight: var(--dialog-title-weight);
  line-height: var(--dialog-label-line-height);
  text-overflow: ellipsis;
  white-space: nowrap;
}
/* 模块级全选：文字按钮，弱化到不抢胶囊的注意力 */
.matrix-group-toggle {
  flex: none;
  padding: 0;
  border: 0;
  color: var(--color-primary);
  font-size: var(--dialog-caption-size);
  line-height: var(--dialog-caption-line-height);
  background: none;
  cursor: pointer;
}
.matrix-group-toggle:hover {
  text-decoration: underline;
}
.matrix-card-hint {
  color: var(--color-text-muted);
  font-size: var(--dialog-caption-size);
  line-height: var(--dialog-caption-line-height);
}

.matrix-pills {
  display: flex;
  flex-wrap: wrap;
  gap: var(--dialog-label-gap);
}
/* 权限胶囊：未选中是虚线描边，选中是实心主题色 + 勾号 */
.matrix-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 10px 2px 6px;
  border: 1px dashed var(--color-border);
  border-radius: 999px;
  color: var(--color-text);
  font-size: var(--dialog-caption-size);
  line-height: var(--dialog-label-line-height);
  background: transparent;
  cursor: pointer;
  transition:
    color 0.15s ease,
    border-color 0.15s ease,
    background 0.15s ease;
}
.matrix-pill:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
}
.matrix-pill--on {
  border-style: solid;
  border-color: var(--color-primary);
  color: #fff;
  background: var(--color-primary);
}
.matrix-pill--on:hover {
  color: #fff;
  background: var(--color-primary-hover);
}
.matrix-pill-mark {
  width: 12px;
  font-size: 11px;
  line-height: 1;
  text-align: center;
  opacity: 0.9;
}

@media (max-width: 560px) {
  .matrix-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
