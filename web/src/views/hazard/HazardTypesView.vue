<script setup lang="ts">
/**
 * 隐患类型：数据仍是「一行一个大类 + 小类组合」，展示层按大类分组成两级横向树
 * （大类在左、小类在右，连线由 vue3-tree-org 自带样式绘制）。
 * 只需维护叶子（小类）：点叶子编辑，新增走页头按钮。大类不是实体，改名/删除整类不在本页支持。
 */
import { computed, ref } from 'vue'
import {
  NButton,
  NCard,
  NEmpty,
  NForm,
  NFormItem,
  NInput,
  NModal,
  NSelect,
  NSpin,
  NTag,
  useDialog,
  useMessage,
  type FormInst,
  type FormRules,
  type SelectOption,
} from 'naive-ui'
import { Vue3TreeOrg } from 'vue3-tree-org'
import 'vue3-tree-org/lib/vue3-tree-org.css'
import { hazardApi } from '@/api/hazards'
import type { HazardType } from '@/api/generated'
import { usePagedTable } from '@/composables/usePagedTable'
import { useAuthStore } from '@/stores/auth'
import { buildHazardTypeTree } from '@/utils/hazard'

const auth = useAuthStore()
const message = useMessage()
const dialog = useDialog()
const canWrite = computed(() => auth.can('hazard:write'))

const { items, loading, load } = usePagedTable<HazardType, Record<string, never>>({
  fetch: () =>
    hazardApi
      .types()
      .then((rows) => ({ items: rows, page: 1, page_size: 200, total: rows.length })),
  initialFilters: () => ({}),
  paginated: false,
  defaultPageSize: 200,
  onError: (error) => message.error(error instanceof Error ? error.message : '隐患类型加载失败'),
})

const showModal = ref(false)
const saving = ref(false)
const deleting = ref(false)
const editing = ref<HazardType | null>(null)
const formRef = ref<FormInst | null>(null)
const form = ref({ major: '', minor: '' })

/** 树数据（每次由列表数据重新派生，避免组件往节点上写的 `$` 字段污染列表）。 */
const treeData = computed(() => buildHazardTypeTree(items.value))

/** 已有大类（去重）作为下拉候选，新增时也可直接输入新大类。 */
const majorOptions = computed<SelectOption[]>(() => {
  const seen = new Set<string>()
  const options: SelectOption[] = []
  for (const item of items.value) {
    if (item.major && !seen.has(item.major)) {
      seen.add(item.major)
      options.push({ label: item.major, value: item.major })
    }
  }
  return options
})

/** 表单校验规则（弹窗内新增/编辑小类）。 */
const rules: FormRules = {
  major: { required: true, message: '请输入或选择大类', trigger: ['input', 'blur', 'change'] },
  minor: { required: true, message: '请输入小类', trigger: ['input', 'blur'] },
}

/**
 * 取节点上我们自己的数据。组件在不同回调里给的形状不同：
 * - 默认插槽给的是树节点（自定义字段挂在 `$$data` 上）；
 * - `on-node-click` 的第二个参数直接就是 `$$data`。
 * 这里统一归一化，两种都取得到。
 */
function dataOf(node: unknown): { type?: HazardType; count?: number } {
  if (!node || typeof node !== 'object') return {}
  const record = node as Record<string, unknown>
  const inner = record.$$data
  return (inner && typeof inner === 'object' ? inner : record) as {
    type?: HazardType
    count?: number
  }
}

/** 叶子（小类）节点携带原始数据行；大类节点没有，据此区分两类节点。 */
function leafOf(node: unknown): HazardType | null {
  return dataOf(node).type ?? null
}

/** 分组节点上的小类数量。 */
function countOf(node: unknown): number {
  const count = dataOf(node).count
  return typeof count === 'number' ? count : 0
}

function onNodeClick(node: unknown): void {
  const leaf = leafOf(node)
  if (leaf) openEdit(leaf)
}

function openCreate(): void {
  editing.value = null
  form.value = { major: '', minor: '' }
  showModal.value = true
}

function openEdit(row: HazardType): void {
  editing.value = row
  form.value = { major: row.major, minor: row.minor }
  showModal.value = true
}

async function handleSave(): Promise<void> {
  try {
    await formRef.value?.validate()
  } catch {
    return
  }
  saving.value = true
  try {
    const payload = { major: form.value.major.trim(), minor: form.value.minor.trim() }
    if (editing.value) {
      await hazardApi.updateType(editing.value.id, {
        ...payload,
        version: editing.value.version,
      })
      message.success('保存成功')
    } else {
      await hazardApi.createType(payload)
      message.success('新增成功')
    }
    showModal.value = false
    await load()
  } catch (error) {
    message.error(error instanceof Error ? error.message : '保存失败')
  } finally {
    saving.value = false
  }
}

