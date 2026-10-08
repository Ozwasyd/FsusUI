<template>
  <teleport :to="appendTo" :disabled="!teleported">
    <el-focus-trap
      :trapped="visible"
      :focus-trap-el="wrapper"
      focus-start-el="container"
      loop
      @release-requested="closeOnPressEscape && hide()"
      @focus-after-trapped="inertActive = true"
      @focus-after-released="inertActive = false"
    >
      <transition name="viewer-fade" appear>
        <div
          v-if="visible"
          ref="wrapper"
          role="dialog"
          aria-modal="true"
          :aria-label="ariaLabel || translatedAction('title')"
          :aria-describedby="$slots.caption ? captionId : undefined"
          :tabindex="-1"
          :class="ns.e('wrapper')"
          v-bind="{
            ...$attrs,
            'data-fsus-material': 'glass',
            ...(cspSafe ? {} : { style: { zIndex: computedZIndex } }),
          }"
        >
          <div :class="ns.e('mask')" @click.self="hideOnClickModal && hide()" />

          <!-- CLOSE -->
          <span
            :class="[ns.e('btn'), ns.e('close')]"
            role="button"
            tabindex="0"
            :aria-label="controlLabels.close"
            v-on="closeEvents"
          >
            <Close />
          </span>

          <!-- ARROW -->
          <template v-if="!isSingle">
            <span
              :class="arrowPrevKls"
              role="button"
              :tabindex="!props.infinite && isFirst ? -1 : 0"
              :aria-disabled="!props.infinite && isFirst ? 'true' : undefined"
              :aria-label="controlLabels.previous"
              v-on="prevEvents"
            >
              <ArrowLeft />
            </span>
            <span
              :class="arrowNextKls"
              role="button"
              :tabindex="!props.infinite && isLast ? -1 : 0"
              :aria-disabled="!props.infinite && isLast ? 'true' : undefined"
              :aria-label="controlLabels.next"
              v-on="nextEvents"
            >
              <ArrowRight />
            </span>
          </template>
          <!-- ACTIONS -->
          <div v-if="showToolbar" :class="[ns.e('btn'), ns.e('actions')]">
            <span
              :class="ns.e('action')"
              role="button"
              tabindex="0"
              :aria-label="controlLabels.zoomOut"
              v-on="zoomOutEvents"
            >
              <ZoomOut />
            </span>
            <span
              :class="ns.e('action')"
              role="button"
              tabindex="0"
              :aria-label="controlLabels.zoomIn"
              v-on="zoomInEvents"
            >
              <ZoomIn />
            </span>
            <i :class="ns.e('actions__divider')" />
            <span
              :class="ns.e('action')"
              role="button"
              tabindex="0"
              :aria-label="controlLabels.toggleMode"
              v-on="toggleModeEvents"
            >
              <component :is="mode.icon" />
            </span>
            <i :class="ns.e('actions__divider')" />
            <span
              :class="ns.e('action')"
              role="button"
              tabindex="0"
              :aria-label="controlLabels.rotateLeft"
              v-on="anticlockwiseEvents"
            >
              <RefreshLeft />
            </span>
            <span
              :class="ns.e('action')"
              role="button"
              tabindex="0"
              :aria-label="controlLabels.rotateRight"
              v-on="clockwiseEvents"
            >
              <RefreshRight />
            </span>
          </div>
          <!-- CANVAS -->
          <div :class="ns.e('canvas')">
            <img
              v-for="(url, i) in urlList"
              :ref="(el) => (imgRefs[i] = el as HTMLImageElement)"
              :key="url"
              :src="url"
              :alt="altList[i] || ''"
              v-bind="
                cspSafe
                  ? {}
                  : {
                      style: [
                        imgStyle,
                        i !== activeIndex ? { display: 'none' } : undefined,
                      ],
                    }
              "
              :class="[
                ns.e('img'),
                ns.is('contain', mode.name === modes.CONTAIN.name),
                ns.is('hidden', cspSafe && i !== activeIndex),
              ]"
              @load="handleImgLoad"
              @error="handleImgError"
              @mousedown="handleMouseDown"
            />
          </div>
          <div
            v-if="$slots.caption"
            :id="captionId"
            ref="caption"
            :class="ns.e('caption')"
          >
            <slot
              name="caption"
              :index="activeIndex"
              :url="currentImg"
              :alt="altList[activeIndex] || ''"
            />
          </div>
          <slot />
        </div>
      </transition>
    </el-focus-trap>
  </teleport>
