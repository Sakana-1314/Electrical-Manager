<script setup lang="ts">
/**
 * 标签管理：台账标签的层级维护。
 *
 * 标签最多 3 层，页面用横向树呈现（大类在左、子标签向右展开，连线由 vue3-tree-org 绘制）：
 * - 鼠标悬停节点时浮层展示备注与图片；
 * - 点击节点打开编辑弹窗（可改名称 / 备注 / 图片 / 上级标签）；节点上的「+」在未到第 3 层且有写权限时出现，
 *   点它新增子标签并预选当前节点为上级；
 * - 各层节点样式一致（同字号同字重、卡片同尺寸），层级只由连线与缩进表达；
 *   节点上的数字是「使用该标签的台账记录数」（只算直接挂这个标签的记录，不含子标签的使用量，含 0），
 *   含义放在 tooltip 里；
 * - 顶部下拉筛选「孤立标签 / 树标签」，清空即不限（与全站筛选下拉一致，不放「全部」）。
 */
import { computed, ref, watch } from 'vue'
import {
  NButton,
  NCard,
  NEmpty,
  NIcon,
  NPopover,
  NSelect,
  NSpin,
  NTooltip,
  useMessage,
  type SelectOption,
} from 'naive-ui'
import { AddOutline } from '@vicons/ionicons5'
import { Vue3TreeOrg } from 'vue3-tree-org'
import 'vue3-tree-org/lib/vue3-tree-org.css'
import { ledgerApi } from '@/api/ledger'
import type { LedgerTag } from '@/api/generated'
import ImageThumbnails from '@/components/ImageThumbnails.vue'
import LedgerTagFormModal from '@/components/LedgerTagFormModal.vue'
import { useAuthStore } from '@/stores/auth'
import {
  LEDGER_TAG_MAX_LEVEL,
  buildLedgerTagTree,
  isOrphanTag,
  ledgerTagScopeOptions,
  tagItemCount,
  tagItemCountHint,
  type LedgerTagNode,
  type LedgerTagScope,
} from '@/utils/ledger'

const auth = useAuthStore()
const message = useMessage()
const canWrite = computed(() => auth.can('ledger:write'))

const loading = ref(false)
const tags = ref<LedgerTag[]>([])
const scope = ref<LedgerTagScope | null>(null)
const showModal = ref(false)
/** 编辑对象；为空表示新增（此时用 `parentId` 决定挂在哪个节点下）。 */
const editingTag = ref<LedgerTag | null>(null)
const parentId = ref<number | null>(null)

/** 筛选下拉：孤立标签 / 树标签，清空即不限。 */
const scopeOptions: SelectOption[] = ledgerTagScopeOptions.map((option) => ({
  label: option.label,
  value: option.value,
}))

/** 服务端按 scope 过滤：tree 节点对祖先闭合，剪枝后仍能拼出完整子树。 */
async function load(): Promise<void> {
  loading.value = true
  try {
    tags.value = await ledgerApi.tags(scope.value ? { scope: scope.value } : {})
  } catch (error) {
    message.error(error instanceof Error ? error.message : '标签加载失败')
  } finally {
    loading.value = false
  }
}

watch(scope, () => void load())
void load()

/** 树数据每次由列表派生，避免组件往节点写的 `$` 字段污染接口数据。 */
const treeData = computed(() => buildLedgerTagTree(tags.value))

function openCreate(parent: LedgerTag | null = null): void {
  editingTag.value = null
  parentId.value = parent?.id ?? null
  showModal.value = true
}

function openEdit(tag: LedgerTag): void {
  editingTag.value = tag
  parentId.value = null
  showModal.value = true
}

function openCreateChild(node: LedgerTagNode, event: MouseEvent): void {
  event.stopPropagation()
  openCreate(node.tag)
}

/**
 * 节点点击是否应该被忽略：只忽略落在「+」按钮上的点击。
 * 该按钮在未悬停时是透明的（见样式），点它不应连带打开编辑弹窗。
 */
function clickedAddButton(event: MouseEvent): boolean {
  const target = event.target
  return target instanceof Element && target.closest('.ledger-tag-node__add') !== null
}

/**
 * 取节点上的原始标签数据。组件在不同回调里给的形状不同：
 * 默认插槽给的是树节点（自定义字段挂在 `$$data` 上），`on-node-click` 的第二个参数直接就是它。
 */
function tagOf(node: unknown): LedgerTag | null {
  if (!node || typeof node !== 'object') return null
  const record = node as Record<string, unknown>
  const inner = record.$$data
  const data = (inner && typeof inner === 'object' ? inner : record) as { tag?: LedgerTag }
  return data.tag ?? null
}

function onNodeClick(event: MouseEvent, node: unknown): void {
  if (clickedAddButton(event)) return
  const tag = tagOf(node)
  if (tag) openEdit(tag)
}

/** 节点浮层：有备注或图片才挂，避免空浮层挡住旁边的节点。 */
function hasDetail(node: unknown): boolean {
  const tag = tagOf(node)
  return Boolean(tag && (tag.remark || tag.images.length))
}
</script>

