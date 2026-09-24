<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { useDialog, useMessage } from 'naive-ui'
import { markEventEffectPerformed } from 'naive-ui/es/_utils/event/index'
import { fileApi } from '@/api/files'
import type { FileObject } from '@/api/generated'
import { imagePreviewUrl, imageUrl, validateImageSelection } from '@/utils/image'

const props = withDefaults(
  defineProps<{ files: FileObject[]; disabled?: boolean; max?: number }>(),
  { max: 9 },
)
const emit = defineEmits<{ 'update:files': [files: FileObject[]] }>()
const input = ref<HTMLInputElement | null>(null)
const message = useMessage()
const dialog = useDialog()

/**
 * 同时上传的并发数。
 *
 * 不「全部一起传」：手机上选 9 张会同时开 9 个请求，互相抢带宽反而更慢，也看不清进度；
 * 也不串行（一张一张太慢）。固定 2 个并发、其余排队——每个文件有独立进度，失败只影响它自己。
 */
const UPLOAD_CONCURRENCY = 2

type PendingStatus = 'queued' | 'uploading' | 'error'

interface PendingUpload {
  key: string
  file: File
  name: string
  /** 0~100；拿不到总长时保持 0（按「不确定进度」展示） */
  percent: number
  status: PendingStatus
  error?: string
  /** 本地预览地址（objectURL），移除或卸载时需 revoke */
  previewUrl?: string
  controller?: AbortController
}

const pending = reactive<PendingUpload[]>([])
let keySeed = 0

const activeCount = computed(() => pending.filter((item) => item.status === 'uploading').length)
const busy = computed(() =>
  pending.some((item) => item.status === 'uploading' || item.status === 'queued'),
)
/** 占用名额的项（排队 + 上传中）；失败项不占名额，用户可重试或移除。 */
const occupyingCount = computed(
  () => pending.filter((item) => item.status === 'queued' || item.status === 'uploading').length,
)
const totalCount = computed(() => props.files.length + occupyingCount.value)

// n-image 内置预览与 n-modal 的 ESC 监听都挂在 document bubble 阶段；预览关闭自身时不会标记事件，
// 导致按一次 ESC 预览和弹窗同时关闭。这里用 capture 阶段监听，在预览打开时把 ESC 标记为已被内层消费，
// 让 n-modal 的 eventEffectNotPerformed 短路，实现一次只关一层。
function handleEscapeCapture(event: KeyboardEvent) {
  if (event.code === 'Escape' && document.querySelector('.n-image-preview-container')) {
    markEventEffectPerformed(event)
  }
}
onMounted(() => document.addEventListener('keydown', handleEscapeCapture, true))
onBeforeUnmount(() => {
  document.removeEventListener('keydown', handleEscapeCapture, true)
  // 卸载时中止在途请求并释放本地预览地址，避免内存泄漏
  for (const item of pending) {
    item.controller?.abort()
    if (item.previewUrl) URL.revokeObjectURL(item.previewUrl)
  }
})

function dropPending(item: PendingUpload) {
  const index = pending.indexOf(item)
  if (index >= 0) pending.splice(index, 1)
  if (item.previewUrl) URL.revokeObjectURL(item.previewUrl)
}

/** 把上传成功的文件并入 files（按 id 去重）。 */
function mergeUploaded(uploaded: FileObject) {
  const merged = [...props.files, uploaded]
  const unique = Array.from(new Map(merged.map((file) => [file.id, file])).values())
  if (unique.length < merged.length) message.info('已自动忽略重复图片')
  emit('update:files', unique)
}

async function runUpload(item: PendingUpload) {
  item.error = undefined
  item.controller = new AbortController()
  try {
    const uploaded = await fileApi.uploadImage(
      item.file,
      (percent) => {
        item.percent = percent
      },
      item.controller.signal,
    )
    dropPending(item)
    mergeUploaded(uploaded)
  } catch (error) {
    // 用户主动移除（中止请求）不算失败
    if (item.controller.signal.aborted) {
      item.status = 'queued'
      return
    }
    item.percent = 0
    item.status = 'error'
    item.error = error instanceof Error ? error.message : '图片上传失败'
  } finally {
    item.controller = undefined
    pump()
  }
}

/** 从队列补足并发额度。先同步置为 uploading，避免同一项被重复取出。 */
function pump() {
  while (activeCount.value < UPLOAD_CONCURRENCY) {
    const next = pending.find((item) => item.status === 'queued')
    if (!next) return
    next.status = 'uploading'
    void runUpload(next)
  }
}

