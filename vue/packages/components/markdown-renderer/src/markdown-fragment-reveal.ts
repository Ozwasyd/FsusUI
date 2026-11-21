import { nextTick } from 'vue'
import type { MarkdownEditorFrameScheduler } from '@element-plus/hooks'
import type { MarkdownFragmentRevealOptions } from './markdown-renderer'

// Each attempt waits for the virtualizer to apply a frame of measurements
// before re-reading its size index. A first jump can land past the target
// when previously estimated chunk sizes change around the destination.
const MAX_FRAGMENT_REVEAL_ATTEMPTS = 4
const FRAGMENT_SETTLE_FRAMES = 2
const waitForFragmentFrame = (
  frameScheduler: Pick<MarkdownEditorFrameScheduler, 'schedule' | 'cancel'>,
  frameKey: string,
  signal: AbortSignal,
  measure: () => void,
  mutate?: () => void,
) =>
  new Promise<void>((resolve) => {
    if (signal.aborted) {
      resolve()
      return
    }
    const finish = () => {
      signal.removeEventListener('abort', abort)
      resolve()
    }
    const abort = () => {
      frameScheduler.cancel(frameKey)
      finish()
    }
    signal.addEventListener('abort', abort, { once: true })
    if (
      !frameScheduler.schedule({
        key: frameKey,
        measure,
        mutate,
        postPaint: finish,
      })
    ) {
      finish()
    }
  })

/** Loaded only when a fragment requires mounting an offscreen virtual chunk. */
export const revealVirtualMarkdownFragment = async ({
  root,
  viewport,
  frameScheduler,
  frameKey,
  signal,
  getEstimatedOffset,
  readViewport,
  isTargetCurrent,
  findTarget,
  scrollTarget,
  behavior = 'auto',
  block = 'start',
}: MarkdownFragmentRevealOptions & {
  root: HTMLElement
  viewport: HTMLElement
  frameScheduler: Pick<MarkdownEditorFrameScheduler, 'schedule' | 'cancel'>
  frameKey: string
  signal: AbortSignal
  getEstimatedOffset: () => number
  readViewport: () => void
  isTargetCurrent: () => boolean
  findTarget: () => HTMLElement | null
  scrollTarget: (element: HTMLElement) => void
}): Promise<HTMLElement | null> => {
  if (signal.aborted) return null
  const scheduleFragmentFrame = (measure: () => void, mutate?: () => void) =>
    waitForFragmentFrame(frameScheduler, frameKey, signal, measure, mutate)
  const isDocumentViewport =
    viewport === document.documentElement ||
    viewport === document.body ||
    viewport === document.scrollingElement
  const usesSmoothScroll =
    behavior === 'smooth' ||
    (behavior === 'auto' &&
      window.getComputedStyle(viewport).scrollBehavior === 'smooth')
  for (
    let attempt = 0;
    attempt < MAX_FRAGMENT_REVEAL_ATTEMPTS && !signal.aborted;
    attempt += 1
  ) {
    if (!isTargetCurrent()) break
    let targetScrollTop = 0
    await scheduleFragmentFrame(
      () => {
        const rootOffsetInViewport = isDocumentViewport
          ? root.getBoundingClientRect().top + window.scrollY
          : root.getBoundingClientRect().top -
            viewport.getBoundingClientRect().top +
            viewport.scrollTop
        const estimatedChunkOffset = getEstimatedOffset()
        // Use the middle of the viewport to tolerate estimate drift on
        // either side. The final element scroll honors the caller's options.
        const viewportHeight = isDocumentViewport
          ? window.innerHeight
          : viewport.clientHeight
        targetScrollTop = Math.max(
          0,
          rootOffsetInViewport + estimatedChunkOffset - viewportHeight / 2,
        )
      },
      () => {
        const scroller = isDocumentViewport ? window : viewport
        if (typeof scroller.scrollTo === 'function') {
          scroller.scrollTo({ top: targetScrollTop, behavior: 'instant' })
        } else {
          viewport.scrollTop = targetScrollTop
        }
      },
    )
    await scheduleFragmentFrame(readViewport)
    await nextTick()
    if (signal.aborted) break
    let element = findTarget()
    // Use the actual element once it exists. One more alignment can absorb
    // a measured-height adjustment without jumping back to an estimate.
    for (let alignment = 0; alignment < 2 && element; alignment += 1) {
      scrollTarget(element)
      for (
        let frame = 0;
        frame < FRAGMENT_SETTLE_FRAMES && !signal.aborted;
        frame += 1
      ) {
        await scheduleFragmentFrame(readViewport)
        await nextTick()
      }
      if (signal.aborted) break

      const confirmed = findTarget()
      if (!confirmed) break
      if (usesSmoothScroll) return confirmed

      const viewportTop = isDocumentViewport
        ? 0
        : viewport.getBoundingClientRect().top + viewport.clientTop
      const viewportBottom =
        viewportTop +
        (isDocumentViewport ? window.innerHeight : viewport.clientHeight)
      const targetRect = confirmed.getBoundingClientRect()
      const startsAboveViewport =
        block === 'start' && targetRect.top < viewportTop - 1
      if (
        !startsAboveViewport &&
        targetRect.bottom > viewportTop &&
        targetRect.top < viewportBottom
      ) {
        return confirmed
      }
      element = confirmed
    }
  }
  return null
}
