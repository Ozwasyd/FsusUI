import {
  computed,
  defineComponent,
  h,
  inject,
  onBeforeUnmount,
  onMounted,
  provide,
  ref,
  type ComputedRef,
  type InjectionKey,
  type PropType,
} from 'vue'
import { addUnit, FSUS_KEY } from '@fsusui/core'
import { FsusIcon } from '@fsusui/icons'

interface CarouselCtx {
  activeIndex: number
  count: number
  type: 'default' | 'card'
  direction: 'horizontal' | 'vertical'
  loop: boolean
  setActive: (idx: number) => void
  register: () => number
}
const CAROUSEL_KEY: InjectionKey<ComputedRef<CarouselCtx>> = Symbol('fsus-carousel')

export const FsusCarouselItem = defineComponent({
  name: 'FsusCarouselItem',
  setup(_, { slots }) {
    const ctx = inject(CAROUSEL_KEY, undefined)
    const index = ctx ? ctx.value.register() : 0

    const stage = computed<'active' | 'prev' | 'next' | 'hidden'>(() => {
      const c = ctx?.value
      if (!c) return 'active'
      if (c.activeIndex === index) return 'active'
      if (c.type !== 'card' || c.count <= 1) return 'hidden'
      const prevIdx = c.loop ? (c.activeIndex - 1 + c.count) % c.count : c.activeIndex - 1
      const nextIdx = c.loop ? (c.activeIndex + 1) % c.count : c.activeIndex + 1
      if (index === nextIdx) return 'next'
      if (index === prevIdx) return 'prev'
      return 'hidden'
    })

    return () =>
      h(
        'div',
        {
          class: 'fsus-carousel__item',
          'data-active': stage.value === 'active' ? '' : undefined,
          'data-stage': stage.value,
          'aria-hidden': stage.value === 'hidden' ? 'true' : undefined,
          onClick: () => {
            if (ctx?.value.type === 'card' && (stage.value === 'prev' || stage.value === 'next')) {
              ctx.value.setActive(index)
            }
          },
        },
        slots.default?.(),
      )
  },
})

export const FsusCarousel = defineComponent({
  name: 'FsusCarousel',
  props: {
    height: { type: [String, Number], default: '240px' },
    initialIndex: { type: Number, default: 0 },
    type: { type: String as PropType<'default' | 'card'>, default: 'default' },
    direction: { type: String as PropType<'horizontal' | 'vertical'>, default: 'horizontal' },
    autoplay: { type: Boolean, default: false },
    interval: { type: Number, default: 4000 },
    pauseOnHover: { type: Boolean, default: true },
    loop: { type: Boolean, default: true },
  },
  emits: ['change'],
  setup(props, { emit, slots, expose }) {
    const activeIndex = ref(props.initialIndex)
    const count = ref(0)
    const hovered = ref(false)
    let timer: ReturnType<typeof setInterval> | undefined

    const setActive = (idx: number) => {
      if (count.value === 0) return
      const next = props.loop
        ? (idx + count.value) % count.value
        : Math.max(0, Math.min(count.value - 1, idx))
      if (next === activeIndex.value) return
      activeIndex.value = next
      emit('change', next)
    }

    const next = () => setActive(activeIndex.value + 1)
    const prev = () => setActive(activeIndex.value - 1)

    const startTimer = () => {
      if (!props.autoplay) return
      stopTimer()
      timer = setInterval(() => {
        if (!props.pauseOnHover || !hovered.value) next()
      }, props.interval)
    }

    const stopTimer = () => {
      if (timer) {
        clearInterval(timer)
        timer = undefined
      }
    }

    onMounted(startTimer)
    onBeforeUnmount(stopTimer)

    const onKeydown = (e: KeyboardEvent) => {
      if (props.direction === 'vertical') {
        if (e.key === FSUS_KEY.ARROW_UP) {
          e.preventDefault()
          prev()
        } else if (e.key === FSUS_KEY.ARROW_DOWN) {
          e.preventDefault()
          next()
        }
      } else {
        if (e.key === FSUS_KEY.ARROW_LEFT) {
          e.preventDefault()
          prev()
        } else if (e.key === FSUS_KEY.ARROW_RIGHT) {
          e.preventDefault()
          next()
        }
      }
    }

    provide(
      CAROUSEL_KEY,
      computed(() => ({
        activeIndex: activeIndex.value,
        count: count.value,
        type: props.type,
        direction: props.direction,
        loop: props.loop,
        setActive,
        register: () => count.value++,
      })),
    )

    expose({ next, prev, setActive })

    return () =>
      h(
        'div',
        {
          class: 'fsus-carousel',
          tabindex: 0,
          'data-type': props.type,
          'data-direction': props.direction,
          style: { height: addUnit(props.height) },
          onMouseenter: () => (hovered.value = true),
          onMouseleave: () => (hovered.value = false),
          onKeydown,
        },
        [
          h('div', { class: 'fsus-carousel__stage' }, slots.default?.()),
          h(
            'button',
            {
              type: 'button',
              class: 'fsus-carousel__arrow',
              'data-dir': 'prev',
              'aria-label': 'Previous',
              onClick: prev,
            },
            [h(FsusIcon, { name: props.direction === 'vertical' ? 'arrow-up' : 'arrow-left', size: 16 })],
          ),
          h(
            'button',
            {
              type: 'button',
              class: 'fsus-carousel__arrow',
              'data-dir': 'next',
              'aria-label': 'Next',
              onClick: next,
            },
            [h(FsusIcon, { name: props.direction === 'vertical' ? 'arrow-down' : 'arrow-right', size: 16 })],
          ),
          h(
            'div',
            { class: 'fsus-carousel__dots' },
            Array.from({ length: count.value }, (_, i) =>
              h('button', {
                key: i,
                type: 'button',
                class: 'fsus-carousel__dot',
                'data-active': i === activeIndex.value ? '' : undefined,
                'aria-label': `Slide ${i + 1}`,
                onClick: () => setActive(i),
              }),
            ),
          ),
        ],
      )
  },
})

