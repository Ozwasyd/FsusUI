import { defineComponent } from 'vue'
import { fixtureTsxWidgetProps } from './fixture-tsx-widget-props'

const FsusFixtureTsxWidget = defineComponent({
  name: 'FsusFixtureTsxWidget',
  props: fixtureTsxWidgetProps,
  emits: ['submit'],
  setup(_props, { expose, slots }) {
    const focus = () => undefined

    expose({ focus })

    return () => <section>{slots.default?.({ count: 1 })}</section>
  },
})

export default FsusFixtureTsxWidget