</template>

<script lang="ts" setup>
import {
  computed,
  effectScope,
  markRaw,
  nextTick,
  onMounted,
  onBeforeUnmount,
  useId,
  ref,
  shallowRef,
  watch,
} from 'vue'
import { useEventListener } from '@element-plus/hooks/use-runtime'
import { throttle } from 'lodash-unified'
import {
  useLocale,
  useNamespace,
  useZIndex,
  useLockscreen,
} from '@element-plus/hooks'
import { useModalInert } from '@element-plus/hooks/use-modal'
import ElFocusTrap from '@element-plus/components/focus-trap'
import English from '@element-plus/locale/lang/en'
import { EVENT_CODE } from '@element-plus/constants'
import { isNumber, keysOf } from '@element-plus/utils'
import {
  ArrowLeft,
  ArrowRight,
  Close,
  FullScreen,
  RefreshLeft,
  RefreshRight,
  ScaleToOriginal,
  ZoomIn,
  ZoomOut,
} from '@element-plus/icons-vue'
import { imageViewerEmits, imageViewerProps } from './image-viewer'

import type { CSSProperties } from 'vue'
import type { ImageViewerAction, ImageViewerMode } from './image-viewer'

const modes: Record<'CONTAIN' | 'ORIGINAL', ImageViewerMode> = {
  CONTAIN: {
    name: 'contain',
    icon: markRaw(FullScreen),
  },
  ORIGINAL: {
    name: 'original',
    icon: markRaw(ScaleToOriginal),
  },
}

defineOptions({
  name: 'ElImageViewer',
  inheritAttrs: false,
})

const props = defineProps(imageViewerProps)
const emit = defineEmits(imageViewerEmits)

const { t } = useLocale()
const ns = useNamespace('image-viewer')
const { nextZIndex } = useZIndex()
const viewerZIndex = nextZIndex()
const wrapper = ref<HTMLDivElement>()
const caption = ref<HTMLElement>()
const imgRefs = ref<HTMLImageElement[]>([])

let scopeEventListener = effectScope()
const visible = ref(props.visible)
const inertActive = ref(false)
const captionId = useId()
useLockscreen(visible)
useModalInert(wrapper, inertActive)
const translatedAction = (key: keyof typeof English.el.imageViewer) => {
  const value = t(`el.imageViewer.${key}`)
  return value === `el.imageViewer.${key}` ? English.el.imageViewer[key] : value
}
const controlLabels = computed(() => ({
  close: translatedAction('close'),
  previous: translatedAction('previous'),
  next: translatedAction('next'),
  zoomOut: translatedAction('zoomOut'),
  zoomIn: translatedAction('zoomIn'),
  toggleMode: translatedAction('toggleMode'),
  rotateLeft: translatedAction('rotateLeft'),
  rotateRight: translatedAction('rotateRight'),
  ...props.labels,
}))

const loading = ref(true)
const activeIndex = ref(props.activeIndex ?? props.initialIndex)
const mode = shallowRef<ImageViewerMode>(modes.CONTAIN)
const transform = ref({
  scale: 1,
  deg: 0,
  offsetX: 0,
  offsetY: 0,
  enableTransition: false,
})

const isSingle = computed(() => {
  const { urlList } = props
  return urlList.length <= 1
})

const isFirst = computed(() => {
  return activeIndex.value === 0
})

const isLast = computed(() => {
  return activeIndex.value === props.urlList.length - 1
})

const currentImg = computed(() => {
  return props.urlList[activeIndex.value]
})

