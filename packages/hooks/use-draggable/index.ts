import { onBeforeUnmount, watchEffect } from 'vue'
import { addUnit } from '@element-plus/utils'
import type { ComputedRef, Ref } from 'vue'

const INTERACTIVE_DRAG_EXCLUDE_SELECTOR = [
  'button',
  'input',
  'textarea',
  'select',
  'option',
  'a',
  '[role="button"]',
].join(', ')

export const useDraggable = (
  targetRef: Ref<HTMLElement | undefined>,
  dragRef: Ref<HTMLElement | undefined>,
  draggable: ComputedRef<boolean>,
) => {
  let transform = {
    offsetX: 0,
    offsetY: 0,
  }
  let onMousemove: ((e: MouseEvent) => void) | null = null
  let onMouseup: (() => void) | null = null

  const cleanupDocumentListeners = () => {
    if (onMousemove) {
      document.removeEventListener('mousemove', onMousemove)
      onMousemove = null
    }

    if (onMouseup) {
      document.removeEventListener('mouseup', onMouseup)
      onMouseup = null
    }
  }

  const shouldSkipDrag = (
    target: EventTarget | null,
    dragEl: HTMLElement | undefined,
  ) => {
    if (!(target instanceof HTMLElement) || !dragEl) {
      return false
    }

    const interactiveElement = target.closest(INTERACTIVE_DRAG_EXCLUDE_SELECTOR)
    return (
      !!interactiveElement &&
      interactiveElement !== dragEl &&
      dragEl.contains(interactiveElement)
    )
  }

  const onMousedown = (e: MouseEvent) => {
    if (e.button !== 0 || shouldSkipDrag(e.target, dragRef.value)) {
      return
    }

    cleanupDocumentListeners()

    const downX = e.clientX
    const downY = e.clientY
    const { offsetX, offsetY } = transform

    const targetRect = targetRef.value!.getBoundingClientRect()
    const targetLeft = targetRect.left
    const targetTop = targetRect.top
    const targetWidth = targetRect.width
    const targetHeight = targetRect.height

    const clientWidth = document.documentElement.clientWidth
    const clientHeight = document.documentElement.clientHeight

    const minLeft = -targetLeft + offsetX
    const minTop = -targetTop + offsetY
    const maxLeft = clientWidth - targetLeft - targetWidth + offsetX
    const maxTop = clientHeight - targetTop - targetHeight + offsetY

    onMousemove = (e: MouseEvent) => {
      const moveX = Math.min(
        Math.max(offsetX + e.clientX - downX, minLeft),
        maxLeft,
      )
      const moveY = Math.min(
        Math.max(offsetY + e.clientY - downY, minTop),
        maxTop,
      )

      transform = {
        offsetX: moveX,
        offsetY: moveY,
      }

      if (targetRef.value) {
        targetRef.value.style.transform = `translate(${addUnit(
          moveX,
        )}, ${addUnit(moveY)})`
      }
    }

    onMouseup = () => {
      cleanupDocumentListeners()
    }

    document.addEventListener('mousemove', onMousemove)
    document.addEventListener('mouseup', onMouseup)
  }

  watchEffect((onCleanup) => {
    const dragEl = dragRef.value
    const targetEl = targetRef.value

    if (!draggable.value || !dragEl || !targetEl) {
      return
    }

    dragEl.addEventListener('mousedown', onMousedown)
    onCleanup(() => {
      dragEl.removeEventListener('mousedown', onMousedown)
      cleanupDocumentListeners()
    })
  })

  onBeforeUnmount(() => {
    cleanupDocumentListeners()
  })
}
