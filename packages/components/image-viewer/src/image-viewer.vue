<template>
  <teleport to="body" :disabled="!teleported">
    <transition name="viewer-fade" appear>
      <div
        ref="wrapper"
        :tabindex="-1"
        :class="ns.e('wrapper')"
        :style="{ zIndex: computedZIndex }"
      >
        <div :class="ns.e('mask')" @click.self="hideOnClickModal && hide()" />

        <!-- CLOSE -->
        <span :class="[ns.e('btn'), ns.e('close')]" @click="hide">
          <Close />
        </span>

        <!-- ARROW -->
        <template v-if="!isSingle">
          <span :class="arrowPrevKls" @click="prev">
            <ArrowLeft />
          </span>
          <span :class="arrowNextKls" @click="next">
            <ArrowRight />
          </span>
        </template>
        <!-- ACTIONS -->
        <div :class="[ns.e('btn'), ns.e('actions')]">
          <span :class="ns.e('action')" v-on="zoomOutEvents">
            <ZoomOut />
          </span>
          <span :class="ns.e('action')" v-on="zoomInEvents">
            <ZoomIn />
          </span>
          <i :class="ns.e('actions__divider')" />
          <span :class="ns.e('action')" v-on="toggleModeEvents">
            <component :is="mode.icon" />
          </span>
          <i :class="ns.e('actions__divider')" />
          <span :class="ns.e('action')" v-on="anticlockwiseEvents">
            <RefreshLeft />
          </span>
          <span :class="ns.e('action')" v-on="clockwiseEvents">
            <RefreshRight />
          </span>
        </div>
        <!-- CANVAS -->
        <div :class="ns.e('canvas')">
          <img
            v-for="(url, i) in urlList"
            v-show="i === activeIndex"
            :ref="(el) => (imgRefs[i] = el as HTMLImageElement)"
            :key="url"
            :src="url"
            :style="imgStyle"
            :class="ns.e('img')"
            @load="handleImgLoad"
            @error="handleImgError"
            @mousedown="handleMouseDown"
          />
        </div>
        <slot />
      </div>
    </transition>
  </teleport>
</template>

<script lang="ts" setup>
import {
  computed,
  effectScope,
  markRaw,
  nextTick,
  onMounted,
  ref,
  shallowRef,
  watch,
} from 'vue'
import { useEventListener } from '@element-plus/hooks/use-runtime'
import { throttle } from 'lodash-unified'
import { useLocale, useNamespace, useZIndex } from '@element-plus/hooks'
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
})

const props = defineProps(imageViewerProps)
const emit = defineEmits(imageViewerEmits)

const { t } = useLocale()
const ns = useNamespace('image-viewer')
const { nextZIndex } = useZIndex()
const wrapper = ref<HTMLDivElement>()
const imgRefs = ref<HTMLImageElement[]>([])

const scopeEventListener = effectScope()

const loading = ref(true)
const activeIndex = ref(props.initialIndex)
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
  if (mode.value.name === modes.CONTAIN.name) {
    style.maxWidth = style.maxHeight = '100%'
  }
  return style
})

const computedZIndex = computed(() => {
  return isNumber(props.zIndex) ? props.zIndex : nextZIndex()
})

function hide() {
  unregisterEventListener()
  emit('close')
}

function registerEventListener() {
  const keydownHandler = throttle((e: KeyboardEvent) => {
    switch (e.code) {
      // ESC
      case EVENT_CODE.esc:
        if (props.closeOnPressEscape) {
          hide()
        }
        break
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
  const escHandler = throttle((e: KeyboardEvent) => {
    if (e.code === EVENT_CODE.esc && props.closeOnPressEscape) {
      hide()
    }
  })
  const mousewheelHandler = throttle((e: WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY || e.deltaX
    handleActions(delta < 0 ? 'zoomIn' : 'zoomOut', {
      zoomRate: props.zoomRate,
      enableTransition: false,
    })
  })

  scopeEventListener.run(() => {
    // ESC 全局响应，方便用户随时关闭；其余快捷键仅在 wrapper 聚焦时生效
    useEventListener(document, 'keydown', escHandler)
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
  ;(e.target as HTMLImageElement).alt = t('el.image.error')
}

function handleMouseDown(e: MouseEvent) {
  if (loading.value || e.button !== 0 || !wrapper.value) return
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
  if (loading.value) return

  const modeNames = keysOf(modes)
  const modeValues = Object.values(modes)
  const currentMode = mode.value.name
  const index = modeValues.findIndex((i) => i.name === currentMode)
  const nextIndex = (index + 1) % modeNames.length
  mode.value = modes[modeNames[nextIndex]]
  reset()
}

const zoomOutEvents = { click: () => handleActions('zoomOut') }
const zoomInEvents = { click: () => handleActions('zoomIn') }
const toggleModeEvents = { click: toggleMode }
const anticlockwiseEvents = { click: () => handleActions('anticlockwise') }
const clockwiseEvents = { click: () => handleActions('clockwise') }

function setActiveItem(index: number) {
  const len = props.urlList.length
  activeIndex.value = (index + len) % len
}

function prev() {
  if (isFirst.value && !props.infinite) return
  setActiveItem(activeIndex.value - 1)
}

function next() {
  if (isLast.value && !props.infinite) return
  setActiveItem(activeIndex.value + 1)
}

function handleActions(action: ImageViewerAction, options = {}) {
  if (loading.value) return
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
    const $img = imgRefs.value[0]
    if (!$img?.complete) {
      loading.value = true
    }
  })
})

watch(activeIndex, (val) => {
  reset()
  emit('switch', val)
})

onMounted(() => {
  registerEventListener()
  // add tabindex then wrapper can be focusable via Javascript
  // focus wrapper so arrow key can't cause inner scroll behavior underneath
  wrapper.value?.focus?.()
})

defineExpose({
  /**
   * @description manually switch image
   */
  setActiveItem,
})
</script>
