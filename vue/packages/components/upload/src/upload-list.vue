<template>
  <transition-group tag="ul" :class="containerKls" :name="listTransitionName">
    <li
      v-for="file in files"
      :key="file.uid || file.name"
      :class="[
        nsUpload.be('list', 'item'),
        nsUpload.is(file.status),
        nsUpload.is('disabled', disabled),
      ]"
      tabindex="0"
      @keydown.delete="!disabled && handleRemove(file)"
    >
      <slot :file="file">
        <img
          v-if="
            listType === 'picture' ||
            (file.status !== 'uploading' && listType === 'picture-card')
          "
          :class="nsUpload.be('list', 'item-thumbnail')"
          :src="file.url"
          alt=""
        />
        <div
          v-if="file.status === 'uploading' || listType !== 'picture-card'"
          :class="nsUpload.be('list', 'item-info')"
        >
          <button
            type="button"
            :class="nsUpload.be('list', 'item-name')"
            :aria-label="t('el.upload.preview')"
            @click="handlePreviewClick(file)"
          >
            <el-icon :class="nsIcon.m('document')">
              <Document />
            </el-icon>
            <span
              :class="nsUpload.be('list', 'item-file-name')"
              :title="file.name"
            >
              {{ file.name }}
            </span>
          </button>
          <el-progress
            v-if="file.status === 'uploading'"
            :type="listType === 'picture-card' ? 'circle' : 'line'"
            :stroke-width="listType === 'picture-card' ? 6 : 2"
            :percentage="Number(file.percentage)"
            :style="
              listType === 'picture-card' || listType === 'text'
                ? undefined
                : 'margin-top: 0.5rem'
            "
          />
        </div>

        <!-- Ordinary text list: always-visible status + row-end actions (#456) -->
        <template v-if="listType === 'text'">
          <div
            :class="nsUpload.be('list', 'item-status-label')"
            role="status"
            :aria-label="statusText(file)"
          >
            <el-icon
              v-if="file.status === 'success'"
              :class="[nsIcon.m('upload-success'), nsIcon.m('circle-check')]"
            >
              <circle-check />
            </el-icon>
            <el-icon
              v-else-if="file.status === 'fail'"
              :class="[nsIcon.m('upload-fail'), nsIcon.m('circle-close')]"
            >
              <circle-close />
            </el-icon>
            <el-icon
              v-else-if="file.status === 'uploading'"
              :class="[nsIcon.m('upload-progress'), nsIcon.m('loading')]"
            >
              <loading />
            </el-icon>
            <span :class="nsUpload.be('list', 'item-status-text')">
              {{ statusText(file) }}
            </span>
          </div>
          <div v-if="!disabled" :class="nsUpload.be('list', 'item-actions')">
            <button
              type="button"
              :class="[nsIcon.m('close'), nsUpload.be('list', 'item-delete')]"
              :aria-label="
                file.status === 'uploading'
                  ? actionLabel('cancel')
                  : t('el.upload.delete')
              "
              @click.stop="handleRemove(file)"
            >
              <el-icon>
                <Close />
              </el-icon>
            </button>
          </div>
        </template>

        <!-- picture / picture-card: preserve existing structure (out of #456 scope) -->
        <template v-else>
          <label :class="nsUpload.be('list', 'item-status-label')">
            <el-icon :class="[nsIcon.m('upload-success'), nsIcon.m('check')]">
              <Check />
            </el-icon>
          </label>
          <button
            v-if="!disabled"
            type="button"
            :class="nsIcon.m('close')"
            :aria-label="t('el.upload.delete')"
            @click.stop="handleRemove(file)"
          >
            <el-icon>
              <Close />
            </el-icon>
          </button>
          <i v-if="!disabled" :class="nsIcon.m('close-tip')">{{
            t('el.upload.deleteTip')
          }}</i>
          <span
            v-if="listType === 'picture-card'"
            :class="nsUpload.be('list', 'item-actions')"
          >
            <button
              type="button"
              :class="nsUpload.be('list', 'item-preview')"
              :aria-label="t('el.upload.preview')"
              @click.stop="handlePreviewClick(file)"
            >
              <el-icon :class="nsIcon.m('zoom-in')"><zoom-in /></el-icon>
            </button>
            <button
              v-if="!disabled"
              type="button"
              :class="nsUpload.be('list', 'item-delete')"
              :aria-label="t('el.upload.delete')"
              @click.stop="handleRemove(file)"
            >
              <el-icon :class="nsIcon.m('delete')">
                <Delete />
              </el-icon>
            </button>
          </span>
        </template>
      </slot>
    </li>
    <slot name="append" />
  </transition-group>
</template>
<script lang="ts" setup>
import { computed } from 'vue'
import { ElIcon } from '@element-plus/components/icon'
import {
  Check,
  CircleCheck,
  CircleClose,
  Close,
  Delete,
  Document,
  Loading,
  ZoomIn,
} from '@element-plus/icons-vue'
import { useLocale, useNamespace } from '@element-plus/hooks'
import ElProgress from '@element-plus/components/progress'
import { useFormDisabled } from '@element-plus/components/form'

import { uploadListEmits, uploadListProps } from './upload-list'
import type { UploadFile, UploadStatus } from './upload'

defineOptions({
  name: 'ElUploadList',
})

const props = defineProps(uploadListProps)
const emit = defineEmits(uploadListEmits)

const { t } = useLocale()
const nsUpload = useNamespace('upload')
const nsIcon = useNamespace('icon')
const disabled = useFormDisabled()

/** Dedicated list transition (not the legacy 500ms/30px el-list motion). */
const listTransitionName = computed(() => nsUpload.b('list'))

const containerKls = computed(() => [
  nsUpload.b('list'),
  nsUpload.bm('list', props.listType),
  nsUpload.is('disabled', props.disabled),
])

const STATUS_DEFAULTS: Record<UploadStatus, string> = {
  ready: 'Pending',
  uploading: 'Uploading',
  success: 'Uploaded',
  fail: 'Failed',
}

const ACTION_DEFAULTS = {
  cancel: 'Cancel',
  retry: 'Retry',
} as const

const resolveLabel = (path: string, fallback: string) => {
  const translated = t(path)
  return !translated ||
    translated === path ||
    translated.startsWith('el.upload.')
    ? fallback
    : translated
}

const statusText = (file: UploadFile) => {
  if (file.status === 'uploading') {
    const pct = Number(file.percentage)
    if (Number.isFinite(pct) && pct > 0) {
      return `${Math.round(pct)}%`
    }
  }
  const key =
    file.status === 'fail'
      ? 'el.upload.error'
      : (`el.upload.${file.status}` as const)
  return resolveLabel(key, STATUS_DEFAULTS[file.status])
}

const actionLabel = (kind: keyof typeof ACTION_DEFAULTS) =>
  resolveLabel(`el.upload.${kind}`, ACTION_DEFAULTS[kind])

const handlePreviewClick = (file: UploadFile) => {
  props.handlePreview?.(file)
}

const handleRemove = (file: UploadFile) => {
  emit('remove', file)
}
</script>
