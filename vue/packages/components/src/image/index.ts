import {
  computed,
  defineComponent,
  h,
  onBeforeUnmount,
  onMounted,
  ref,
  Teleport,
  type Directive,
  type PropType,
} from 'vue'
import { useEscapeKeydown, useFsusLocale, useFsusZIndex } from '@fsusui/core'
import { FsusIcon } from '@fsusui/icons'

export const FsusImageViewer = defineComponent({
  name: 'FsusImageViewer',
  props: {
    urlList: { type: Array as PropType<string[]>, required: true },
    initialIndex: { type: Number, default: 0 },
    teleported: { type: Boolean, default: true },
  },
  emits: ['close', 'switch'],
  setup(props, { emit }) {
    const { t } = useFsusLocale()
    const index = ref(props.initialIndex)
    const scale = ref(1)
    const rotate = ref(0)
    const { currentZIndex, nextZIndex } = useFsusZIndex()
    nextZIndex()

    const currentUrl = computed(() => props.urlList[index.value] ?? '')
    const step = (delta: number) => {
      if (props.urlList.length <= 1) return
      index.value = (index.value + delta + props.urlList.length) % props.urlList.length
      scale.value = 1
      rotate.value = 0
      emit('switch', index.value)
    }

    useEscapeKeydown(() => emit('close'), true)

    return () =>
      h(Teleport as any, { to: 'body', disabled: !props.teleported }, [
        h('div', { class: 'fsus-overlay fsus-image-viewer', role: 'dialog', 'aria-modal': 'true', style: { zIndex: currentZIndex.value } }, [
          h('div', { class: 'fsus-overlay__scrim', onClick: () => emit('close') }),
          h('div', { class: 'fsus-image-viewer__stage' }, [
            h('img', {
              src: currentUrl.value,
              class: 'fsus-image-viewer__img',
              style: { transform: `scale(${scale.value}) rotate(${rotate.value}deg)` },
            }),
          ]),
          h('div', { class: 'fsus-image-viewer__toolbar' }, [
            h('button', { type: 'button', 'aria-label': t('image.zoomOut'), onClick: () => (scale.value = Math.max(0.25, scale.value - 0.25)) }, [h(FsusIcon, { name: 'zoom-out' })]),
            h('button', { type: 'button', 'aria-label': t('image.zoomIn'), onClick: () => (scale.value = Math.min(4, scale.value + 0.25)) }, [h(FsusIcon, { name: 'zoom-in' })]),
            h('button', { type: 'button', 'aria-label': t('image.rotateLeft'), onClick: () => (rotate.value -= 90) }, [h(FsusIcon, { name: 'refresh-left' })]),
            h('button', { type: 'button', 'aria-label': t('image.rotateRight'), onClick: () => (rotate.value += 90) }, [h(FsusIcon, { name: 'refresh-right' })]),
            h('button', { type: 'button', 'aria-label': t('image.resetScale'), onClick: () => { scale.value = 1; rotate.value = 0 } }, [h(FsusIcon, { name: 'scale-to-original' })]),
            h('button', { type: 'button', 'aria-label': t('common.close'), onClick: () => emit('close') }, [h(FsusIcon, { name: 'close' })]),
          ]),
          props.urlList.length > 1
            ? [
                h('button', { type: 'button', class: 'fsus-image-viewer__nav', 'data-dir': 'prev', 'aria-label': 'Previous image', onClick: () => step(-1) }, [h(FsusIcon, { name: 'arrow-left' })]),
                h('button', { type: 'button', class: 'fsus-image-viewer__nav', 'data-dir': 'next', 'aria-label': 'Next image', onClick: () => step(1) }, [h(FsusIcon, { name: 'arrow-right' })]),
              ]
            : null,
        ]),
      ])
  },
})

export const FsusImage = defineComponent({
  name: 'FsusImage',
  props: {
    src: { type: String, default: '' },
    alt: { type: String, default: '' },
    fit: { type: String as PropType<'cover' | 'contain' | 'fill' | 'none'>, default: 'cover' },
    lazy: { type: Boolean, default: false },
    previewSrcList: { type: Array as PropType<string[]>, default: () => [] },
  },
  emits: ['load', 'error'],
  setup(props, { emit, slots }) {
    const { t } = useFsusLocale()
    const failed = ref(false)
    const previewOpen = ref(false)
    return () =>
      h('div', { class: 'fsus-image' }, [
        failed.value
          ? h('div', { class: 'fsus-image__error' }, slots.error ? slots.error() : t('image.loadError'))
          : h('img', {
              class: 'fsus-image__native',
              src: props.src,
              alt: props.alt,
              loading: props.lazy ? 'lazy' : undefined,
              style: { objectFit: props.fit, cursor: props.previewSrcList.length ? 'zoom-in' : undefined },
              onLoad: (e: Event) => emit('load', e),
              onError: (e: Event) => {
                failed.value = true
                emit('error', e)
              },
              onClick: () => {
                if (props.previewSrcList.length > 0) previewOpen.value = true
              },
            }),
        previewOpen.value
          ? h(FsusImageViewer, {
              urlList: props.previewSrcList,
              onClose: () => (previewOpen.value = false),
            })
          : null,
      ])
  },
})

// Modern IntersectionObserver InfiniteScroll (component + directive)
export const FsusInfiniteScroll = defineComponent({
  name: 'FsusInfiniteScroll',
  props: {
    disabled: { type: Boolean, default: false },
    rootMargin: { type: String, default: '0px 0px 120px 0px' },
  },
  emits: ['load'],
  setup(props, { emit, slots }) {
    const sentinelRef = ref<HTMLElement | null>(null)
    let observer: IntersectionObserver | undefined
    onMounted(() => {
      if (!sentinelRef.value || typeof IntersectionObserver === 'undefined') return
      observer = new IntersectionObserver(
        (entries) => {
          if (!props.disabled && entries.some((e) => e.isIntersecting)) {
            emit('load')
          }
        },
        { rootMargin: props.rootMargin },
      )
      observer.observe(sentinelRef.value)
    })
    onBeforeUnmount(() => observer?.disconnect())
    return () =>
      h('div', { class: 'fsus-infinite-scroll' }, [
        slots.default?.(),
        h('div', { ref: sentinelRef, class: 'fsus-infinite-scroll__sentinel', 'aria-hidden': 'true' }),
      ])
  },
})

const infiniteHandlers = new WeakMap<HTMLElement, () => void>()

export const vFsusInfiniteScroll: Directive<HTMLElement, () => void> = {
  mounted(el, binding) {
    const onScroll = () => {
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 40) {
        binding.value?.()
      }
    }
    infiniteHandlers.set(el, onScroll)
    el.addEventListener('scroll', onScroll, { passive: true })
  },
  unmounted(el) {
    const fn = infiniteHandlers.get(el)
    if (fn) {
      el.removeEventListener('scroll', fn)
      infiniteHandlers.delete(el)
    }
  },
}
