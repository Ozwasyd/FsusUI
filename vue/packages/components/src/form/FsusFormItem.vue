<script setup lang="ts">
import { computed, inject, onBeforeUnmount, onMounted, provide, ref, useSlots } from 'vue'
import {
  addUnit,
  deepClone,
  ensureArray,
  getByPath,
  setByPath,
  useFsusId,
  useFsusSize,
  validateRules,
  type FsusFieldValidationResult,
  type FsusSize,
  type FsusValidationRule,
  type FsusValidationTrigger,
} from '@fsusui/core'
import { FSUS_FORM_ITEM_KEY, FSUS_FORM_KEY, type FsusFormItemInstance } from './context'

defineOptions({ name: 'FsusFormItem' })

export interface FsusFormItemProps {
  label?: string
  prop?: string
  help?: string
  error?: string
  required?: boolean
  rules?: FsusValidationRule | FsusValidationRule[]
  size?: FsusSize
  labelWidth?: string | number
}

const {
  label,
  prop,
  help,
  error: explicitError,
  required,
  rules,
  size,
  labelWidth,
} = defineProps<FsusFormItemProps>()

const form = inject(FSUS_FORM_KEY, undefined)
const slots = useSlots()
const fieldId = useFsusId('field')
const labelId = `${fieldId}-label`
const errorId = `${fieldId}-error`
const internalError = ref('')
let initialValue: unknown

const hasLabel = computed(() => Boolean(slots.label || label))

const onLabelClick = (event: MouseEvent) => {
  const labelEl = event.currentTarget as HTMLLabelElement | null
  if (!labelEl || labelEl.control || typeof document === 'undefined') return
  const target = document.getElementById(fieldId)
  if (target instanceof HTMLElement && typeof target.focus === 'function') {
    target.focus()
  }
}

const resolvedSize = useFsusSize(
  computed(() => size),
  computed(() => form?.value.size),
)

const mergedRules = computed<FsusValidationRule[]>(() => {
  const fromForm = prop && form?.value.rules?.[prop] ? ensureArray(form.value.rules[prop]) : []
  const fromSelf = rules ? ensureArray(rules) : []
  const combined = [...fromForm, ...fromSelf]
  if (required && !combined.some((r) => r.required)) {
    combined.unshift({ required: true })
  }
  return combined
})

const isRequired = computed(() => Boolean(required || mergedRules.value.some((r) => r.required)))
const errorMessage = computed(() => explicitError || internalError.value)
const isInvalid = computed(() => Boolean(errorMessage.value))

const validate = async (trigger?: FsusValidationTrigger): Promise<FsusFieldValidationResult> => {
  if (mergedRules.value.length === 0) {
    internalError.value = ''
    return { valid: true, message: '' }
  }
  const model = form?.value.model ?? {}
  const val = prop ? getByPath(model, prop) : undefined
  const res = await validateRules(mergedRules.value, val, model, label || prop || 'Field', trigger)
  internalError.value = res.valid ? '' : res.message
  return res
}

const clearValidate = () => {
  internalError.value = ''
}

const resetField = () => {
  if (prop && form?.value.model) {
    setByPath(form.value.model, prop, deepClone(initialValue))
  }
  clearValidate()
}

const instance: FsusFormItemInstance = {
  get prop() {
    return prop
  },
  validate,
  clearValidate,
  resetField,
}

onMounted(() => {
  if (prop && form?.value.model) {
    initialValue = deepClone(getByPath(form.value.model, prop))
  }
  form?.value.registerField(instance)
})

onBeforeUnmount(() => {
  form?.value.unregisterField(instance)
})

provide(
  FSUS_FORM_ITEM_KEY,
  computed(() => ({
    id: fieldId,
    labelId,
    errorId,
    hasLabel: hasLabel.value,
    invalid: isInvalid.value,
    disabled: Boolean(form?.value.disabled),
    size: resolvedSize.value,
    notifyTrigger: (t: FsusValidationTrigger) => {
      void validate(t)
    },
  })),
)

const labelStyleAttr = computed(() => {
  const w = labelWidth ?? form?.value.labelWidth
  return w !== undefined ? { style: { width: addUnit(w) } } : undefined
})

defineExpose({ validate, clearValidate, resetField })
</script>

<template>
  <div
    class="fsus-form-item"
    :data-invalid="isInvalid ? '' : undefined"
    :data-required="isRequired ? '' : undefined"
    :data-size="resolvedSize"
  >
    <label
      v-if="$slots.label || label"
      :id="labelId"
      :for="fieldId"
      class="fsus-form-item__label"
      v-bind="labelStyleAttr"
      @click="onLabelClick"
    >
      <slot name="label">{{ label }}</slot>
      <span v-if="isRequired" class="fsus-form-item__asterisk" aria-hidden="true">*</span>
    </label>
    <div class="fsus-form-item__content">
      <slot />
      <p v-if="errorMessage" :id="errorId" class="fsus-form-item__error" role="alert">
        {{ errorMessage }}
      </p>
      <p v-else-if="$slots.help || help" class="fsus-form-item__help">
        <slot name="help">{{ help }}</slot>
      </p>
    </div>
  </div>
</template>