/** 选中（或粘贴）若干文件后入队并启动上传。 */
function enqueue(selected: File[]) {
  if (!selected.length || props.disabled) return
  const validationError = validateImageSelection(totalCount.value, selected, props.max)
  if (validationError) {
    message.error(validationError)
    return
  }
  const items: PendingUpload[] = selected.map((file) => ({
    key: `pending-${(keySeed += 1)}`,
    file,
    name: file.name || '粘贴的图片',
    percent: 0,
    status: 'queued',
    // 上传完成前也能看到选了什么
    previewUrl: URL.createObjectURL(file),
  }))
  pending.push(...items)
  pump()
}

/** 重试失败项（重新排队，占用新的并发额度）。 */
function retry(item: PendingUpload) {
  item.percent = 0
  item.error = undefined
  item.status = 'queued'
  pump()
}

/** 移除排队中 / 上传中 / 失败项；上传中的先中止请求。 */
function removePending(item: PendingUpload) {
  item.controller?.abort()
  dropPending(item)
  pump()
}

function statusText(item: PendingUpload) {
  if (item.status === 'queued') return '排队中'
  if (item.status === 'uploading') return item.percent > 0 ? `上传中 ${item.percent}%` : '上传中'
  return item.error || '上传失败'
}

async function choose(event: Event) {
  const selected = Array.from((event.target as HTMLInputElement).files || [])
  try {
    enqueue(selected)
  } finally {
    if (input.value) input.value.value = ''
  }
}

async function pasteImages(event: ClipboardEvent) {
  if (props.disabled) return
  const selected = Array.from(event.clipboardData?.items || [])
    .filter((item) => item.kind === 'file' && item.type.startsWith('image/'))
    .map((item) => item.getAsFile())
    .filter((file): file is File => file !== null)
  if (!selected.length) {
    message.warning('剪贴板中没有可粘贴的图片')
    return
  }
  event.preventDefault()
  enqueue(selected)
}

/** 删除已上传图片：先二次确认（软删除后立即从业务隐藏）。 */
function confirmRemove(file: FileObject) {
  dialog.warning({
    draggable: true,
    title: '删除图片',
    content: `确定删除「${file.original_name || '这张图片'}」吗？删除后该图片立即从业务中隐藏，保留期内可由管理员恢复。`,
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      await remove(file)
    },
  })
}

async function remove(file: FileObject) {
  try {
    await fileApi.removeImage(file.id)
  } catch {
    /* 已被草稿引用时由保存接口统一处理 */
  }
  emit(
    'update:files',
    props.files.filter((x) => x.id !== file.id),
  )
}
</script>

<template>
  <div class="image-upload-field">
    <div
      class="image-uploader"
      :tabindex="disabled ? -1 : 0"
      :aria-disabled="disabled"
      aria-label="图片上传区域，支持 Ctrl+V 粘贴图片"
      @paste="pasteImages"
    >
      <div v-for="file in files" :key="file.id" class="image-item">
        <n-image
          :src="imagePreviewUrl(file.id, 192)"
          :preview-src="imageUrl(file.id)"
          :alt="file.original_name"
          object-fit="cover"
          width="96"
          height="96"
        />
        <n-button
          v-if="!disabled"
          class="remove"
          size="tiny"
          circle
          type="error"
          :aria-label="`删除 ${file.original_name}`"
          @click="confirmRemove(file)"
          >×</n-button
        >
      </div>
      <!-- 排队 / 上传中 / 失败：与已上传图片同一条流，各显示自己的进度 -->
      <div v-for="item in pending" :key="item.key" class="upload-item" :class="`is-${item.status}`">
        <div
          class="upload-thumb"
          :style="item.previewUrl ? { backgroundImage: `url(${item.previewUrl})` } : undefined"
        />
        <div class="upload-body">
          <span class="upload-name" :title="item.name">{{ item.name }}</span>
          <div
            class="upload-progress"
            role="progressbar"
            :aria-valuenow="item.percent"
            aria-valuemin="0"
            aria-valuemax="100"
            :aria-label="`${item.name} 上传进度`"
          >
            <div class="upload-progress-fill" :style="{ width: `${item.percent}%` }" />
          </div>
          <span class="upload-status">{{ statusText(item) }}</span>
        </div>
        <div class="upload-actions">
          <button
            v-if="item.status === 'error'"
            type="button"
            class="upload-btn"
            @click="retry(item)"
          >
            重试
          </button>
          <button
            type="button"
            class="upload-btn upload-btn--danger"
            :aria-label="`移除 ${item.name}`"
            @click="removePending(item)"
          >
            ×
          </button>
        </div>
      </div>
      <button
        v-if="!disabled && totalCount < max"
        type="button"
        class="upload-trigger"
        :disabled="busy"
        @click="input?.click()"
      >
        <span class="plus">+</span>
        <span v-if="activeCount > 0">上传中 {{ activeCount }}</span>
        <span v-else-if="busy">排队中</span>
        <span v-else>添加图片</span>
      </button>
      <input
        ref="input"
        hidden
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp"
        @change="choose"
      />
    </div>
    <p class="image-hint">
      JPG / PNG / WebP · 单张不超过 10 MB · 最多 {{ max }} 张 · 支持 Ctrl+V 粘贴 · 可多选，最多
      {{ UPLOAD_CONCURRENCY }} 张同时上传
    </p>
  </div>
