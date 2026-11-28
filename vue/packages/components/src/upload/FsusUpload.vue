<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'
import { useFsusLocale } from '@fsusui/core'
import { FsusIcon } from '@fsusui/icons'
import FsusButton from '../button/FsusButton.vue'
import { FsusImageViewer } from '../image'

defineOptions({ name: 'FsusUpload' })

export type FsusUploadListType = 'text' | 'picture' | 'picture-card'

export interface FsusUploadFile {
  uid: string
  name: string
  size: number
  status: 'ready' | 'uploading' | 'success' | 'error'
  progress?: number
  url?: string
  response?: unknown
  raw?: File
}

export interface FsusUploadProps {
  action?: string
  method?: string
  headers?: Record<string, string>
  data?: Record<string, string | Blob>
  name?: string
  withCredentials?: boolean
  autoUpload?: boolean
  listType?: FsusUploadListType
  accept?: string
  multiple?: boolean
  drag?: boolean
  disabled?: boolean
  limit?: number
  showFileList?: boolean
  beforeUpload?: (file: File) => boolean | Promise<boolean>
  httpRequest?: (file: FsusUploadFile) => Promise<void>
}

const props = withDefaults(defineProps<FsusUploadProps>(), {
  method: 'POST',
  name: 'file',
  withCredentials: false,
  autoUpload: true,
  listType: 'text',
  multiple: false,
  drag: false,
  disabled: false,
  showFileList: true,
})

const fileList = defineModel<FsusUploadFile[]>('fileList', { default: () => [] })
const emit = defineEmits<{
  change: [file: FsusUploadFile, files: FsusUploadFile[]]
  remove: [file: FsusUploadFile, files: FsusUploadFile[]]
  progress: [percent: number, file: FsusUploadFile, files: FsusUploadFile[]]
  success: [response: unknown, file: FsusUploadFile, files: FsusUploadFile[]]
  error: [error: unknown, file: FsusUploadFile, files: FsusUploadFile[]]
  preview: [file: FsusUploadFile]
  exceed: [files: File[]]
}>()

const { t } = useFsusLocale()
const inputRef = ref<HTMLInputElement | null>(null)
const dragOver = ref(false)
const previewOpen = ref(false)
const previewUrl = ref('')
const activeXhrs = new Map<string, XMLHttpRequest>()
const createdObjectUrls = new Set<string>()
let uidSeed = 0

const revokeIfOwned = (url?: string) => {
  if (url && createdObjectUrls.has(url)) {
    URL.revokeObjectURL(url)
    createdObjectUrls.delete(url)
  }
}

onBeforeUnmount(() => {
  for (const xhr of activeXhrs.values()) xhr.abort()
  activeXhrs.clear()
  for (const url of createdObjectUrls) URL.revokeObjectURL(url)
  createdObjectUrls.clear()
})

const notifyListMutation = () => {
  fileList.value = [...fileList.value]
}

const uploadViaXhr = (entry: FsusUploadFile): Promise<unknown> =>
  new Promise((resolve, reject) => {
    if (!props.action || !entry.raw) {
      resolve(undefined)
      return
    }
    const xhr = new XMLHttpRequest()
    activeXhrs.set(entry.uid, xhr)
    xhr.open(props.method, props.action, true)
    xhr.withCredentials = props.withCredentials

    if (props.headers) {
      for (const [k, v] of Object.entries(props.headers)) {
        xhr.setRequestHeader(k, v)
      }
    }

    const formData = new FormData()
    if (props.data) {
      for (const [k, v] of Object.entries(props.data)) {
        formData.append(k, v)
      }
    }
    formData.append(props.name, entry.raw, entry.name)

    if (xhr.upload) {
      xhr.upload.onprogress = (ev: ProgressEvent) => {
        if (!ev.lengthComputable || ev.total <= 0) return
        const pct = Math.min(100, Math.round((ev.loaded / ev.total) * 100))
        entry.progress = pct
        notifyListMutation()
        emit('progress', pct, entry, fileList.value)
      }
    }

    xhr.onload = () => {
      activeXhrs.delete(entry.uid)
      if (xhr.status >= 200 && xhr.status < 300) {
        let parsed: unknown = xhr.responseText
        try {
          parsed = xhr.responseText ? JSON.parse(xhr.responseText) : xhr.responseText
        } catch {
          // keep plain text response
        }
        resolve(parsed)
      } else {
        reject(new Error(`Upload failed with status ${xhr.status}`))
      }
    }

    xhr.onerror = () => {
      activeXhrs.delete(entry.uid)
      reject(new Error('Network error during upload'))
    }

    xhr.onabort = () => {
      activeXhrs.delete(entry.uid)
      reject(new Error('Upload aborted'))
    }

    xhr.send(formData)
  })