interface CollapseCtx {
  activeNames: Array<string | number>
  toggle: (name: string | number) => void
}
const COLLAPSE_KEY: InjectionKey<ComputedRef<CollapseCtx>> = Symbol('fsus-collapse')

export const FsusCollapse = defineComponent({
  name: 'FsusCollapse',
  props: {
    modelValue: {
      type: [String, Number, Array] as PropType<string | number | Array<string | number>>,
      default: () => [],
    },
    accordion: { type: Boolean, default: false },
  },
  emits: ['update:modelValue', 'change'],
  setup(props, { emit, slots }) {
    const activeNames = computed<Array<string | number>>(() =>
      Array.isArray(props.modelValue)
        ? props.modelValue
        : props.modelValue !== '' && props.modelValue !== undefined
          ? [props.modelValue]
          : [],
    )

    const toggle = (name: string | number) => {
      const isOpen = activeNames.value.includes(name)
      const next = props.accordion
        ? isOpen
          ? ''
          : name
        : isOpen
          ? activeNames.value.filter((n) => n !== name)
          : [...activeNames.value, name]
      emit('update:modelValue', next)
      emit('change', next)
    }

    provide(
      COLLAPSE_KEY,
      computed(() => ({ activeNames: activeNames.value, toggle })),
    )

    return () => h('div', { class: 'fsus-collapse' }, slots.default?.())
  },
})

export const FsusCollapseItem = defineComponent({
  name: 'FsusCollapseItem',
  props: {
    name: { type: [String, Number] as PropType<string | number>, required: true },
    title: { type: String, default: '' },
    disabled: { type: Boolean, default: false },
  },
  setup(props, { slots }) {
    const ctx = inject(COLLAPSE_KEY, undefined)
    const isOpen = computed(() => Boolean(ctx?.value.activeNames.includes(props.name)))
    return () =>
      h('div', { class: 'fsus-collapse__item', 'data-open': isOpen.value ? '' : undefined }, [
        h(
          'button',
          {
            type: 'button',
            class: 'fsus-collapse__header',
            'aria-expanded': isOpen.value ? 'true' : 'false',
            disabled: props.disabled,
            onClick: () => !props.disabled && ctx?.value.toggle(props.name),
          },
          [
            h('span', { class: 'fsus-collapse__title' }, slots.title ? slots.title() : props.title),
            h(FsusIcon, { name: isOpen.value ? 'arrow-down' : 'arrow-right', size: 14 }),
          ],
        ),
        isOpen.value ? h('div', { class: 'fsus-collapse__body' }, slots.default?.()) : null,
      ])
  },
})
