<script setup lang="ts">
import { computed, inject } from 'vue'
import { useFsusSize, type FsusSize } from '@fsusui/core'
import { FsusIcon } from '@fsusui/icons'
import { FSUS_FORM_ITEM_KEY } from '../form/context'

defineOptions({ name: 'FsusSwitch' })

export interface FsusSwitchProps {
  disabled?: boolean
  loading?: boolean
  size?: FsusSize
  activeText?: string
  inactiveText?: string
  beforeChange?: () => boolean | Promise<boolean>
}

const {
  disabled = false,
  loading = false,
  size,
  activeText,
  inactiveText,
  beforeChange,
} = defineProps<FsusSwitchProps>()

const model = defineModel<boolean>({ default: false })
const emit = defineEmits<{ change: [value: boolean] }>()

const formItem = inject(FSUS_FORM_ITEM_KEY, undefined)
const resolvedSize = useFsusSize(
  computed(() => size),
  computed(() => formItem?.value.size),
)
const isDisabled = computed(() => disabled || loading || Boolean(formItem?.value.disabled))

const toggle = async () => {
  if (isDisabled.value) return
  if (beforeChange) {
    const allowed = await beforeChange()
    if (!allowed) return
  }
  model.value = !model.value
  emit('change', model.value)
  formItem?.value.notifyTrigger('change')
}
</script>

<template>
  <button
    :id="formItem?.id"
    type="button"
    role="switch"
    class="fsus-switch"
    :aria-checked="model ? 'true' : 'false'"
    :disabled="isDisabled"
    :data-checked="model ? '' : undefined"
    :data-disabled="isDisabled ? '' : undefined"
    :data-size="resolvedSize"
    @click="toggle"
  >
    <span v-if="inactiveText && !model" class="fsus-switch__text">{{ inactiveText }}</span>
    <span class="fsus-switch__track">
      <span class="fsus-switch__thumb">
        <FsusIcon v-if="loading" name="loading" spin :size="12" />
      </span>
    </span>
    <span v-if="activeText && model" class="fsus-switch__text">{{ activeText }}</span>
  </button>
</template>
