import { isClient } from '@element-plus/utils'
import {
  applyFsusInteractiveMotionVars,
  getFsusMotionRuntime,
  resetFsusInteractiveMotionVars,
  resolveFsusInteractiveMotion,
} from '@element-plus/hooks'

let isDragging = false

export interface DraggableOptions {
  drag?: (event: MouseEvent | TouchEvent) => void
  start?: (event: MouseEvent | TouchEvent) => void
  end?: (event: MouseEvent | TouchEvent) => void
}

export function draggable(element: HTMLElement, options: DraggableOptions) {
  if (!isClient) return

  let frame = 0
  let lastPoint: { x: number; y: number } | undefined
  let lastTime = 0
  let pendingEvent: MouseEvent | TouchEvent | undefined

  const motionTargets = () => {
    const targets = [element]
    if (element.parentElement) targets.push(element.parentElement)
    if (
      element.nextElementSibling instanceof HTMLElement &&
      element.nextElementSibling.className.includes('thumb')
    ) {
      targets.push(element.nextElementSibling)
    }
    for (const child of element.querySelectorAll<HTMLElement>(
      [
        '.el-color-svpanel__cursor',
        '.el-color-svpanel__cursor > div',
        '.el-color-hue-slider__thumb',
        '.el-color-alpha-slider__thumb',
      ].join(','),
    )) {
      targets.push(child)
    }
    return targets
  }

  const getPoint = (event: MouseEvent | TouchEvent) => {
    if ('touches' in event) {
      const touch = event.touches[0] ?? event.changedTouches[0]
      if (touch) return { x: touch.clientX, y: touch.clientY }
    }
    return {
      x: (event as MouseEvent).clientX,
      y: (event as MouseEvent).clientY,
    }
  }

  const applyMetrics = (
    metrics: ReturnType<typeof resolveFsusInteractiveMotion>,
  ) => {
    for (const target of motionTargets()) {
      applyFsusInteractiveMotionVars(target, metrics)
    }
  }

  const applyMotion = (event: MouseEvent | TouchEvent) => {
    const point = getPoint(event)
    const now = performance.now()
    const previousPoint = lastPoint ?? point
    const elapsedMs = lastTime ? now - lastTime : 16
    const deltaX = point.x - previousPoint.x
    const deltaY = point.y - previousPoint.y
    if (!deltaX && !deltaY && lastPoint) {
      lastPoint = point
      lastTime = now
      return
    }
    const metrics = resolveFsusInteractiveMotion({
      deltaX,
      deltaY,
      elapsedMs,
      kind: 'color',
      runtime: getFsusMotionRuntime(),
    })

    applyMetrics(metrics)
    lastPoint = point
    lastTime = now
  }

  const clearFrame = () => {
    if (!frame) return
    window.cancelAnimationFrame(frame)
    frame = 0
  }

  const flushDrag = () => {
    clearFrame()
    const event = pendingEvent
    pendingEvent = undefined
    if (event) {
      applyMotion(event)
      options.drag?.(event)
    }
  }

  const scheduleDrag = (event: MouseEvent | TouchEvent) => {
    pendingEvent = event
    if (frame) return

    if (typeof window.requestAnimationFrame !== 'function') {
      flushDrag()
      return
    }

    frame = window.requestAnimationFrame(flushDrag)
  }

  const moveFn = function (event: MouseEvent | TouchEvent) {
    if (event.cancelable) event.preventDefault()
    scheduleDrag(event)
  }

  const upFn = function (event: MouseEvent | TouchEvent) {
    document.removeEventListener('mousemove', moveFn)
    document.removeEventListener('mouseup', upFn)
    document.removeEventListener('touchmove', moveFn)
    document.removeEventListener('touchend', upFn)
    document.onselectstart = null
    document.ondragstart = null
    flushDrag()

    isDragging = false
    element.classList.remove('is-dragging')
    for (const target of motionTargets()) {
      resetFsusInteractiveMotionVars(target)
    }
    lastPoint = undefined
    lastTime = 0

    options.end?.(event)
  }

  const downFn = function (event: MouseEvent | TouchEvent) {
    if (isDragging) return
    event.preventDefault()
    document.onselectstart = () => false
    document.ondragstart = () => false
    document.addEventListener('mousemove', moveFn)
    document.addEventListener('mouseup', upFn)
    document.addEventListener('touchmove', moveFn, { passive: false })
    document.addEventListener('touchend', upFn)

    isDragging = true
    element.classList.add('is-dragging')
    lastPoint = getPoint(event)
    lastTime = performance.now()
    applyMetrics(
      resolveFsusInteractiveMotion({
        deltaX: 24,
        deltaY: 24,
        elapsedMs: 16,
        kind: 'color',
        runtime: getFsusMotionRuntime(),
      }),
    )

    options.start?.(event)
  }

  element.addEventListener('mousedown', downFn)
  element.addEventListener('touchstart', downFn)
}
