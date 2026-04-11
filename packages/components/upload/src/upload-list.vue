<template>
  <transition-group tag="ul" :class="containerKls" :name="nsList.b()">
    <li
      v-for="file in files"
      :key="file.uid || file.name"
      :class="[nsUpload.be('list', 'item'), nsUpload.is(file.status)]"
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
            :style="listType === 'picture-card' ? '' : 'margin-top: 0.5rem'"
          />
        </div>

        <label :class="nsUpload.be('list', 'item-status-label')">
          <el-icon
            v-if="listType === 'text'"
            :class="[nsIcon.m('upload-success'), nsIcon.m('circle-check')]"
          >
            <circle-check />
          </el-icon>
          <el-icon
            v-else-if="['picture-card', 'picture'].includes(listType)"
            :class="[nsIcon.m('upload-success'), nsIcon.m('check')]"
          >
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
  Close,
  Delete,
  Document,
  ZoomIn,
} from '@element-plus/icons-vue'
import { useLocale, useNamespace } from '@element-plus/hooks'
import ElProgress from '@element-plus/components/progress'
import { useFormDisabled } from '@element-plus/components/form'

import { uploadListEmits, uploadListProps } from './upload-list'
import type { UploadFile } from './upload'

defineOptions({
  name: 'ElUploadList',
})

const props = defineProps(uploadListProps)
const emit = defineEmits(uploadListEmits)

const { t } = useLocale()
const nsUpload = useNamespace('upload')
const nsIcon = useNamespace('icon')
const nsList = useNamespace('list')
const disabled = useFormDisabled()

const containerKls = computed(() => [
  nsUpload.b('list'),
  nsUpload.bm('list', props.listType),
  nsUpload.is('disabled', props.disabled),
])

const handlePreviewClick = (file: UploadFile) => {
  props.handlePreview?.(file)
}

const handleRemove = (file: UploadFile) => {
  emit('remove', file)
}
</script>
