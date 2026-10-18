/** Native whole-target paint observations. No point/percentage inference grants visibility. */
export interface MarkdownEditorRevealPaint {
  readonly time: number
  readonly visible: boolean
  readonly bounds: DOMRectReadOnly
  readonly intersection: DOMRectReadOnly
}

export const createMarkdownEditorRevealVisibility = (
  textarea: HTMLTextAreaElement,
  receive: (paint: MarkdownEditorRevealPaint) => void,
) => {
  const view = textarea.ownerDocument.defaultView
  if (
    !view ||
    typeof view.IntersectionObserver !== 'function' ||
    typeof view.IntersectionObserverEntry !== 'function' ||
    !('isVisible' in view.IntersectionObserverEntry.prototype)
  )
    return null
  // The platform's full unocclusion algorithm is conservative. An engine that
  // ignores trackVisibility must refuse rather than substitute intersections.
  const options = { threshold: 0, trackVisibility: true, delay: 100 }
  const observer = new view.IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.target !== textarea) continue
      receive({
        time: entry.time,
        visible:
          Reflect.get(
            view.IntersectionObserverEntry.prototype,
            'isVisible',
            entry,
          ) === true && entry.isIntersecting,
        bounds: entry.boundingClientRect,
        intersection: entry.intersectionRect,
      })
    }
  }, options)
  if (
    Reflect.get(
      view.IntersectionObserver.prototype,
      'trackVisibility',
      observer,
    ) !== true
  ) {
    observer.disconnect()
    return null
  }
  return {
    request() {
      observer.disconnect()
      observer.takeRecords()
      observer.observe(textarea)
    },
    cancel() {
      observer.disconnect()
      observer.takeRecords()
    },
    dispose() {
      observer.disconnect()
      observer.takeRecords()
    },
  }
}
