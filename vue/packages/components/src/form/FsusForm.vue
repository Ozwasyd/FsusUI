<script setup lang="ts">
import { computed, provide } from 'vue'
import {
  createFsusError,
  fsusErr,
  fsusOk,
  useFsusSize,
  type FsusResult,
  type FsusSize,
  type FsusValidationRule,
} from '@fsusui/core'
import { FSUS_FORM_KEY, type FsusFormItemInstance } from './context'

defineOptions({ name: 'FsusForm' })

export interface FsusFormProps {
  model?: Record<string, any>
  rules?: Record<string, FsusValidationRule | FsusValidationRule[]>
  size?: FsusSize
  disabled?: boolean
  inline?: boolean
  labelPosition?: 'top' | 'left' | 'right'
  labelWidth?: string | number
}

const {
  model,
  rules,
  size,
  disabled = false,
  inline = false,
  labelPosition = 'top',
  labelWidth,
} = defineProps<FsusFormProps>()

const emit = defineEmits<{ submit: [event: SubmitEvent] }>()

const resolvedSize = useFsusSize(computed(() => size))
const fields = new Set<FsusFormItemInstance>()

const registerField = (field: FsusFormItemInstance) => fields.add(field)
const unregisterField = (field: FsusFormItemInstance) => fields.delete(field)

provide(
  FSUS_FORM_KEY,
  computed(() => ({
    model,
    rules,
    size: resolvedSize.value,
    disabled,
    labelPosition,
    labelWidth,
    registerField,
    unregisterField,
  })),
)

const validate = async (props?: string[]): Promise<FsusResult<true>> => {
  const targets = props
    ? Array.from(fields).filter((f) => f.prop && props.includes(f.prop))
    : Array.from(fields)
  const errors: string[] = []
  for (const field of targets) {
    const res = await field.validate('submit')
    if (!res.valid) errors.push(res.message)
  }
  if (errors.length > 0) {
    return fsusErr(createFsusError('validation', errors[0]!, { details: errors.join('; ') }))
  }
  return fsusOk(true)
}

const resetFields = (props?: string[]) => {
  for (const field of fields) {
    if (!props || (field.prop && props.includes(field.prop))) {
      field.resetField()
    }
  }
}

const clearValidate = (props?: string[]) => {
  for (const field of fields) {
    if (!props || (field.prop && props.includes(field.prop))) {
      field.clearValidate()
    }
  }
}

defineExpose({ validate, resetFields, clearValidate })
</script>

<template>
  <form
    class="fsus-form"
    :data-inline="inline ? '' : undefined"
    :data-label-position="labelPosition"
    :data-size="resolvedSize"
    @submit.prevent="emit('submit', $event as SubmitEvent)"
  >
    <slot />
  </form>
</template>
