<script setup lang="ts">
import { computed, inject, ref, type Component } from 'vue'
import { useFsusSize, type FsusSize, type FsusVariant } from '@fsusui/core'
import { FsusIcon, type FsusIconName } from '@fsusui/icons'
import { FSUS_BUTTON_GROUP_KEY } from './context'

defineOptions({ name: 'FsusButton' })

export interface FsusButtonProps {
  variant?: FsusVariant
  size?: FsusSize
  nativeType?: 'button' | 'submit' | 'reset'
  disabled?: boolean
  loading?: boolean
  block?: boolean
  pill?: boolean
  circle?: boolean
  icon?: FsusIconName | Component
  iconPosition?: 'start' | 'end'
  tag?: string | Component
  autofocus?: boolean
  ariaLabel?: string
}

const {
  variant,
  size,
  nativeType = 'button',
  disabled = false,
  loading = false,
  block = false,
  pill = false,
  circle = false,
  icon,
  iconPosition = 'start',
  tag = 'button',
  autofocus = false,
  ariaLabel,
} = defineProps<FsusButtonProps>()

const emit = defineEmits<{ click: [event: MouseEvent] }>()

const group = inject(FSUS_BUTTON_GROUP_KEY, undefined)
const resolvedSize = useFsusSize(
  computed(() => size),
  computed(() => group?.value.size),
)
const resolvedVariant = computed<FsusVariant>(() => variant ?? group?.value.variant ?? 'default')
const isDisabled = computed(() => disabled || loading || Boolean(group?.value.disabled))

const buttonEl = ref<HTMLElement | null>(null)

const handleClick = (event: MouseEvent) => {
  if (isDisabled.value) {
    event.preventDefault()
    return
  }
  emit('click', event)
}

defineExpose({
  ref: buttonEl,
  size: resolvedSize,
  variant: resolvedVariant,
  disabled: isDisabled,
})
</script>

<template>
  <component
    :is="tag"
    ref="buttonEl"
    class="fsus-button"
    :type="tag === 'button' ? nativeType : undefined"
    :disabled="tag === 'button' ? isDisabled : undefined"
    :autofocus="tag === 'button' ? autofocus : undefined"
    :aria-label="ariaLabel"
    :aria-disabled="isDisabled ? 'true' : undefined"
    :aria-busy="loading ? 'true' : undefined"
    :data-variant="resolvedVariant"
    :data-size="resolvedSize"
    :data-loading="loading ? '' : undefined"
    :data-disabled="isDisabled ? '' : undefined"
    :data-block="block ? '' : undefined"
    :data-pill="pill ? '' : undefined"
    :data-circle="circle ? '' : undefined"
    @click="handleClick"
  >
    <span v-if="loading" class="fsus-button__icon" aria-hidden="true">
      <slot name="loading">
        <FsusIcon name="loading" spin />
      </slot>
    </span>
    <span
      v-else-if="(icon || $slots.icon) && iconPosition === 'start'"
      class="fsus-button__icon"
      aria-hidden="true"
    >
      <slot name="icon">
        <FsusIcon v-if="typeof icon === 'string'" :name="icon" />
        <component :is="icon" v-else />
      </slot>
    </span>

    <span v-if="$slots.default" class="fsus-button__label">
      <slot />
    </span>

    <span
      v-if="!loading && (icon || $slots.icon) && iconPosition === 'end'"
      class="fsus-button__icon"
      aria-hidden="true"
    >
      <slot name="icon">
        <FsusIcon v-if="typeof icon === 'string'" :name="icon" />
        <component :is="icon" v-else />
      </slot>
    </span>
  </component>
</template>
