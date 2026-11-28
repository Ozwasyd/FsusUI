<script setup lang="ts">
import { computed, inject, ref } from 'vue'
import { useFsusLocale, useFsusSize, type FsusSize } from '@fsusui/core'
import { FsusIcon } from '@fsusui/icons'
import { FSUS_FORM_ITEM_KEY } from '../form/context'

defineOptions({ name: 'FsusInput' })

export interface FsusInputProps {
  type?: 'text' | 'password' | 'textarea' | 'email' | 'search' | 'url' | 'tel' | 'number'
  size?: FsusSize
  placeholder?: string
  disabled?: boolean
  readonly?: boolean
  clearable?: boolean
  showPassword?: boolean
  showWordLimit?: boolean
  maxlength?: number
  rows?: number
  autocomplete?: string
  name?: string
  autofocus?: boolean
  invalid?: boolean
}

const {
  type = 'text',
  size,
  placeholder,
  disabled = false,
  readonly = false,
  clearable = false,
  showPassword = false,
  showWordLimit = false,
  maxlength,
  rows = 3,
  autocomplete = 'off',
  name,
  autofocus = false,
  invalid = false,
} = defineProps<FsusInputProps>()

const model = defineModel<string | number>({ default: '' })
const emit = defineEmits<{
  input: [value: string]
  change: [value: string]
  focus: [event: FocusEvent]
  blur: [event: FocusEvent]
  clear: []
}>()

const formItem = inject(FSUS_FORM_ITEM_KEY, undefined)
const { t } = useFsusLocale()
const resolvedSize = useFsusSize(
  computed(() => size),
  computed(() => formItem?.value.size),
)
const isDisabled = computed(() => disabled || Boolean(formItem?.value.disabled))
const isInvalid = computed(() => invalid || Boolean(formItem?.value.invalid))

const inputRef = ref<HTMLInputElement | HTMLTextAreaElement | null>(null)
const focused = ref(false)
const passwordVisible = ref(false)

const nativeValue = computed(() => (model.value === undefined || model.value === null ? '' : String(model.value)))
const nativeType = computed(() =>
  type === 'password' && showPassword ? (passwordVisible.value ? 'text' : 'password') : type,
)
const canClear = computed(
  () => clearable && !isDisabled.value && !readonly && nativeValue.value.length > 0,
)

const onInput = (event: Event) => {
  const val = (event.target as HTMLInputElement | HTMLTextAreaElement).value
  model.value = val
  emit('input', val)
  formItem?.value.notifyTrigger('change')
}

const onChange = (event: Event) => {
  const val = (event.target as HTMLInputElement | HTMLTextAreaElement).value
  emit('change', val)
}

const onFocus = (event: FocusEvent) => {
  focused.value = true
  emit('focus', event)
}

const onBlur = (event: FocusEvent) => {
  focused.value = false
  emit('blur', event)
  formItem?.value.notifyTrigger('blur')
}

const clear = () => {
  model.value = ''
  emit('input', '')
  emit('change', '')
  emit('clear')
  formItem?.value.notifyTrigger('change')
  inputRef.value?.focus()
}

defineExpose({
  ref: inputRef,
  focus: () => inputRef.value?.focus(),
  blur: () => inputRef.value?.blur(),
  select: () => inputRef.value?.select(),
  clear,
})
</script>

<template>
  <div
    class="fsus-input"
    :data-type="type === 'textarea' ? 'textarea' : 'input'"
    :data-size="resolvedSize"
    :data-focused="focused ? '' : undefined"
    :data-disabled="isDisabled ? '' : undefined"
    :data-invalid="isInvalid ? '' : undefined"
  >
    <span v-if="$slots.prepend && type !== 'textarea'" class="fsus-input__prepend">
      <slot name="prepend" />
    </span>

    <div class="fsus-input__wrapper">
      <span v-if="$slots.prefix && type !== 'textarea'" class="fsus-input__prefix">
        <slot name="prefix" />
      </span>

      <textarea
        v-if="type === 'textarea'"
        :id="formItem?.id"
        ref="inputRef"
        class="fsus-input__native"
        :value="nativeValue"
        :placeholder="placeholder ?? t('common.inputPlaceholder')"
        :disabled="isDisabled"
        :readonly="readonly"
        :maxlength="maxlength"
        :rows="rows"
        :name="name"
        :autofocus="autofocus"
        :aria-invalid="isInvalid ? 'true' : undefined"
        @input="onInput"
        @change="onChange"
        @focus="onFocus"
        @blur="onBlur"
      />
      <input
        v-else
        :id="formItem?.id"
        ref="inputRef"
        class="fsus-input__native"
        :type="nativeType"
        :value="nativeValue"
        :placeholder="placeholder ?? t('common.inputPlaceholder')"
        :disabled="isDisabled"
        :readonly="readonly"
        :maxlength="maxlength"
        :autocomplete="autocomplete"
        :name="name"
        :autofocus="autofocus"
        :aria-invalid="isInvalid ? 'true' : undefined"
        @input="onInput"
        @change="onChange"
        @focus="onFocus"
        @blur="onBlur"
      />

      <span
        v-if="canClear || (showPassword && type === 'password') || (showWordLimit && maxlength) || $slots.suffix"
        class="fsus-input__suffix"
      >
        <button
          v-if="canClear"
          type="button"
          class="fsus-input__action"
          :aria-label="t('common.clear')"
          @click="clear"
        >
          <FsusIcon name="circle-close" :size="14" />
        </button>
        <button
          v-if="showPassword && type === 'password'"
          type="button"
          class="fsus-input__action"
          :aria-label="passwordVisible ? 'Hide password' : 'Show password'"
          @click="passwordVisible = !passwordVisible"
        >
          <FsusIcon :name="passwordVisible ? 'view' : 'hide'" :size="14" />
        </button>
        <span v-if="showWordLimit && maxlength" class="fsus-input__count">
          {{ nativeValue.length }}/{{ maxlength }}
        </span>
        <slot name="suffix" />
      </span>
    </div>

    <span v-if="$slots.append && type !== 'textarea'" class="fsus-input__append">
      <slot name="append" />
    </span>
  </div>
</template>
