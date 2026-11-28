import {
  computed,
  defineComponent,
  h,
  inject,
  provide,
  type ComputedRef,
  type InjectionKey,
  type PropType,
} from 'vue'
import { useFsusSize, type FsusSize } from '@fsusui/core'
import { FsusIcon } from '@fsusui/icons'
import { FSUS_FORM_ITEM_KEY } from '../form/context'

export type FsusCheckboxValue = string | number | boolean

interface CheckboxGroupContext {
  modelValue: FsusCheckboxValue[]
  disabled: boolean
  size: FsusSize
  min?: number
  max?: number
  toggle: (val: FsusCheckboxValue) => void
}

const CHECKBOX_GROUP_KEY: InjectionKey<ComputedRef<CheckboxGroupContext>> =
  Symbol('fsus-checkbox-group')

export const FsusCheckboxGroup = defineComponent({
  name: 'FsusCheckboxGroup',
  props: {
    modelValue: { type: Array as PropType<FsusCheckboxValue[]>, default: () => [] },
    disabled: { type: Boolean, default: false },
    size: { type: String as PropType<FsusSize>, default: undefined },
    min: { type: Number, default: undefined },
    max: { type: Number, default: undefined },
  },
  emits: ['update:modelValue', 'change'],
  setup(props, { emit, slots }) {
    const formItem = inject(FSUS_FORM_ITEM_KEY, undefined)
    const resolvedSize = useFsusSize(
      computed(() => props.size),
      computed(() => formItem?.value.size),
    )
    const toggle = (val: FsusCheckboxValue) => {
      const current = [...props.modelValue]
      const idx = current.indexOf(val)
      if (idx >= 0) {
        if (props.min !== undefined && current.length <= props.min) return
        current.splice(idx, 1)
      } else {
        if (props.max !== undefined && current.length >= props.max) return
        current.push(val)
      }
      emit('update:modelValue', current)
      emit('change', current)
      formItem?.value.notifyTrigger('change')
    }

    provide(
      CHECKBOX_GROUP_KEY,
      computed(() => ({
        modelValue: props.modelValue,
        disabled: props.disabled || Boolean(formItem?.value.disabled),
        size: resolvedSize.value,
        min: props.min,
        max: props.max,
        toggle,
      })),
    )

    return () =>
      h('div', { class: 'fsus-checkbox-group', role: 'group', 'data-size': resolvedSize.value }, slots.default?.())
  },
})

export const FsusCheckbox = defineComponent({
  name: 'FsusCheckbox',
  props: {
    modelValue: { type: Boolean, default: false },
    value: { type: [String, Number, Boolean] as PropType<FsusCheckboxValue>, default: undefined },
    label: { type: String, default: undefined },
    disabled: { type: Boolean, default: false },
    indeterminate: { type: Boolean, default: false },
    size: { type: String as PropType<FsusSize>, default: undefined },
  },
  emits: ['update:modelValue', 'change'],
  setup(props, { emit, slots }) {
    const group = inject(CHECKBOX_GROUP_KEY, undefined)
    const formItem = inject(FSUS_FORM_ITEM_KEY, undefined)
    const resolvedSize = useFsusSize(
      computed(() => props.size),
      computed(() => group?.value.size ?? formItem?.value.size),
    )
    const isChecked = computed(() =>
      group && props.value !== undefined
        ? group.value.modelValue.includes(props.value)
        : props.modelValue,
    )
    const isDisabled = computed(
      () => props.disabled || Boolean(group?.value.disabled) || Boolean(formItem?.value.disabled),
    )

    const onChange = (event: Event) => {
      if (isDisabled.value) return
      if (group && props.value !== undefined) {
        group.value.toggle(props.value)
        return
      }
      const next = (event.target as HTMLInputElement).checked
      emit('update:modelValue', next)
      emit('change', next)
      formItem?.value.notifyTrigger('change')
    }

    return () =>
      h(
        'label',
        {
          class: 'fsus-checkbox',
          'data-checked': isChecked.value ? '' : undefined,
          'data-indeterminate': props.indeterminate ? '' : undefined,
          'data-disabled': isDisabled.value ? '' : undefined,
          'data-size': resolvedSize.value,
        },
        [
          h('input', {
            type: 'checkbox',
            class: 'fsus-checkbox__native',
            checked: isChecked.value,
            indeterminate: props.indeterminate,
            disabled: isDisabled.value,
            onChange,
          }),
          h('span', { class: 'fsus-checkbox__box', 'aria-hidden': 'true' }, [
            props.indeterminate
              ? h(FsusIcon, { name: 'minus', size: 12 })
              : isChecked.value
                ? h(FsusIcon, { name: 'check', size: 12 })
                : null,
          ]),
          slots.default || props.label
            ? h('span', { class: 'fsus-checkbox__label' }, slots.default ? slots.default() : props.label)
            : null,
        ],
      )
  },
})

export const FsusCheckboxButton = defineComponent({
  name: 'FsusCheckboxButton',
  props: {
    value: { type: [String, Number, Boolean] as PropType<FsusCheckboxValue>, required: true },
    label: { type: String, default: undefined },
    disabled: { type: Boolean, default: false },
  },
  setup(props, { slots }) {
    const group = inject(CHECKBOX_GROUP_KEY, undefined)
    const isChecked = computed(() => Boolean(group?.value.modelValue.includes(props.value)))
    const isDisabled = computed(() => props.disabled || Boolean(group?.value.disabled))
    return () =>
      h(
        'button',
        {
          type: 'button',
          class: 'fsus-checkbox-button',
          'aria-pressed': isChecked.value ? 'true' : 'false',
          'data-checked': isChecked.value ? '' : undefined,
          disabled: isDisabled.value,
          onClick: () => !isDisabled.value && group?.value.toggle(props.value),
        },
        slots.default ? slots.default() : (props.label ?? String(props.value)),
      )
  },
})
