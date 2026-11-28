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
import { useFsusId, useFsusSize, type FsusSize } from '@fsusui/core'
import { FSUS_FORM_ITEM_KEY } from '../form/context'

export type FsusRadioValue = string | number | boolean

interface RadioGroupContext {
  name: string
  modelValue: FsusRadioValue | undefined
  disabled: boolean
  size: FsusSize
  select: (val: FsusRadioValue) => void
}

const RADIO_GROUP_KEY: InjectionKey<ComputedRef<RadioGroupContext>> = Symbol('fsus-radio-group')

export const FsusRadioGroup = defineComponent({
  name: 'FsusRadioGroup',
  props: {
    modelValue: { type: [String, Number, Boolean] as PropType<FsusRadioValue>, default: undefined },
    disabled: { type: Boolean, default: false },
    size: { type: String as PropType<FsusSize>, default: undefined },
    name: { type: String, default: undefined },
  },
  emits: ['update:modelValue', 'change'],
  setup(props, { emit, slots }) {
    const formItem = inject(FSUS_FORM_ITEM_KEY, undefined)
    const resolvedSize = useFsusSize(
      computed(() => props.size),
      computed(() => formItem?.value.size),
    )
    const fallbackName = useFsusId('radio')

    const select = (val: FsusRadioValue) => {
      emit('update:modelValue', val)
      emit('change', val)
      formItem?.value.notifyTrigger('change')
    }

    provide(
      RADIO_GROUP_KEY,
      computed(() => ({
        name: props.name ?? fallbackName,
        modelValue: props.modelValue,
        disabled: props.disabled || Boolean(formItem?.value.disabled),
        size: resolvedSize.value,
        select,
      })),
    )

    return () =>
      h('div', { class: 'fsus-radio-group', role: 'radiogroup', 'data-size': resolvedSize.value }, slots.default?.())
  },
})

export const FsusRadio = defineComponent({
  name: 'FsusRadio',
  props: {
    modelValue: { type: [String, Number, Boolean] as PropType<FsusRadioValue>, default: undefined },
    value: { type: [String, Number, Boolean] as PropType<FsusRadioValue>, required: true },
    label: { type: String, default: undefined },
    disabled: { type: Boolean, default: false },
    size: { type: String as PropType<FsusSize>, default: undefined },
  },
  emits: ['update:modelValue', 'change'],
  setup(props, { emit, slots }) {
    const group = inject(RADIO_GROUP_KEY, undefined)
    const formItem = inject(FSUS_FORM_ITEM_KEY, undefined)
    const resolvedSize = useFsusSize(
      computed(() => props.size),
      computed(() => group?.value.size ?? formItem?.value.size),
    )
    const isChecked = computed(() =>
      group ? group.value.modelValue === props.value : props.modelValue === props.value,
    )
    const isDisabled = computed(
      () => props.disabled || Boolean(group?.value.disabled) || Boolean(formItem?.value.disabled),
    )

    const onChange = () => {
      if (isDisabled.value) return
      if (group) {
        group.value.select(props.value)
        return
      }
      emit('update:modelValue', props.value)
      emit('change', props.value)
      formItem?.value.notifyTrigger('change')
    }

    return () =>
      h(
        'label',
        {
          class: 'fsus-radio',
          'data-checked': isChecked.value ? '' : undefined,
          'data-disabled': isDisabled.value ? '' : undefined,
          'data-size': resolvedSize.value,
        },
        [
          h('input', {
            type: 'radio',
            class: 'fsus-radio__native',
            name: group?.value.name,
            checked: isChecked.value,
            disabled: isDisabled.value,
            onChange,
          }),
          h('span', { class: 'fsus-radio__dot', 'aria-hidden': 'true' }),
          h('span', { class: 'fsus-radio__label' }, slots.default ? slots.default() : (props.label ?? String(props.value))),
        ],
      )
  },
})

export const FsusRadioButton = defineComponent({
  name: 'FsusRadioButton',
  props: {
    value: { type: [String, Number, Boolean] as PropType<FsusRadioValue>, required: true },
    label: { type: String, default: undefined },
    disabled: { type: Boolean, default: false },
  },
  setup(props, { slots }) {
    const group = inject(RADIO_GROUP_KEY, undefined)
    const isChecked = computed(() => group?.value.modelValue === props.value)
    const isDisabled = computed(() => props.disabled || Boolean(group?.value.disabled))
    return () =>
      h(
        'button',
        {
          type: 'button',
          role: 'radio',
          class: 'fsus-radio-button',
          'aria-checked': isChecked.value ? 'true' : 'false',
          'data-checked': isChecked.value ? '' : undefined,
          disabled: isDisabled.value,
          onClick: () => !isDisabled.value && group?.value.select(props.value),
        },
        slots.default ? slots.default() : (props.label ?? String(props.value)),
      )
  },
})
