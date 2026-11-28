import {
  computed,
  defineComponent,
  h,
  onBeforeUnmount,
  onMounted,
  ref,
  type PropType,
} from 'vue'
import { addUnit, toDate } from '@fsusui/core'

export const FsusStatistic = defineComponent({
  name: 'FsusStatistic',
  props: {
    title: { type: String, default: '' },
    value: { type: [Number, String], default: 0 },
    precision: { type: Number, default: undefined },
    prefix: { type: String, default: '' },
    suffix: { type: String, default: '' },
  },
  setup(props, { slots }) {
    const formatted = computed(() => {
      if (typeof props.value === 'number') {
        return props.precision !== undefined
          ? props.value.toFixed(props.precision)
          : props.value.toLocaleString()
      }
      return props.value
    })
    return () =>
      h('div', { class: 'fsus-statistic' }, [
        props.title || slots.title
          ? h('div', { class: 'fsus-statistic__title' }, slots.title ? slots.title() : props.title)
          : null,
        h('div', { class: 'fsus-statistic__value' }, [
          props.prefix ? h('span', { class: 'fsus-statistic__prefix' }, props.prefix) : null,
          h('span', formatted.value),
          props.suffix ? h('span', { class: 'fsus-statistic__suffix' }, props.suffix) : null,
        ]),
      ])
  },
})

export const FsusCountdown = defineComponent({
  name: 'FsusCountdown',
  props: {
    value: { type: [Number, Date, String] as PropType<number | Date | string>, required: true },
    title: { type: String, default: '' },
    format: { type: String, default: 'HH:mm:ss' },
  },
  emits: ['finish'],
  setup(props, { emit }) {
    const targetMs = computed(() => {
      if (typeof props.value === 'number') return props.value
      return toDate(props.value)?.getTime() ?? Date.now()
    })
    const remaining = ref(Math.max(0, targetMs.value - Date.now()))
    let timer: ReturnType<typeof setInterval> | undefined

    const tick = () => {
      const next = Math.max(0, targetMs.value - Date.now())
      remaining.value = next
      if (next === 0 && timer) {
        clearInterval(timer)
        timer = undefined
        emit('finish')
      }
    }

    onMounted(() => {
      tick()
      if (remaining.value > 0) timer = setInterval(tick, 1000)
    })
    onBeforeUnmount(() => {
      if (timer) clearInterval(timer)
    })

    const formatted = computed(() => {
      const totalSec = Math.floor(remaining.value / 1000)
      const d = Math.floor(totalSec / 86400)
      const hrs = Math.floor((totalSec % 86400) / 3600)
      const mins = Math.floor((totalSec % 3600) / 60)
      const secs = totalSec % 60
      return props.format
        .replace('DD', String(d).padStart(2, '0'))
        .replace('HH', String(hrs).padStart(2, '0'))
        .replace('mm', String(mins).padStart(2, '0'))
        .replace('ss', String(secs).padStart(2, '0'))
    })

    return () => h(FsusStatistic, { title: props.title, value: formatted.value })
  },
})

export const FsusDescriptions = defineComponent({
  name: 'FsusDescriptions',
  props: {
    title: { type: String, default: '' },
    column: { type: Number, default: 3 },
    border: { type: Boolean, default: false },
  },
  setup(props, { slots }) {
    return () =>
      h('section', { class: 'fsus-descriptions', 'data-border': props.border ? '' : undefined }, [
        props.title || slots.title
          ? h('header', { class: 'fsus-descriptions__header' }, [
              h('h4', { class: 'fsus-descriptions__title' }, slots.title ? slots.title() : props.title),
              slots.extra?.(),
            ])
          : null,
        h(
          'dl',
          {
            class: 'fsus-descriptions__grid',
            style: { gridTemplateColumns: `repeat(${props.column}, minmax(0, 1fr))` },
          },
          slots.default?.(),
        ),
      ])
  },
})

export const FsusDescriptionsItem = defineComponent({
  name: 'FsusDescriptionsItem',
  props: {
    label: { type: String, default: '' },
    span: { type: Number, default: 1 },
  },
  setup(props, { slots }) {
    return () =>
      h(
        'div',
        { class: 'fsus-descriptions__item', style: props.span > 1 ? { gridColumn: `span ${props.span}` } : undefined },
        [
          h('dt', { class: 'fsus-descriptions__label' }, slots.label ? slots.label() : props.label),
          h('dd', { class: 'fsus-descriptions__content' }, slots.default?.()),
        ],
      )
  },
})