const startUploadEntry = async (entry: FsusUploadFile) => {
  if (!props.httpRequest && !props.action) return
  entry.status = 'uploading'
  entry.progress = 0
  notifyListMutation()
  try {
    let response: unknown
    if (props.httpRequest) {
      await props.httpRequest(entry)
    } else {
      response = await uploadViaXhr(entry)
    }
    entry.status = 'success'
    entry.progress = 100
    entry.response = response
    notifyListMutation()
    emit('success', response, entry, fileList.value)
  } catch (err) {
    entry.status = 'error'
    notifyListMutation()
    emit('error', err, entry, fileList.value)
  }
}

const ingestFiles = async (rawFiles: File[]) => {
  if (props.disabled || rawFiles.length === 0) return
  if (props.limit !== undefined && fileList.value.length + rawFiles.length > props.limit) {
    emit('exceed', rawFiles)
    return
  }
  for (const raw of rawFiles) {
    if (props.beforeUpload && !(await props.beforeUpload(raw))) continue
    let url: string | undefined
    if (
      props.listType !== 'text' &&
      raw.type.startsWith('image/') &&
      typeof URL !== 'undefined' &&
      typeof URL.createObjectURL === 'function'
    ) {
      url = URL.createObjectURL(raw)
      createdObjectUrls.add(url)
    }
    const entry: FsusUploadFile = {
      uid: `fsus-file-${++uidSeed}`,
      name: raw.name,
      size: raw.size,
      status: 'ready',
      progress: 0,
      url,
      raw,
    }
    fileList.value = [...fileList.value, entry]
    emit('change', entry, fileList.value)

    if (props.autoUpload && (props.httpRequest || props.action)) {
      await startUploadEntry(entry)
    }
  }
}

const onFileChange = (event: Event) => {
  const input = event.target as HTMLInputElement
  const files = input.files ? Array.from(input.files) : []
  void ingestFiles(files)
  input.value = ''
}

const onDrop = (event: DragEvent) => {
  dragOver.value = false
  if (props.disabled) return
  const files = event.dataTransfer?.files ? Array.from(event.dataTransfer.files) : []
  void ingestFiles(files)
}

const abort = (file?: FsusUploadFile) => {
  if (file) {
    activeXhrs.get(file.uid)?.abort()
    activeXhrs.delete(file.uid)
  } else {
    for (const xhr of activeXhrs.values()) xhr.abort()
    activeXhrs.clear()
  }
}

const removeFile = (file: FsusUploadFile) => {
  abort(file)
  revokeIfOwned(file.url)
  fileList.value = fileList.value.filter((f) => f.uid !== file.uid)
  emit('remove', file, fileList.value)
}

const clearFiles = () => {
  abort()
  for (const f of fileList.value) revokeIfOwned(f.url)
  fileList.value = []
}

const submit = async () => {
  const pending = fileList.value.filter((f) => f.status === 'ready')
  for (const entry of pending) {
    await startUploadEntry(entry)
  }
}

const previewFile = (file: FsusUploadFile) => {
  emit('preview', file)
  if (file.url) {
    previewUrl.value = file.url
    previewOpen.value = true
  }
}

const triggerSelect = () => {
  if (!props.disabled) inputRef.value?.click()
}

defineExpose({ triggerSelect, submit, abort, clearFiles })
</script>

