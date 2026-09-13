<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref } from 'vue'
import { useDialog, useMessage } from 'naive-ui'
import type { Memo } from '@/api/generated'
import { memoApi } from '@/api/memos'
import LoadingMask from '@/components/LoadingMask.vue'
import { useAuthStore } from '@/stores/auth'
import { formatShanghaiTime } from '@/utils/time'
import {
  hasPendingDraft,
  memoDraftKey,
  pruneMemoDrafts,
  readMemoDrafts,
  removeMemoDraft,
  writeMemoDraft,
} from '@/utils/memoDrafts'
import { MEMO_FONT_SIZE_OPTIONS, readMemoFontSize, writeMemoFontSize } from '@/utils/memoFontSize'

const message = useMessage()
const dialog = useDialog()
const auth = useAuthStore()
/** 草稿按用户隔离存储，同一浏览器切换账号不会互相串号。 */
const userId = auth.user?.id ?? 0

const memos = ref<Memo[]>([])
const activeId = ref<number | null>(null)
const loading = ref(true)
/** 新建请求在途标记：按钮置灰并忽略重复确认，避免连点建出多条空白备忘录。 */
const creating = ref(false)

/** 编辑区字号：进入页面时读取浏览器本地记录（默认 16px），改动只落本地、不产生请求。 */
const fontSize = ref(readMemoFontSize())
const fontSizeOptions = MEMO_FONT_SIZE_OPTIONS.map((size) => ({
  label: `${size}px`,
  value: size,
}))

function changeFontSize(value: number): void {
  fontSize.value = writeMemoFontSize(value)
}

interface MemoDraft {
  title: string
  content: string
  /** 与服务端内容存在差异（未保存）。 */
  dirty: boolean
  /** 保存请求在途，期间再次点击保存不会重复发请求。 */
  saving: boolean
  /** 最后一次本地修改时间（epoch ms）。 */
  editedAt: number
}

/** 各备忘录的工作副本（含未保存修改），key = memo id。 */
const drafts = reactive(new Map<number, MemoDraft>())

/** 本地草稿写入 IndexedDB 的防抖时间：只落浏览器本地，不产生服务端请求。 */
const DRAFT_WRITE_DELAY = 300
const draftTimers = new Map<number, ReturnType<typeof setTimeout>>()

const activeMemo = computed(() => memos.value.find((memo) => memo.id === activeId.value) ?? null)
const activeDraft = computed(() =>
  activeId.value == null ? undefined : drafts.get(activeId.value),
)

function draftOf(id: number): MemoDraft | undefined {
  return drafts.get(id)
}

/** 抽屉里显示的名称：优先显示本地未保存的标题。 */
function listTitle(memo: Memo): string {
  return draftOf(memo.id)?.title.trim() || memo.title
}

function isPending(id: number): boolean {
  return draftOf(id)?.dirty ?? false
}

/** 为指定备忘录准备工作副本（已有未保存草稿时保持不变）。 */
function ensureDraft(memo: Memo): MemoDraft {
  const existing = drafts.get(memo.id)
  if (existing) return existing
  const draft: MemoDraft = {
    title: memo.title,
    content: memo.content,
    dirty: false,
    saving: false,
    editedAt: Date.now(),
  }
  drafts.set(memo.id, draft)
  return draft
}

/** 切换当前备忘录：先把上一条的本地草稿落库（纯本地操作，不发请求）。 */
function activate(id: number | null): void {
  const previousId = activeId.value
  if (previousId != null && (draftTimers.has(previousId) || isPending(previousId))) {
    flushDraft(previousId)
  }
  activeId.value = id
  const memo = memos.value.find((item) => item.id === id)
  if (memo) ensureDraft(memo)
}

function flushDraft(id: number): void {
  const timer = draftTimers.get(id)
  if (timer) {
    clearTimeout(timer)
    draftTimers.delete(id)
  }
  const draft = drafts.get(id)
  if (!draft) return
  if (!draft.dirty) {
    void removeMemoDraft(userId, id)
    return
  }
  void writeMemoDraft({
    key: memoDraftKey(userId, id),
    userId,
    memoId: id,
    title: draft.title,
    content: draft.content,
    editedAt: draft.editedAt,
  })
}

function scheduleDraftWrite(id: number): void {
  const timer = draftTimers.get(id)
  if (timer) clearTimeout(timer)
  draftTimers.set(
    id,
    setTimeout(() => {
      draftTimers.delete(id)
      flushDraft(id)
    }, DRAFT_WRITE_DELAY),
  )
}