</template>

<style scoped>
.image-upload-field {
  width: 100%;
}
.image-uploader {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  min-height: 104px;
  padding: 12px;
  border: 1px solid var(--color-border-subtle);
  border-radius: 12px;
  background: var(--color-surface-soft);
}
.image-uploader:focus-visible {
  outline: 2px solid rgb(63 99 216 / 30%);
  outline-offset: 2px;
}
.image-item {
  position: relative;
  width: 98px;
  height: 98px;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  background: var(--color-surface);
  overflow: hidden;
}
.remove {
  position: absolute;
  top: 4px;
  right: 4px;
}
/* 上传中的占位：与已上传图片同高的方块，内部显示缩略图与进度 */
.upload-item {
  display: flex;
  width: 168px;
  height: 98px;
  min-width: 0;
  align-items: center;
  gap: 8px;
  padding: 8px;
  border: 1px dashed var(--color-dashed-border);
  border-radius: 10px;
  background: var(--color-surface);
}
.upload-item.is-error {
  border-style: solid;
  border-color: var(--color-danger);
}
.upload-thumb {
  flex: none;
  width: 40px;
  height: 40px;
  border-radius: 8px;
  background-color: var(--color-surface-soft);
  background-position: center;
  background-size: cover;
}
.upload-body {
  display: flex;
  flex: 1 1 auto;
  min-width: 0;
  flex-direction: column;
  gap: 4px;
}
.upload-name {
  overflow: hidden;
  color: var(--color-text);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.upload-progress {
  width: 100%;
  height: 4px;
  border-radius: 99px;
  background: var(--color-border-subtle);
  overflow: hidden;
}
.upload-progress-fill {
  height: 100%;
  border-radius: 99px;
  background: var(--color-primary);
  transition: width 0.2s ease;
}
.upload-item.is-error .upload-progress-fill {
  background: var(--color-danger);
}
.upload-status {
  overflow: hidden;
  color: var(--color-text-muted);
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.upload-item.is-error .upload-status {
  color: var(--color-danger);
}
.upload-actions {
  display: flex;
  flex: none;
  flex-direction: column;
  gap: 4px;
}
.upload-btn {
  padding: 1px 6px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-surface);
  color: var(--color-text);
  font-size: 11px;
  line-height: 1.6;
  cursor: pointer;
}
.upload-btn:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
}
.upload-btn--danger {
  padding: 1px 7px;
}
.upload-btn--danger:hover {
  border-color: var(--color-danger);
  color: var(--color-danger);
}
.upload-trigger {
  width: 98px;
  height: 98px;
  border: 1px dashed var(--color-dashed-border);
  border-radius: 10px;
  background: var(--color-surface);
  color: var(--color-text-muted);
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  transition:
    border-color 0.2s ease,
    background-color 0.2s ease,
    color 0.2s ease;
}
.upload-trigger:hover {
  border-color: var(--color-primary);
  background: var(--color-primary-soft);
  color: var(--color-primary);
}
.upload-trigger:disabled {
  cursor: wait;
  opacity: 0.7;
}
.plus {
  font-size: 28px;
  line-height: 1;
}
.image-hint {
  margin: 7px 2px 0;
  color: var(--color-text-muted);
  font-size: 12px;
  line-height: 1.6;
}
</style>
