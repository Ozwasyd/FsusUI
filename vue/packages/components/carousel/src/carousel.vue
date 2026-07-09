<template>
  <div
    ref="root"
    :class="carouselClasses"
    @pointercancel="handlePointerCancel"
    @pointerdown="handlePointerDown"
    @pointermove="handlePointerMove"
    @pointerup="handlePointerUp"
    @mouseenter.stop="handleMouseEnter"
    @mouseleave.stop="handleMouseLeave"
  >
    <div :class="ns.e('container')" :style="containerStyle">
      <transition v-if="arrowDisplay" name="carousel-arrow-left">
        <button
          v-show="
            (arrow === 'always' || hover) && (props.loop || activeIndex > 0)
          "
          type="button"
          :aria-label="t('el.carousel.prev')"
          :class="[ns.e('arrow'), ns.em('arrow', 'left')]"
          @mouseenter="handleButtonEnter('left')"
          @mouseleave="handleButtonLeave"
          @click.stop="throttledArrowClick(activeIndex - 1)"
        >
          <ElIcon>
            <ArrowLeft />
          </ElIcon>
        </button>
      </transition>
      <transition v-if="arrowDisplay" name="carousel-arrow-right">
        <button
          v-show="
            (arrow === 'always' || hover) &&
            (props.loop || activeIndex < items.length - 1)
          "
          type="button"
          :aria-label="t('el.carousel.next')"
          :class="[ns.e('arrow'), ns.em('arrow', 'right')]"
          @mouseenter="handleButtonEnter('right')"
          @mouseleave="handleButtonLeave"
          @click.stop="throttledArrowClick(activeIndex + 1)"
        >
          <ElIcon>
            <ArrowRight />
          </ElIcon>
        </button>
      </transition>
      <PlaceholderItem />
      <slot />
    </div>
    <ul v-if="indicatorPosition !== 'none'" :class="indicatorsClasses">
      <li
        v-for="(item, index) in items"
        v-show="isTwoLengthShow(index)"
        :key="index"
        :class="[
          ns.e('indicator'),
          ns.em('indicator', direction),
          ns.is('active', index === activeIndex),
        ]"
        @mouseenter="throttledIndicatorHover(index)"
        @click.stop="handleIndicatorClick(index)"
      >
        <button
          type="button"
          :aria-label="
            hasLabel
              ? undefined
              : t('el.carousel.indicator', { index: index + 1 })
          "
          :class="ns.e('button')"
        >
          <template v-if="hasLabel">{{ item.props.label }}</template>
        </button>
      </li>
    </ul>
  </div>
</template>

<script lang="ts" setup>
import { computed, unref } from 'vue'
import { ElIcon } from '@element-plus/components/icon'
import { ArrowLeft, ArrowRight } from '@element-plus/icons-vue'
import { useLocale, useNamespace } from '@element-plus/hooks'
import { carouselEmits, carouselProps } from './carousel'
import { useCarousel } from './use-carousel'

const COMPONENT_NAME = 'ElCarousel'
defineOptions({
  name: COMPONENT_NAME,
})

const props = defineProps(carouselProps)
const emit = defineEmits(carouselEmits)
const {
  root,
  activeIndex,
  arrowDisplay,
  hasLabel,
  hover,
  isDragging,
  isCardType,
  items,
  isVertical,
  containerStyle,
  handleButtonEnter,
  handleButtonLeave,
  handleIndicatorClick,
  handleMouseEnter,
  handleMouseLeave,
  handlePointerCancel,
  handlePointerDown,
  handlePointerMove,
  handlePointerUp,
  setActiveItem,
  prev,
  next,
  PlaceholderItem,
  isTwoLengthShow,
  throttledArrowClick,
  throttledIndicatorHover,
} = useCarousel(props, emit, COMPONENT_NAME)
const ns = useNamespace('carousel')
const { t } = useLocale()

const carouselClasses = computed(() => {
  const classes = [ns.b(), ns.m(props.direction)]
  if (unref(isCardType)) {
    classes.push(ns.m('card'))
  }
  if (unref(isDragging)) {
    classes.push(ns.is('dragging'))
  }
  return classes
})

const indicatorsClasses = computed(() => {
  const classes = [ns.e('indicators'), ns.em('indicators', props.direction)]
  if (unref(hasLabel)) {
    classes.push(ns.em('indicators', 'labels'))
  }
  if (props.indicatorPosition === 'outside') {
    classes.push(ns.em('indicators', 'outside'))
  }
  if (unref(isVertical)) {
    classes.push(ns.em('indicators', 'right'))
  }
  return classes
})

defineExpose({
  /** @description manually switch slide */
  setActiveItem,
  /** @description switch to the previous slide */
  prev,
  /** @description switch to the next slide */
  next,
})
</script>