<template>
  <div
    class="fsus-upload"
    :data-list-type="listType"
    :data-disabled="disabled ? '' : undefined"
  >
    <input
      ref="inputRef"
      type="file"
      class="fsus-sr-only"
      :accept="accept"
      :multiple="multiple"
      :disabled="disabled"
      @change="onFileChange"
    />

    <!-- Picture-card layout -->
    <div v-if="listType === 'picture-card'" class="fsus-upload__card-grid">
      <div
        v-for="file in showFileList ? fileList : []"
        :key="file.uid"
        class="fsus-upload__card"
        :data-status="file.status"
      >
        <img v-if="file.url" :src="file.url" :alt="file.name" class="fsus-upload__thumb" />
        <FsusIcon v-else name="document" :size="24" />
        <div v-if="file.status === 'uploading'" class="fsus-upload__card-progress">
          <div class="fsus-upload__progress-bar" :style="{ width: `${file.progress ?? 0}%` }" />
        </div>
        <div class="fsus-upload__card-actions">
          <button
            v-if="file.url"
            type="button"
            class="fsus-upload__card-btn"
            :aria-label="t('image.preview')"
            @click="previewFile(file)"
          >
            <FsusIcon name="zoom-in" :size="14" />
          </button>
          <button
            type="button"
            class="fsus-upload__card-btn"
            :aria-label="t('upload.remove')"
            @click="removeFile(file)"
          >
            <FsusIcon name="delete" :size="14" />
          </button>
        </div>
      </div>

      <button
        type="button"
        class="fsus-upload__card fsus-upload__card-trigger"
        :disabled="disabled"
        :aria-label="t('upload.browse')"
        @click="triggerSelect"
      >
        <slot>
          <FsusIcon name="plus" :size="20" />
        </slot>
      </button>
    </div>

    <!-- Standard dropzone or button trigger -->
    <template v-else>
      <div
        v-if="drag"
        class="fsus-upload__dropzone"
        role="button"
        :tabindex="disabled ? -1 : 0"
        :data-dragover="dragOver ? '' : undefined"
        @click="triggerSelect"
        @keydown.enter.prevent="triggerSelect"
        @keydown.space.prevent="triggerSelect"
        @dragover.prevent="dragOver = true"
        @dragleave="dragOver = false"
        @drop.prevent="onDrop"
      >
        <slot>
          <FsusIcon name="upload" :size="24" />
          <p class="fsus-upload__hint">{{ t('upload.dropHint') }}</p>
        </slot>
      </div>

      <div v-else class="fsus-upload__trigger" @click="triggerSelect">
        <slot>
          <FsusButton icon="upload" :disabled="disabled">{{ t('upload.browse') }}</FsusButton>
        </slot>
      </div>

      <ul v-if="showFileList && fileList.length > 0" class="fsus-upload__list">
        <li
          v-for="file in fileList"
          :key="file.uid"
          class="fsus-upload__item"
          :data-status="file.status"
        >
          <img
            v-if="listType === 'picture' && file.url"
            :src="file.url"
            :alt="file.name"
            class="fsus-upload__item-thumb"
            @click="previewFile(file)"
          />
          <FsusIcon v-else name="document" :size="14" />
          <div class="fsus-upload__item-body">
            <button
              type="button"
              class="fsus-upload__name"
              @click="previewFile(file)"
            >
              {{ file.name }}
            </button>
            <div v-if="file.status === 'uploading'" class="fsus-upload__progress">
              <div class="fsus-upload__progress-bar" :style="{ width: `${file.progress ?? 0}%` }" />
            </div>
          </div>
          <span v-if="file.status === 'uploading'" class="fsus-upload__pct">
            {{ file.progress ?? 0 }}%
          </span>
          <button
            type="button"
            class="fsus-upload__remove"
            :aria-label="t('upload.remove')"
            @click="removeFile(file)"
          >
            <FsusIcon name="close" :size="12" />
          </button>
        </li>
      </ul>
    </template>

    <FsusImageViewer
      v-if="previewOpen && previewUrl"
      :url-list="[previewUrl]"
      @close="previewOpen = false"
    />
  </div>
</template>
