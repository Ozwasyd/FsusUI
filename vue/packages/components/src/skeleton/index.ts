import { defineComponent, h, type PropType } from 'vue'
import { addUnit } from '@fsusui/core'

export const FsusSkeletonItem = defineComponent({
  name: 'FsusSkeletonItem',
  props: {
    variant: {
      type: String as PropType<'text' | 'heading' | 'circle' | 'rect' | 'button'>,
      default: 'text',
    },
    width: { type: [String, Number], default: undefined },
    height: { type: [String, Number], default: undefined },
  },
  setup(props) {
    return () =>
      h('span', {
        class: 'fsus-skeleton__item',
        'data-variant': props.variant,
        style: { width: addUnit(props.width), height: addUnit(props.height) },
      })
  },
})

export const FsusSkeleton = defineComponent({
  name: 'FsusSkeleton',
  props: {
    loading: { type: Boolean, default: true },
    animated: { type: Boolean, default: true },
    rows: { type: Number, default: 3 },
  },
  setup(props, { slots }) {
    return () => {
      if (!props.loading) return slots.default?.()
      return h(
        'div',
        {
          class: 'fsus-skeleton',
          'aria-busy': 'true',
          'data-animated': props.animated ? '' : undefined,
        },
        slots.template
          ? slots.template()
          : Array.from({ length: props.rows }, (_, i) =>
              h(FsusSkeletonItem, {
                key: i,
                variant: i === 0 ? 'heading' : 'text',
                width: i === props.rows - 1 ? '65%' : undefined,
              }),
            ),
      )
    }
  },
})
