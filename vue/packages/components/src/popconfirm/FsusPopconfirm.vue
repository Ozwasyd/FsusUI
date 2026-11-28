<script setup lang="ts">
import { ref } from 'vue'
import { useFsusLocale, type FsusPlacement, type FsusVariant } from '@fsusui/core'
import { FsusIcon } from '@fsusui/icons'
import FsusPopover from '../popover/FsusPopover.vue'
import FsusButton from '../button/FsusButton.vue'

defineOptions({ name: 'FsusPopconfirm' })

export interface FsusPopconfirmProps {
  title: string
  description?: string
  confirmText?: string
  cancelText?: string
  confirmVariant?: FsusVariant
  placement?: FsusPlacement
  width?: number | string
  disabled?: boolean
}

const {
  title,
  description,
  confirmText,
  cancelText,
  confirmVariant = 'primary',
  placement = 'top',
  width = 240,
  disabled = false,
} = defineProps<FsusPopconfirmProps>()

const emit = defineEmits<{ confirm: []; cancel: [] }>()
const open = ref(false)
const { t } = useFsusLocale()

const handleCancel = () => {
  open.value = false
  emit('cancel')
}

const handleConfirm = () => {
  open.value = false
  emit('confirm')
}
</script>

<template>
  <FsusPopover v-model:open="open" :placement="placement" :width="width" :disabled="disabled">
    <template #reference>
      <slot name="reference" />
    </template>
    <div class="fsus-popconfirm">
      <div class="fsus-popconfirm__head">
        <FsusIcon name="warning-filled" class="fsus-popconfirm__icon" />
        <div class="fsus-popconfirm__text">
          <div class="fsus-popconfirm__title">{{ title }}</div>
          <p v-if="description" class="fsus-popconfirm__description">{{ description }}</p>
        </div>
      </div>
      <div class="fsus-popconfirm__actions">
        <FsusButton size="sm" variant="ghost" @click="handleCancel">
          {{ cancelText ?? t('common.cancel') }}
        </FsusButton>
        <FsusButton size="sm" :variant="confirmVariant" @click="handleConfirm">
          {{ confirmText ?? t('common.confirm') }}
        </FsusButton>
      </div>
    </div>
  </FsusPopover>
</template>