<template>
  <div class="page">
    <div class="page-header">
      <div>
        <h1 class="page-title">标签管理</h1>
      </div>
      <div class="page-actions">
        <n-button v-if="canWrite" type="primary" @click="openCreate(null)">新增标签</n-button>
      </div>
    </div>

    <n-card class="filter-card" :bordered="false">
      <div class="filter-heading">
        <div class="filter-title">筛选条件</div>
      </div>
      <div class="filter-grid">
        <label class="filter-field">
          <span>标签范围</span>
          <n-select
            v-model:value="scope"
            :options="scopeOptions"
            placeholder="不限（清空即全部）"
            clearable
          />
        </label>
      </div>
    </n-card>

    <n-card class="data-card" :bordered="false">
      <n-spin :show="loading">
        <div v-if="treeData.length" class="org-tree-horizontal ledger-tag-tree">
          <!-- 组件要求传入单个根节点对象：这里用一层无标签的虚拟根把多棵子树挂上去，
               该根在样式里被隐藏，页面上只看到真正的层级。 -->
          <Vue3TreeOrg
            :data="{ id: 'root', label: '', expand: true, children: treeData }"
            horizontal
            collapsable
            :draggable="false"
            :scalable="false"
            :node-draggable="false"
            :tool-bar="false"
            :define-menus="[]"
            @on-node-click="(event: MouseEvent, node: unknown) => onNodeClick(event, node)"
          >
            <template #default="{ node }">
              <n-popover v-if="tagOf(node)" :disabled="!hasDetail(node)" trigger="hover" raw>
                <template #trigger>
                  <div class="ledger-tag-node" :title="tagOf(node)?.remark || tagOf(node)?.name">
                    <span class="ledger-tag-node__label">{{ node.label }}</span>
                    <!-- 台账使用数量：只用数字（含 0），口径放在 tooltip 里 -->
                    <n-tooltip v-if="tagItemCount(tagOf(node)!) !== null" trigger="hover">
                      <template #trigger>
                        <span class="ledger-tag-node__count">{{ tagItemCount(tagOf(node)!) }}</span>
                      </template>
                      {{ tagItemCountHint(tagItemCount(tagOf(node)!) ?? 0) }}
                    </n-tooltip>
                    <span v-if="isOrphanTag(tagOf(node)!)" class="ledger-tag-node__orphan">
                      孤立
                    </span>
                    <n-tooltip
                      v-if="canWrite && (tagOf(node)?.level ?? 1) < LEDGER_TAG_MAX_LEVEL"
                      trigger="hover"
                    >
                      <template #trigger>
                        <n-button
                          text
                          size="tiny"
                          type="primary"
                          class="ledger-tag-node__add"
                          aria-label="添加子标签"
                          @click="openCreateChild(node, $event)"
                        >
                          <template #icon>
                            <n-icon><AddOutline /></n-icon>
                          </template>
                        </n-button>
                      </template>
                      添加子标签
                    </n-tooltip>
                  </div>
                </template>
                <div class="ledger-tag-popover">
                  <div class="ledger-tag-popover__name">{{ tagOf(node)?.name }}</div>
                  <div v-if="tagOf(node)?.remark" class="ledger-tag-popover__remark">
                    {{ tagOf(node)?.remark }}
                  </div>
                  <ImageThumbnails
                    v-if="tagOf(node)?.images.length"
                    :images="tagOf(node)!.images"
                  />
                </div>
              </n-popover>
            </template>
          </Vue3TreeOrg>
        </div>
        <n-empty
          v-else-if="!loading"
          class="ledger-tag-empty"
          :description="scope ? '没有符合筛选条件的标签' : '还没有标签，点右上角「新增标签」建档'"
        />
      </n-spin>
    </n-card>

    <LedgerTagFormModal
      v-model:show="showModal"
      :tag="editingTag"
      :parent-id="parentId"
      @saved="load"
    />
  </div>
</template>

<style scoped>
/* 筛选区标题：与其它列表页同一套页面级样式（全局 styles.css 不提供这条）。 */
.filter-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 18px;
}

/* 横向树容器：树比卡片宽时容器内横向滚动，页面整体不出现横向滚动条。 */
.ledger-tag-tree {
  width: 100%;
  overflow: auto;
  padding: 4px 0 12px;
}

/* 节点内容：名称 + 台账使用数量 + 可选「+」入口。
   各层节点样式刻意保持一致（同字号、同字重、同内边距）：层级由连线表达，
   不用字号 / 字重 / 卡片尺寸区分；颜色一律走 styles.css 里针对 .org-tree-horizontal 的令牌适配，
   这里只管尺寸与排版。 */
.ledger-tag-node {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 120px;
  padding: 8px 14px;
  cursor: pointer;
  white-space: nowrap;
}

.ledger-tag-node__label {
  font-size: 13px;
  font-weight: 500;
}

/* 台账使用数量：一个安静的数字计数（含 0），不做成彩色标签以免抢层级视线 */
.ledger-tag-node__count {
  min-width: 18px;
  padding: 0 5px;
  border-radius: 9px;
  background-color: var(--color-primary-soft);
  color: var(--color-text-muted);
  font-size: 11px;
  line-height: 18px;
  text-align: center;
}

.ledger-tag-node__orphan {
  color: var(--color-text-muted);
  font-size: 11px;
}

/* 「+」入口：悬停节点时才显现（去掉文字，靠 tooltip 说明） */
.ledger-tag-node__add {
  opacity: 0;
  transition: opacity 0.15s ease;
}

.ledger-tag-node:hover .ledger-tag-node__add,
.ledger-tag-node:focus-within .ledger-tag-node__add {
  opacity: 1;
}

/* 悬停浮层：备注可能很长，限高内滚动；图片沿用全站缩略图组件。 */
.ledger-tag-popover {
  display: grid;
  gap: 8px;
  max-width: 320px;
}

.ledger-tag-popover__name {
  color: var(--color-text-strong);
  font-weight: 600;
}

.ledger-tag-popover__remark {
  max-height: 180px;
  overflow: auto;
  color: var(--color-text);
  font-size: 13px;
  line-height: 1.5;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}

.ledger-tag-empty {
  padding: 40px 0;
}
</style>
