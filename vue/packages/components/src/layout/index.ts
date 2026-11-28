import { computed, defineComponent, h, type PropType } from 'vue'
import { addUnit } from '@fsusui/core'

export const FsusContainer = defineComponent({
  name: 'FsusContainer',
  props: {
    direction: { type: String as PropType<'horizontal' | 'vertical'>, default: 'horizontal' },
  },
  setup(props, { slots }) {
    return () =>
      h('section', { class: 'fsus-container', 'data-direction': props.direction }, slots.default?.())
  },
})

export const FsusHeader = defineComponent({
  name: 'FsusHeader',
  props: { height: { type: [String, Number], default: '60px' } },
  setup(props, { slots }) {
    return () =>
      h('header', { class: 'fsus-header', style: { height: addUnit(props.height) } }, slots.default?.())
  },
})

export const FsusAside = defineComponent({
  name: 'FsusAside',
  props: { width: { type: [String, Number], default: '260px' } },
  setup(props, { slots }) {
    return () =>
      h('aside', { class: 'fsus-aside', style: { width: addUnit(props.width) } }, slots.default?.())
  },
})

export const FsusMain = defineComponent({
  name: 'FsusMain',
  setup(_, { slots }) {
    return () => h('main', { class: 'fsus-main' }, slots.default?.())
  },
})

export const FsusFooter = defineComponent({
  name: 'FsusFooter',
  props: { height: { type: [String, Number], default: '56px' } },
  setup(props, { slots }) {
    return () =>
      h('footer', { class: 'fsus-footer', style: { height: addUnit(props.height) } }, slots.default?.())
  },
})

/**
 * Modern CSS Grid Row & Col — replaces 32.1 KB of legacy Element Plus 24-col Sass loops
 * with zero-bloat CSS custom properties (< 1.5 KB CSS total).
 */
export const FsusRow = defineComponent({
  name: 'FsusRow',
  props: {
    gutter: { type: [Number, String], default: 0 },
    columns: { type: Number, default: 24 },
    justify: { type: String as PropType<'start' | 'center' | 'end' | 'between' | 'around'>, default: undefined },
    align: { type: String as PropType<'start' | 'center' | 'end' | 'stretch'>, default: undefined },
    tag: { type: String, default: 'div' },
  },
  setup(props, { slots }) {
    const style = computed(() => ({
      '--fsus-grid-cols': String(props.columns),
      '--fsus-grid-gap': addUnit(props.gutter) ?? '0px',
    }))
    return () =>
      h(
        props.tag,
        {
          class: 'fsus-row',
          'data-justify': props.justify,
          'data-align': props.align,
          style: style.value,
        },
        slots.default?.(),
      )
  },
})

export const FsusCol = defineComponent({
  name: 'FsusCol',
  props: {
    span: { type: Number, default: 24 },
    offset: { type: Number, default: 0 },
    sm: { type: Number, default: undefined },
    md: { type: Number, default: undefined },
    lg: { type: Number, default: undefined },
    xl: { type: Number, default: undefined },
    tag: { type: String, default: 'div' },
  },
  setup(props, { slots }) {
    const style = computed(() => {
      const s: Record<string, string> = {
        '--fsus-col-span': String(props.span),
      }
      if (props.offset > 0) s['--fsus-col-start'] = String(props.offset + 1)
      if (props.sm !== undefined) s['--fsus-col-sm'] = String(props.sm)
      if (props.md !== undefined) s['--fsus-col-md'] = String(props.md)
      if (props.lg !== undefined) s['--fsus-col-lg'] = String(props.lg)
      if (props.xl !== undefined) s['--fsus-col-xl'] = String(props.xl)
      return s
    })
    return () => h(props.tag, { class: 'fsus-col', style: style.value }, slots.default?.())
  },
})