export const FsusTimeline = defineComponent({
  name: 'FsusTimeline',
  setup(_, { slots }) {
    return () => h('ol', { class: 'fsus-timeline' }, slots.default?.())
  },
})

export const FsusTimelineItem = defineComponent({
  name: 'FsusTimelineItem',
  props: {
    timestamp: { type: String, default: '' },
    tone: { type: String as PropType<'neutral' | 'info' | 'success' | 'warning' | 'danger'>, default: 'neutral' },
  },
  setup(props, { slots }) {
    return () =>
      h('li', { class: 'fsus-timeline__item', 'data-tone': props.tone }, [
        h('span', { class: 'fsus-timeline__dot', 'aria-hidden': 'true' }),
        h('div', { class: 'fsus-timeline__body' }, [
          h('div', { class: 'fsus-timeline__content' }, slots.default?.()),
          props.timestamp ? h('time', { class: 'fsus-timeline__time' }, props.timestamp) : null,
        ]),
      ])
  },
})

export const FsusWatermark = defineComponent({
  name: 'FsusWatermark',
  props: {
    content: { type: [String, Array] as PropType<string | string[]>, default: '' },
    gap: { type: Array as unknown as PropType<[number, number]>, default: () => [120, 80] },
    rotate: { type: Number, default: -22 },
    opacity: { type: Number, default: 0.14 },
  },
  setup(props, { slots }) {
    const bgSvg = computed(() => {
      const lines = Array.isArray(props.content) ? props.content : [props.content]
      const [w, hPx] = [props.gap[0] + 120, props.gap[1] + 64]
      const tspans = lines
        .map((line, i) => `<tspan x="50%" dy="${i === 0 ? 0 : 18}">${line}</tspan>`)
        .join('')
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${hPx}"><text x="50%" y="50%" text-anchor="middle" fill="currentColor" fill-opacity="${props.opacity}" font-size="14" transform="rotate(${props.rotate} ${w / 2} ${hPx / 2})">${tspans}</text></svg>`
      return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
    })
    return () =>
      h('div', { class: 'fsus-watermark', style: { position: 'relative' } }, [
        slots.default?.(),
        h('div', {
          class: 'fsus-watermark__layer',
          'aria-hidden': 'true',
          style: {
            position: 'absolute',
            inset: '0',
            pointerEvents: 'none',
            backgroundImage: bgSvg.value,
            backgroundRepeat: 'repeat',
          },
        }),
      ])
  },
})

export const FsusAffix = defineComponent({
  name: 'FsusAffix',
  props: {
    offset: { type: Number, default: 0 },
    position: { type: String as PropType<'top' | 'bottom'>, default: 'top' },
    zIndex: { type: Number, default: 100 },
  },
  setup(props, { slots }) {
    return () =>
      h(
        'div',
        {
          class: 'fsus-affix',
          style: {
            position: 'sticky',
            [props.position]: addUnit(props.offset),
            zIndex: props.zIndex,
          },
        },
        slots.default?.(),
      )
  },
})

export const FsusBacktop = defineComponent({
  name: 'FsusBacktop',
  props: {
    visibilityHeight: { type: Number, default: 200 },
    right: { type: Number, default: 32 },
    bottom: { type: Number, default: 32 },
  },
  emits: ['click'],
  setup(props, { emit, slots }) {
    const visible = ref(false)
    const onScroll = () => {
      visible.value = window.scrollY >= props.visibilityHeight
    }
    onMounted(() => window.addEventListener('scroll', onScroll, { passive: true }))
    onBeforeUnmount(() => window.removeEventListener('scroll', onScroll))

    const scrollTop = (event: MouseEvent) => {
      window.scrollTo({ top: 0, behavior: 'smooth' })
      emit('click', event)
    }

    return () =>
      visible.value
        ? h(
            'button',
            {
              type: 'button',
              class: 'fsus-backtop',
              'aria-label': 'Back to top',
              style: { right: addUnit(props.right), bottom: addUnit(props.bottom) },
              onClick: scrollTop,
            },
            slots.default ? slots.default() : '↑',
          )
        : null
  },
})