/** 编辑即标记未保存：只记录本地草稿，是否提交完全由「保存」按钮决定。 */
function handleEdit(): void {
  const memo = activeMemo.value
  const draft = activeDraft.value
  if (!memo || !draft) return
  draft.editedAt = Date.now()
  // 改回与服务端一致的内容时自动取消未保存标记。
  draft.dirty = hasPendingDraft(draft, memo)
  scheduleDraftWrite(memo.id)
}

async function loadMemos(): Promise<void> {
  loading.value = true
  try {
    const list = await memoApi.listMemos()
    memos.value = list
    // 恢复上次未提交的本地草稿（刷新 / 切换页面后仍能看到未保存内容）。
    for (const record of await readMemoDrafts(userId)) {
      const memo = list.find((item) => item.id === record.memoId)
      if (!memo || !hasPendingDraft(record, memo)) continue
      drafts.set(record.memoId, {
        title: record.title,
        content: record.content,
        dirty: true,
        saving: false,
        editedAt: record.editedAt,
      })
    }
    // 服务端已删除的备忘录，草稿一并清理。
    void pruneMemoDrafts(
      userId,
      list.map((item) => item.id),
    )
    activate(list[0]?.id ?? null)
  } catch (error) {
    message.error(error instanceof Error ? error.message : '加载备忘录失败')
  } finally {
    loading.value = false
  }
}

/** 保存当前备忘录：只有点击「保存」（或 Ctrl+S）才会发出请求。 */
async function saveActive(): Promise<void> {
  const memo = activeMemo.value
  const draft = activeDraft.value
  // 未修改、或已有保存请求在途时直接返回，杜绝重复 / 并发请求。
  if (!memo || !draft || !draft.dirty || draft.saving) return
  draft.saving = true
  const payload = { title: draft.title, content: draft.content }
  try {
    const updated = await memoApi.updateMemo(memo.id, { ...payload, version: memo.version })
    memo.title = updated.title
    memo.content = updated.content
    memo.version = updated.version
    memo.updated_at = updated.updated_at
    if (draft.title === payload.title && draft.content === payload.content) {
      // 保存期间没有新输入：同步服务端规范化后的标题并清掉本地草稿。
      draft.title = updated.title
      draft.content = updated.content
      draft.dirty = false
      flushDraft(memo.id)
    } else {
      // 保存期间又改了内容：新修改继续留在本地草稿，等待下次保存。
      draft.dirty = true
      scheduleDraftWrite(memo.id)
    }
  } catch (error) {
    message.error(error instanceof Error ? error.message : '保存失败，请重试')
  } finally {
    draft.saving = false
  }
}

/** 新建备忘录：先弹窗确认，请求在途时按钮置灰并忽略重复确认。 */
function confirmCreate(): void {
  if (creating.value) return
  dialog.info({
    title: '新建备忘录',
    content: '将新建一条空白备忘录，确定新建吗？',
    positiveText: '新建',
    negativeText: '取消',
    onPositiveClick: async () => {
      if (creating.value) return false
      creating.value = true
      try {
        const created = await memoApi.createMemo()
        memos.value.unshift(created)
        ensureDraft(created)
        activate(created.id)
      } catch (error) {
        message.error(error instanceof Error ? error.message : '新建备忘录失败')
        return false
      } finally {
        creating.value = false
      }
    },
  })
}

function confirmDelete(memo: Memo | null): void {
  if (!memo) return
  const title = listTitle(memo) || '未命名备忘录'
  dialog.warning({
    title: '删除备忘录',
    content: isPending(memo.id)
      ? `「${title}」有尚未保存的修改，删除后不可恢复。确定删除吗？`
      : `确定删除「${title}」吗？删除后不可恢复。`,
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        await memoApi.deleteMemo(memo.id)
        const index = memos.value.findIndex((item) => item.id === memo.id)
        if (index >= 0) memos.value.splice(index, 1)
        const timer = draftTimers.get(memo.id)
        if (timer) {
          clearTimeout(timer)
          draftTimers.delete(memo.id)
        }
        drafts.delete(memo.id)
        void removeMemoDraft(userId, memo.id)
        if (activeId.value === memo.id) {
          activate(memos.value[Math.min(index, memos.value.length - 1)]?.id ?? null)
        }
      } catch (error) {
        message.error(error instanceof Error ? error.message : '删除失败，请重试')
        return false
      }
    },
  })
}