function confirmDelete(): void {
  const current = editing.value
  if (!current) return
  dialog.warning({
    draggable: true,
    title: '确认删除隐患类型',
    content: `确定删除“${current.major} / ${current.minor}”吗？已被隐患记录引用的类型无法删除，只能修改。`,
    positiveText: '确认删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      deleting.value = true
      try {
        await hazardApi.deleteType(current.id, current.version)
        message.success('隐患类型已删除')
        showModal.value = false
        await load()
      } catch (error) {
        message.error(error instanceof Error ? error.message : '删除失败')
        return false
      } finally {
        deleting.value = false
      }
      return true
    },
  })
}
</script>

<template>
  <div class="page">
    <div class="page-header">
      <div>
        <h1 class="page-title">隐患类型</h1>
      </div>
      <div class="page-actions">
        <n-button v-if="canWrite" type="primary" @click="openCreate">新增隐患类型</n-button>
      </div>
    </div>

    <n-card class="data-card" :bordered="false">
      <n-spin :show="loading">
        <div v-if="treeData.length" class="hazard-type-tree">
          <!-- 组件要求传入单个根节点对象；这里用一层无标签的虚拟根把多个大类挂上去，
               并在样式里隐藏该根节点，页面上只看到「大类 → 小类」两级。 -->
          <Vue3TreeOrg
            :data="{ id: 'root', label: '', expand: true, children: treeData }"
            horizontal
            collapsable
            :draggable="false"
            :scalable="false"
            :node-draggable="false"
            :tool-bar="false"
            :define-menus="[]"
            @on-node-click="(_event: MouseEvent, node: unknown) => onNodeClick(node)"
          >
            <template #default="{ node }">
              <div
                class="hazard-type-node"
                :class="leafOf(node) ? 'is-leaf' : 'is-branch'"
                :title="leafOf(node) ? '点击编辑该小类' : node.label"
              >
                <span class="hazard-type-node__label">{{ node.label }}</span>
                <n-tag v-if="!leafOf(node)" size="small" type="info" :bordered="false">
                  {{ countOf(node) }} 个小类
                </n-tag>
                <span v-if="leafOf(node) && canWrite" class="hazard-type-node__edit">编辑</span>
              </div>
            </template>
          </Vue3TreeOrg>
        </div>
        <n-empty
          v-else-if="!loading"
          class="hazard-type-empty"
          description="还没有隐患类型，点右上角「新增隐患类型」"
        />
      </n-spin>
    </n-card>

    <n-modal
      v-model:show="showModal"
      preset="card"
      draggable
      :title="editing ? '编辑隐患类型' : '新增隐患类型'"
      style="width: min(520px, calc(100vw - 24px))"
      :mask-closable="false"
    >
      <n-form ref="formRef" :model="form" :rules="rules" label-placement="top">
        <n-form-item label="大类" path="major">
          <n-select
            v-model:value="form.major"
            :options="majorOptions"
            placeholder="可下拉选择已有大类，也可直接输入新大类"
            filterable
            tag
            clearable
          />
        </n-form-item>
        <n-form-item label="小类" path="minor">
          <n-input v-model:value="form.minor" placeholder="如：线路老化" />
        </n-form-item>
      </n-form>
      <template #footer>
        <div class="modal-footer">
          <div class="modal-footer-left">
            <n-button v-if="editing" type="error" ghost :loading="deleting" @click="confirmDelete">
              删除
            </n-button>
          </div>
          <div class="modal-footer-right">
            <n-button @click="showModal = false">取消</n-button>
            <n-button type="primary" :loading="saving" @click="handleSave">保存</n-button>
          </div>
        </div>
      </template>
    </n-modal>
  </div>
</template>

<style scoped>
/* 横向树容器：树宽超出卡片时横向滚动，绝不撑破卡片；上下留白由卡片自带内边距承担。 */
.hazard-type-tree {
  width: 100%;
  overflow: auto;
  padding: 4px 0 12px;
}

/* 节点内容：大类是带计数的标题块，小类是可点击卡片。
   颜色一律走 styles.css 里针对 .hazard-type-tree 的令牌适配，这里只管尺寸与排版。 */
.hazard-type-node {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 120px;
  padding: 8px 14px;
  white-space: nowrap;
}

.hazard-type-node__label {
  font-size: 13px;
  font-weight: 500;
}

.hazard-type-node.is-branch .hazard-type-node__label {
  font-size: 14px;
  font-weight: 600;
}

.hazard-type-node.is-leaf {
  cursor: pointer;
}

.hazard-type-node__edit {
  color: var(--color-text-muted);
  font-size: 12px;
}

.hazard-type-empty {
  padding: 40px 0;
}

.modal-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.modal-footer-right {
  display: flex;
  gap: 8px;
}
</style>