const arrowPrevKls = computed(() => [
  ns.e('btn'),
  ns.e('prev'),
  ns.is('disabled', !props.infinite && isFirst.value),
])

const arrowNextKls = computed(() => [
  ns.e('btn'),
  ns.e('next'),
  ns.is('disabled', !props.infinite && isLast.value),
])

const imgStyle = computed(() => {
  const { scale, deg, offsetX, offsetY, enableTransition } = transform.value
  let translateX = offsetX / scale
  let translateY = offsetY / scale

  switch (deg % 360) {
    case 90:
    case -270:
      ;[translateX, translateY] = [translateY, -translateX]
      break
    case 180:
    case -180:
      ;[translateX, translateY] = [-translateX, -translateY]
      break
    case 270:
    case -90:
      ;[translateX, translateY] = [-translateY, translateX]
      break
  }

  const style: CSSProperties = {
    transform: `scale(${scale}) rotate(${deg}deg) translate(${translateX}px, ${translateY}px)`,
    transition: enableTransition ? 'transform .3s' : '',
  }
  const sizeLimit = mode.value.name === modes.CONTAIN.name ? '100%' : 'none'
  style.maxWidth = style.maxHeight = sizeLimit
  return style
})

const computedZIndex = computed(() => {
  return isNumber(props.zIndex) ? props.zIndex : viewerZIndex
})

function hide() {
  if (!visible.value) return
  visible.value = false
  unregisterEventListener()
  emit('update:visible', false)
  emit('close')
}

function registerEventListener() {
  const keydownHandler = throttle((e: KeyboardEvent) => {
    switch (e.code) {
      // SPACE
      case EVENT_CODE.space:
        toggleMode()
        break
      // LEFT_ARROW
      case EVENT_CODE.left:
        prev()
        break
      // UP_ARROW
      case EVENT_CODE.up:
        handleActions('zoomIn')
        break
      // RIGHT_ARROW
      case EVENT_CODE.right:
        next()
        break
      // DOWN_ARROW
      case EVENT_CODE.down:
        handleActions('zoomOut')
        break
    }
  })
  const mousewheelHandler = throttle((e: WheelEvent) => {
    if (!props.showToolbar || caption.value?.contains(e.target as Node)) return
    e.preventDefault()
    const delta = e.deltaY || e.deltaX
    handleActions(delta < 0 ? 'zoomIn' : 'zoomOut', {
      zoomRate: props.zoomRate,
      enableTransition: false,
    })
  })

  scopeEventListener = effectScope()
  scopeEventListener.run(() => {
    useEventListener(wrapper, 'keydown', keydownHandler)
    useEventListener(wrapper, 'wheel', mousewheelHandler, { passive: false })
  })
}

function unregisterEventListener() {
  scopeEventListener.stop()
}

function handleImgLoad() {
  loading.value = false
}

function handleImgError(e: Event) {
  loading.value = false
  const image = e.target as HTMLImageElement
  if (!image.alt) image.alt = t('el.image.error')
}

function handleMouseDown(e: MouseEvent) {
  if (!props.showToolbar || loading.value || e.button !== 0 || !wrapper.value)
    return
  transform.value.enableTransition = false

  const { offsetX, offsetY } = transform.value
  const startX = e.pageX
  const startY = e.pageY

  const dragHandler = throttle((ev: MouseEvent) => {
    transform.value = {
      ...transform.value,
      offsetX: offsetX + ev.pageX - startX,
      offsetY: offsetY + ev.pageY - startY,
    }
  })
  const removeMousemove = useEventListener(document, 'mousemove', dragHandler)
  useEventListener(document, 'mouseup', () => {
    removeMousemove()
  })

  e.preventDefault()
}

function reset() {
  transform.value = {
    scale: 1,
    deg: 0,
    offsetX: 0,
    offsetY: 0,
    enableTransition: false,
  }
}

function toggleMode() {
  if (!props.showToolbar || loading.value) return

  const modeNames = keysOf(modes)
  const modeValues = Object.values(modes)
  const currentMode = mode.value.name
  const index = modeValues.findIndex((i) => i.name === currentMode)
  const nextIndex = (index + 1) % modeNames.length
  mode.value = modes[modeNames[nextIndex]]
  reset()
}

