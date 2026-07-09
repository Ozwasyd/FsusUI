import {
  computed,
  getCurrentInstance,
  onMounted,
  ref,
  shallowRef,
  watch,
} from 'vue'
import { addUnit, getClientXY } from '@element-plus/utils'
import { useNamespace } from '@element-plus/hooks'
import { draggable } from '../utils/draggable'

import type { AlphaSliderProps } from '../props/alpha-slider'

export const useAlphaSlider = (props: AlphaSliderProps) => {
  const instance = getCurrentInstance()!

  const thumb = shallowRef<HTMLElement>()
  const bar = shallowRef<HTMLElement>()
  let dragMetrics:
    | {
        rect: Pick<DOMRect, 'height' | 'left' | 'top' | 'width'>
        thumbHeight: number
        thumbWidth: number
      }
    | undefined

  function handleClick(event: MouseEvent | TouchEvent) {
    const target = event.target

    if (target !== thumb.value) {
      handleDrag(event)
    }
  }

  function measureDragMetrics() {
    if (!bar.value || !thumb.value) return
    const el = instance.vnode.el as HTMLElement
    const { height, left, top, width } = el.getBoundingClientRect()
    return {
      rect: { height, left, top, width },
      thumbHeight: thumb.value.offsetHeight,
      thumbWidth: thumb.value.offsetWidth,
    }
  }

  function handleDrag(event: MouseEvent | TouchEvent) {
    const metrics = dragMetrics || measureDragMetrics()
    if (!metrics) return

    const { rect, thumbHeight, thumbWidth } = metrics
    const { clientX, clientY } = getClientXY(event)

    if (!props.vertical) {
      let left = clientX - rect.left
      left = Math.max(thumbWidth / 2, left)
      left = Math.min(left, rect.width - thumbWidth / 2)

      props.color.set(
        'alpha',
        Math.round(((left - thumbWidth / 2) / (rect.width - thumbWidth)) * 100),
      )
    } else {
      let top = clientY - rect.top
      top = Math.max(thumbHeight / 2, top)
      top = Math.min(top, rect.height - thumbHeight / 2)

      props.color.set(
        'alpha',
        Math.round(
          ((top - thumbHeight / 2) / (rect.height - thumbHeight)) * 100,
        ),
      )
    }
  }

  return {
    thumb,
    bar,
    handleDrag,
    handleClick,
    measureDragMetrics,
    resetDragMetrics: () => {
      dragMetrics = undefined
    },
    setDragMetrics: () => {
      dragMetrics = measureDragMetrics()
    },
  }
}

export const useAlphaSliderDOM = (
  props: AlphaSliderProps,
  {
    bar,
    thumb,
    handleDrag,
    resetDragMetrics,
    setDragMetrics,
  }: Pick<
    ReturnType<typeof useAlphaSlider>,
    'bar' | 'thumb' | 'handleDrag' | 'resetDragMetrics' | 'setDragMetrics'
  >,
) => {
  const instance = getCurrentInstance()!

  const ns = useNamespace('color-alpha-slider')
  // refs

  const thumbLeft = ref(0)
  const thumbTop = ref(0)
  const background = ref<string>()

  function getThumbLeft() {
    if (!thumb.value) return 0

    if (props.vertical) return 0
    const el = instance.vnode.el
    const alpha = props.color.get('alpha')

    if (!el) return 0
    return Math.round(
      (alpha * (el.offsetWidth - thumb.value.offsetWidth / 2)) / 100,
    )
  }

  function getThumbTop() {
    if (!thumb.value) return 0

    const el = instance.vnode.el
    if (!props.vertical) return 0
    const alpha = props.color.get('alpha')

    if (!el) return 0
    return Math.round(
      (alpha * (el.offsetHeight - thumb.value.offsetHeight / 2)) / 100,
    )
  }

  function getBackground() {
    if (props.color && props.color.value) {
      const { r, g, b } = props.color.toRgb()
      return `linear-gradient(to right, rgba(${r}, ${g}, ${b}, 0) 0%, rgba(${r}, ${g}, ${b}, 1) 100%)`
    }
    return ''
  }

  function update() {
    thumbLeft.value = getThumbLeft()
    thumbTop.value = getThumbTop()
    background.value = getBackground()
  }

  onMounted(() => {
    if (!bar.value || !thumb.value) return

    const dragConfig = {
      start: () => {
        setDragMetrics()
      },
      drag: (event: MouseEvent | TouchEvent) => {
        handleDrag(event)
      },
      end: (event: MouseEvent | TouchEvent) => {
        handleDrag(event)
        resetDragMetrics()
      },
    }

    draggable(bar.value, dragConfig)
    draggable(thumb.value, dragConfig)
    update()
  })

  watch(
    () => props.color.get('alpha'),
    () => update(),
  )
  watch(
    () => props.color.value,
    () => update(),
  )

  const rootKls = computed(() => [ns.b(), ns.is('vertical', props.vertical)])
  const barKls = computed(() => ns.e('bar'))
  const thumbKls = computed(() => ns.e('thumb'))
  const barStyle = computed(() => ({ background: background.value }))
  const thumbStyle = computed(() => ({
    left: addUnit(thumbLeft.value),
    top: addUnit(thumbTop.value),
  }))

  return { rootKls, barKls, barStyle, thumbKls, thumbStyle, update }
}
