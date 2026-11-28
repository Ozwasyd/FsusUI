import { defineComponent, h, Transition, type PropType } from 'vue'
import { cancelMotion, runMotion } from './runtime'
import { runMotionRecipe } from './recipes'
import type { MotionPresetName, MotionRecipeName } from './types'

export const FsusTransition = defineComponent({
  name: 'FsusTransition',
  props: {
    preset: { type: String as PropType<MotionPresetName>, default: 'surface-settle' },
    disabled: { type: Boolean, default: false },
    appear: { type: Boolean, default: false },
    mode: { type: String as PropType<'in-out' | 'out-in' | 'default'>, default: undefined },
  },
  setup(props, { slots }) {
    return () =>
      h(
        Transition,
        {
          css: false,
          appear: props.appear,
          mode: props.mode,
          onEnter: (el, done) => {
            runMotion(el as HTMLElement, {
              name: props.preset,
              phase: 'enter',
              disabled: props.disabled,
              onFinish: done,
            })
          },
          onLeave: (el, done) => {
            runMotion(el as HTMLElement, {
              name: props.preset,
              phase: 'leave',
              disabled: props.disabled,
              onFinish: done,
            })
          },
          onEnterCancelled: (el) => cancelMotion(el as HTMLElement),
          onLeaveCancelled: (el) => cancelMotion(el as HTMLElement),
        },
        slots,
      )
  },
})

export const FsusOverlayTransition = defineComponent({
  name: 'FsusOverlayTransition',
  props: {
    disabled: { type: Boolean, default: false },
    appear: { type: Boolean, default: false },
  },
  setup(props, { slots }) {
    return () =>
      h(FsusTransition, { preset: 'dialog-settle', disabled: props.disabled, appear: props.appear }, slots)
  },
})

export const FsusSheetTransition = defineComponent({
  name: 'FsusSheetTransition',
  props: {
    disabled: { type: Boolean, default: false },
    appear: { type: Boolean, default: false },
  },
  setup(props, { slots }) {
    return () =>
      h(FsusTransition, { preset: 'sheet-settle', disabled: props.disabled, appear: props.appear }, slots)
  },
})

export const FsusMotionRecipe = defineComponent({
  name: 'FsusMotionRecipe',
  props: {
    recipe: { type: String as PropType<MotionRecipeName>, default: 'content-enter' },
    tag: { type: String, default: 'div' },
    disabled: { type: Boolean, default: false },
  },
  setup(props, { slots }) {
    return () =>
      h(
        props.tag,
        {
          class: 'fsus-motion-recipe',
          'data-fsus-motion-recipe': props.recipe,
          ref: (el: unknown) => {
            if (el instanceof HTMLElement && !props.disabled) {
              runMotionRecipe(el, props.recipe)
            }
          },
        },
        slots.default?.(),
      )
  },
})

export const FsusMotion = FsusMotionRecipe

export const FsusSharedElement = defineComponent({
  name: 'FsusSharedElement',
  props: {
    name: { type: String, required: true },
    tag: { type: String, default: 'div' },
  },
  setup(props, { slots }) {
    return () =>
      h(
        props.tag,
        {
          class: 'fsus-shared-element',
          style: { viewTransitionName: props.name },
        },
        slots.default?.(),
      )
  },
})

export const FsusTaskReceipt = defineComponent({
  name: 'FsusTaskReceipt',
  props: {
    phase: { type: String as PropType<'idle' | 'pending' | 'settled' | 'error'>, default: 'idle' },
  },
  setup(props, { slots }) {
    return () =>
      h(
        'div',
        {
          class: 'fsus-task-receipt',
          'data-phase': props.phase,
          role: 'status',
          'aria-live': 'polite',
        },
        slots.default?.(),
      )
  },
})

export const FsusToastReceipt = defineComponent({
  name: 'FsusToastReceipt',
  props: {
    tone: { type: String as PropType<'neutral' | 'info' | 'success' | 'warning' | 'danger'>, default: 'neutral' },
  },
  setup(props, { slots }) {
    return () =>
      h(
        'div',
        {
          class: 'fsus-toast-receipt',
          'data-tone': props.tone,
          role: 'status',
          'aria-live': 'polite',
        },
        slots.default?.(),
      )
  },
})

export interface FsusBottomTabItem {
  key: string
  label: string
  disabled?: boolean
}

export const FsusBottomActionBar = defineComponent({
  name: 'FsusBottomActionBar',
  setup(_, { slots }) {
    return () => h('div', { class: 'fsus-bottom-action-bar' }, slots.default?.())
  },
})

export const FsusBottomTabBar = defineComponent({
  name: 'FsusBottomTabBar',
  props: {
    items: { type: Array as PropType<FsusBottomTabItem[]>, default: () => [] },
    modelValue: { type: String, default: '' },
  },
  emits: ['update:modelValue'],
  setup(props, { emit, slots }) {
    return () =>
      h(
        'nav',
        { class: 'fsus-bottom-tab-bar', role: 'tablist' },
        slots.default
          ? slots.default()
          : props.items.map((item) =>
              h(
                'button',
                {
                  key: item.key,
                  type: 'button',
                  role: 'tab',
                  class: 'fsus-bottom-tab-bar__item',
                  'aria-selected': props.modelValue === item.key ? 'true' : 'false',
                  'data-active': props.modelValue === item.key ? '' : undefined,
                  disabled: item.disabled,
                  onClick: () => emit('update:modelValue', item.key),
                },
                item.label,
              ),
            ),
      )
  },
})

export const FsusMobileDock = defineComponent({
  name: 'FsusMobileDock',
  setup(_, { slots }) {
    return () => h('div', { class: 'fsus-mobile-dock' }, slots.default?.())
  },
})