/** 左下角状态：已保存 / 未保存（带时间戳）/ 正在保存。 */
const saveStatus = computed(() => {
  const draft = activeDraft.value
  if (!draft) return { type: 'saved', text: '' }
  if (draft.saving) return { type: 'saving', text: '正在保存…' }
  if (draft.dirty) {
    return {
      type: 'dirty',
      text: `未保存 ${formatShanghaiTime(new Date(draft.editedAt).toISOString())}`,
    }
  }
  const memo = activeMemo.value
  return { type: 'saved', text: memo ? `已保存 ${formatShanghaiTime(memo.updated_at)}` : '' }
})

function onEditorKeydown(event: KeyboardEvent): void {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
    event.preventDefault()
    void saveActive()
  }
}

onBeforeUnmount(() => {
  // 离开页面时不发服务端请求，只把未保存内容落到本地草稿。
  for (const id of [...draftTimers.keys()]) flushDraft(id)
})

void loadMemos()
</script>

<template>
  <div class="page memo-page" :style="{ '--memo-font-size': `${fontSize}px` }">
    <div class="page-header">
      <div>
        <h1 class="page-title">备忘录</h1>
      </div>
      <div class="page-actions">
        <n-space :size="10" align="center">
          <span class="memo-font-size-label">字号</span>
          <n-select
            class="memo-font-size-select"
            :value="fontSize"
            :options="fontSizeOptions"
            @update:value="changeFontSize"
          />
          <n-button type="primary" :loading="creating" :disabled="creating" @click="confirmCreate">
            新建备忘录
          </n-button>
        </n-space>
      </div>
    </div>

    <n-card class="memo-card" :content-style="{ padding: '0' }">
      <LoadingMask :show="loading" text="加载中…" />
      <div class="memo-shell">
        <aside class="memo-drawer" aria-label="备忘录列表">
          <div class="memo-drawer-head">
            <span class="memo-drawer-title">全部备忘录</span>
            <span class="memo-count">{{ memos.length }}</span>
          </div>
          <p v-if="!loading && memos.length === 0" class="memo-drawer-empty">暂无备忘录</p>
          <ul v-else class="memo-list">
            <li v-for="memo in memos" :key="memo.id">
              <button
                type="button"
                class="memo-item"
                :class="{ 'memo-item--active': memo.id === activeId }"
                @click="activate(memo.id)"
              >
                <span class="memo-item-title">{{ listTitle(memo) }}</span>
                <span class="memo-item-meta">
                  <span>{{ formatShanghaiTime(memo.updated_at) }}</span>
                  <span v-if="isPending(memo.id)" class="memo-dirty-dot" title="有尚未保存的修改" />
                </span>
              </button>
            </li>
          </ul>
        </aside>

        <section class="memo-pane">
          <n-empty
            v-if="activeId === null"
            class="memo-pane-empty"
            size="large"
            description="还没有备忘录，新建一条开始记录吧"
          >
            <template #extra>
              <n-button
                type="primary"
                :loading="creating"
                :disabled="creating"
                @click="confirmCreate"
              >
                新建备忘录
              </n-button>
            </template>
          </n-empty>

          <div v-else-if="activeDraft" class="memo-editor" @keydown="onEditorKeydown">
            <n-input
              v-model:value="activeDraft.title"
              class="memo-title-input"
              placeholder="备忘录标题"
              maxlength="64"
              show-count
              @update:value="handleEdit"
            />
            <n-input
              v-model:value="activeDraft.content"
              type="textarea"
              class="memo-content-input"
              placeholder="在这里记录纯文本内容，点击「保存」后才会提交（Ctrl+S 亦可保存）…"
              :autosize="{ minRows: 12, maxRows: 30 }"
              maxlength="10000"
              show-count
              @update:value="handleEdit"
            />
            <div class="memo-actions">
              <span class="memo-status" :class="`memo-status--${saveStatus.type}`">
                {{ saveStatus.text }}
              </span>
              <n-space :size="10" align="center">
                <n-button
                  secondary
                  type="error"
                  :disabled="activeDraft.saving"
                  @click="confirmDelete(activeMemo)"
                >
                  删除
                </n-button>
                <n-button
                  type="primary"
                  :loading="activeDraft.saving"
                  :disabled="!activeDraft.dirty"
                  @click="saveActive"
                >
                  保存
                </n-button>
              </n-space>
            </div>
          </div>
        </section>
      </div>
    </n-card>
  </div>
</template>

<style scoped>
/* 页面高度充满窗口（上下保留内容区内边距）。
   内容区容器的高度由内容撑开，百分比无法生效，因此用视口高度减去
   「顶栏 + 内容区上下内边距」这层固定框架高度（移动端数值更小，见文末媒体查询）；
   高度确定后，内部抽屉与编辑区才能撑满窗口并在各自区域内滚动。 */