function handleControlKeydown(e: KeyboardEvent, handler: () => void) {
  if (e.code !== EVENT_CODE.enter && e.code !== EVENT_CODE.space) return

  e.preventDefault()
  e.stopPropagation()
  handler()
}

function createControlEvents(handler: () => void) {
  return {
    click: handler,
    keydown: (e: KeyboardEvent) => handleControlKeydown(e, handler),
  }
}

const closeEvents = createControlEvents(hide)
const prevEvents = createControlEvents(prev)
const nextEvents = createControlEvents(next)
const zoomOutEvents = createControlEvents(() => handleActions('zoomOut'))
const zoomInEvents = createControlEvents(() => handleActions('zoomIn'))
const toggleModeEvents = createControlEvents(toggleMode)
const anticlockwiseEvents = createControlEvents(() =>
  handleActions('anticlockwise'),
)
const clockwiseEvents = createControlEvents(() => handleActions('clockwise'))

function setActiveItem(index: number) {
  const len = props.urlList.length
  if (!len) {
    activeIndex.value = 0
    return
  }
  activeIndex.value = ((index % len) + len) % len
}

function prev() {
  if (isFirst.value && !props.infinite) return
  if (isSingle.value) return
  setActiveItem(activeIndex.value - 1)
  emit('previous', activeIndex.value)
}

function next() {
  if (isLast.value && !props.infinite) return
  if (isSingle.value) return
  setActiveItem(activeIndex.value + 1)
  emit('next', activeIndex.value)
}

function handleActions(action: ImageViewerAction, options = {}) {
  if (!props.showToolbar || loading.value) return
  const { minScale, maxScale } = props
  const { zoomRate, rotateDeg, enableTransition } = {
    zoomRate: props.zoomRate,
    rotateDeg: 90,
    enableTransition: true,
    ...options,
  }
  switch (action) {
    case 'zoomOut':
      if (transform.value.scale > minScale) {
        transform.value.scale = Number.parseFloat(
          (transform.value.scale / zoomRate).toFixed(3),
        )
      }
      break
    case 'zoomIn':
      if (transform.value.scale < maxScale) {
        transform.value.scale = Number.parseFloat(
          (transform.value.scale * zoomRate).toFixed(3),
        )
      }
      break
    case 'clockwise':
      transform.value.deg += rotateDeg
      emit('rotate', transform.value.deg)
      break
    case 'anticlockwise':
      transform.value.deg -= rotateDeg
      emit('rotate', transform.value.deg)
      break
  }
  transform.value.enableTransition = enableTransition
}

watch(currentImg, () => {
  nextTick(() => {
    const $img = imgRefs.value[activeIndex.value]
    if (!$img?.complete) {
      loading.value = true
    }
  })
})

watch(activeIndex, (val) => {
  reset()
  emit('update:activeIndex', val)
  emit('switch', val)
})

watch(
  () => props.activeIndex,
  (index) => {
    if (index !== undefined) setActiveItem(index)
  },
)
watch(
  () => props.urlList.length,
  () => setActiveItem(activeIndex.value),
)
watch(
  () => props.visible,
  (value) => {
    visible.value = value
  },
)
watch(visible, async (value) => {
  unregisterEventListener()
  if (value) {
    await nextTick()
    registerEventListener()
  }
})
watch(
  [wrapper, imgStyle, computedZIndex, activeIndex],
  () => {
    if (!props.cspSafe) return
    if (wrapper.value) wrapper.value.style.zIndex = String(computedZIndex.value)
    for (const image of imgRefs.value) {
      if (image) Object.assign(image.style, imgStyle.value)
    }
  },
  { flush: 'post' },
)
onMounted(() => {
  if (visible.value) registerEventListener()
})
onBeforeUnmount(unregisterEventListener)

defineExpose({
  /**
   * @description manually switch image
   */
  setActiveItem,
})
</script>
