<template>
  <div :class="fieldKls">
    <label :for="controlId" :class="ns.e('label')">{{ label }}</label>
    <p v-if="hasDescription" :id="descriptionId" :class="ns.e('description')">
      <slot name="description">{{ description }}</slot>
    </p>
    <code :id="phraseId" :class="ns.e('phrase')">{{ phrase }}</code>
    <input
      :id="controlId"
      :class="ns.e('input')"
      :name="name"
      :value="modelValue"
      :placeholder="placeholder"
      :disabled="disabled"
      :required="required"
      :aria-describedby="describedby"
      :aria-invalid="isInvalid ? 'true' : undefined"
      autocomplete="off"
      spellcheck="false"
      @input="handleInput"
      @change="handleChange"
    />
  </div>
</template>

<script lang="ts" setup>
import { computed, useId, useSlots } from 'vue'
import { useNamespace } from '@element-plus/hooks'
import {
  typedConfirmFieldEmits,
  typedConfirmFieldProps,
} from './shared'

defineOptions({
  name: 'ElTypedConfirmField',
})

const props = defineProps(typedConfirmFieldProps)
const emit = defineEmits(typedConfirmFieldEmits)
const slots = useSlots()
const ns = useNamespace('typed-confirm-field')
const fallbackId = useId()

const controlId = computed(() => props.id || `${fallbackId}-input`)
const phraseId = computed(() => `${controlId.value}-phrase`)
const descriptionId = computed(() => `${controlId.value}-description`)
const hasDescription = computed(() =>
  Boolean(props.description || slots.description),
)
const isComplete = computed(
  () => props.phrase.length > 0 && props.modelValue === props.phrase,
)
const isInvalid = computed(
  () => props.modelValue.length > 0 && !isComplete.value,
)
const describedby = computed(() =>
  [phraseId.value, hasDescription.value ? descriptionId.value : '']
    .filter(Boolean)
    .join(' '),
)
const fieldKls = computed(() => [
  ns.b(),
  ns.is('complete', isComplete.value),
  ns.is('invalid', isInvalid.value),
])

const handleInput = (event: Event) => {
  emit('update:modelValue', (event.target as HTMLInputElement).value)
}

const handleChange = (event: Event) => {
  emit('change', (event.target as HTMLInputElement).value)
}
</script>