.memo-page {
  --memo-page-chrome: 124px;
  height: calc(100vh - var(--memo-page-chrome));
  height: calc(100dvh - var(--memo-page-chrome));
  /* 窗口过矮时保住可用的编辑高度，由内容区整体滚动 */
  min-height: 480px;
}

/* 卡片纵向撑满页面剩余高度，让内部抽屉与编辑区一起充满窗口。 */
.memo-card {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-height: 0;
}

.memo-card :deep(.n-card-content) {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-height: 0;
}

/* 左侧固定抽屉：列表常驻显示，不参与折叠，右侧保留完整编辑区。 */
.memo-shell {
  display: flex;
  flex: 1 1 auto;
  align-items: stretch;
  min-height: 0;
}

.memo-drawer {
  display: flex;
  flex: none;
  flex-direction: column;
  gap: 10px;
  width: 248px;
  padding: 16px 12px;
  overflow: hidden;
  border-right: 1px solid var(--color-border);
  border-radius: var(--radius-card) 0 0 var(--radius-card);
  background: var(--color-surface-muted);
}

.memo-drawer-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 6px;
}

.memo-drawer-title {
  color: var(--color-text-strong);
  font-size: 13px;
  font-weight: 600;
}

.memo-count {
  padding: 1px 8px;
  border-radius: 99px;
  background: var(--color-primary-soft);
  color: var(--color-primary);
  font-size: 12px;
  font-weight: 600;
}

.memo-drawer-empty {
  margin: 0;
  padding: 4px 6px;
  color: var(--color-text-muted);
  font-size: 13px;
}

.memo-list {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  gap: 4px;
  min-height: 0;
  margin: 0;
  padding: 0;
  overflow-y: auto;
  list-style: none;
}

.memo-item {
  display: grid;
  gap: 4px;
  width: 100%;
  padding: 9px 10px 9px 9px;
  border: 1px solid transparent;
  border-left: 3px solid transparent;
  border-radius: 10px;
  background: transparent;
  color: var(--color-text);
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition:
    background 0.15s ease,
    border-color 0.15s ease;
}

.memo-item:hover {
  background: var(--color-surface);
}

.memo-item--active {
  border-color: var(--color-border);
  border-left-color: var(--color-primary);
  background: var(--color-surface);
  color: var(--color-text-strong);
}

.memo-item-title {
  overflow: hidden;
  font-size: 14px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.memo-item-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--color-text-muted);
  font-size: 12px;
  font-weight: 400;
}

.memo-dirty-dot {
  flex: none;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--color-warning);
}

.memo-pane {
  flex: 1;
  min-width: 0;
  overflow-y: auto;
  padding: 16px 20px 18px;
}

.memo-pane-empty {
  padding: 70px 0;
}

.memo-editor {
  display: grid;
  gap: 12px;
}

/* 字号由页头「字号」下拉控制（默认 16px）。这里只覆盖 Naive 输入框根元素的 font-size：
   内部的 input / textarea / 自动高度镜像 / 字数统计都继承该字号，
   自动高度测量与显示保持一致；单行输入行高固定为 --n-height，大字号也不会被裁切。 */
.memo-editor :deep(.n-input) {
  font-size: var(--memo-font-size, 16px);
}

.memo-font-size-label {
  color: var(--color-text-muted);
  font-size: 13px;
}

.memo-font-size-select {
  width: 108px;
}

.memo-title-input {
  max-width: 480px;
}

.memo-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
}

.memo-status {
  color: var(--color-text-muted);
  font-size: 13px;
}

.memo-status--dirty {
  color: var(--color-warning);
}

/* 窄屏：抽屉改为内容区上方的横向列表，避免左右挤压。 */
@media (max-width: 768px) {
  /* 移动端框架高度：顶栏 56 + 内容区上下内边距 16 / 24 */
  .memo-page {
    --memo-page-chrome: 96px;
  }

  .memo-shell {
    flex-direction: column;
  }

  .memo-drawer {
    width: 100%;
    border-right: none;
    border-bottom: 1px solid var(--color-border);
    border-radius: var(--radius-card) var(--radius-card) 0 0;
  }

  .memo-list {
    flex: none;
    flex-direction: row;
    overflow-x: auto;
    overflow-y: hidden;
  }

  .memo-item {
    flex: none;
    width: 168px;
    border-left-width: 1px;
    border-bottom: 3px solid transparent;
  }

  .memo-item--active {
    border-bottom-color: var(--color-primary);
    border-left-color: transparent;
  }
}
</style>
