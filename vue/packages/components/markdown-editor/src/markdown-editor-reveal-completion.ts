import type {
  MarkdownEditorSession,
  MarkdownEditorSessionDocumentState,
} from './markdown-editor-session'
import type { MarkdownEditorResolvedSelection } from './markdown-editor-transaction'

const measurementNodes = new WeakSet<Node>()

/** Only these transient, nonpainting nodes are excluded from paint invalidation. */
export const isMarkdownEditorRevealMeasurementMutation = (
  record: MutationRecord,
) => {
  const nodes = [...record.addedNodes, ...record.removedNodes]
  return (
    record.type === 'childList' &&
    nodes.length > 0 &&
    nodes.every((node) => measurementNodes.has(node))
  )
}

export interface MarkdownEditorRevealCompletionOptions {
  /** The exact object returned by this mounted editor's getSession(). */
  readonly session: MarkdownEditorSession
  readonly expected: MarkdownEditorSessionDocumentState
  readonly signal: AbortSignal
  /** Recheck the host's current navigation admission; throw to refuse. */
  readonly assertAdmission: () => void
  /** Failure deadline, 1..5000ms. Default 1500ms; never grants success. */
  readonly timeoutMs?: number
}

export interface MarkdownEditorRevealCompletion extends MarkdownEditorSessionDocumentState {
  readonly status: 'success'
  readonly editorSessionRef: string
  readonly selection: MarkdownEditorResolvedSelection
  readonly focus: 'textarea'
  /** All selection fragments inside the viewport; native full-area unocclusion confirmed. */
  readonly viewport: 'full-selection-visible'
}

export type MarkdownEditorRevealFailureReason =
  | 'aborted'
  | 'admission-rejected'
  | 'stale'
  | 'unavailable'
  | 'unsupported'
  | 'invalid-selection'
  | 'focus-lost'
  | 'selection-changed'
  | 'superseded'
  | 'interrupted'
  | 'timeout'

export class MarkdownEditorRevealError extends Error {
  readonly reason: MarkdownEditorRevealFailureReason

  constructor(reason: MarkdownEditorRevealFailureReason, cause?: unknown) {
    super(`markdown-editor-reveal-${reason}`, { cause })
    this.name = 'MarkdownEditorRevealError'
    this.reason = reason
  }
}

/** Native layout measurement only; the mirror is inert, temporary and never an input owner. */
export const measureMarkdownEditorReveal = (
  textarea: HTMLTextAreaElement,
  selection: MarkdownEditorResolvedSelection,
) => {
  const document = textarea.ownerDocument
  const view = document.defaultView
  if (
    !view ||
    !textarea.isConnected ||
    textarea.hidden ||
    document.fonts?.status === 'loading' ||
    textarea.value.length > 1_000_000
  )
    return null
  const nativeBox = textarea.getBoundingClientRect()
  const uncertainClip = (
    css: CSSStyleDeclaration,
    box: DOMRectReadOnly,
    nativeControl = false,
  ) => {
    if (
      !['', 'none'].includes(css.getPropertyValue('clip-path')) ||
      ['mask-image', 'mask-border-source', '-webkit-mask-box-image-source'].some(
        (property) => !['', 'none'].includes(css.getPropertyValue(property)),
      ) ||
      !['', 'auto'].includes(css.getPropertyValue('clip'))
    )
      return true
    const clips =
      nativeControl ||
      /(auto|scroll|hidden|clip)/u.test(`${css.overflowX} ${css.overflowY}`) ||
      /(paint|strict|content)/u.test(css.contain) ||
      ['auto', 'hidden'].includes(css.getPropertyValue('content-visibility'))
    if (!clips) return false
    // Native unocclusion/intersection do not prove curved clipping. The whole
    // input must fit a guaranteed rectangular strip between every corner arc.
    const radius = (value: string, extent: number) =>
      value.endsWith('%')
        ? (Number.parseFloat(value) * extent) / 100
        : value.endsWith('px') || value === '0'
          ? Number.parseFloat(value)
          : NaN
    const corners = [
      'border-top-left-radius',
      'border-top-right-radius',
      'border-bottom-left-radius',
      'border-bottom-right-radius',
    ].map((property) => {
      const [x = '0px', y = x] = css
        .getPropertyValue(property)
        .trim()
        .split(/\s+/u)
      return [radius(x, box.width), radius(y, box.height)]
    })
    if (
      corners.some((pair) =>
        pair.some((value) => !Number.isFinite(value) || value < 0),
      )
    )
      return true
    const x = Math.max(...corners.map((pair) => pair[0]))
    const y = Math.max(...corners.map((pair) => pair[1]))
    return !(
      (nativeBox.left >= box.left + x && nativeBox.right <= box.right - x) ||
      (nativeBox.top >= box.top + y && nativeBox.bottom <= box.bottom - y)
    )
  }
  const style = view.getComputedStyle(textarea)
  if (
    uncertainClip(style, nativeBox, true) ||
    style.writingMode !== 'horizontal-tb' ||
    style.direction !== 'ltr' ||
    style.display === 'none' ||
    style.visibility !== 'visible' ||
    Number(style.opacity) === 0 ||
    style.transform !== 'none' ||
    textarea.wrap === 'off' ||
    textarea.clientWidth <= 0 ||
    textarea.clientHeight <= 0
  )
    return null
  const mirror = document.createElement('div')
  measurementNodes.add(mirror)
  mirror.setAttribute('aria-hidden', 'true')
  mirror.inert = true
  // Copy the actual text layout, including wrapping, spacing and native padding.
  for (const property of [
    'font-family',
    'font-size',
    'font-weight',
    'font-style',
    'font-stretch',
    'font-variant',
    'font-kerning',
    'font-feature-settings',
    'font-variation-settings',
    'line-height',
    'letter-spacing',
    'word-spacing',
    'text-indent',
    'text-transform',
    'text-align',
    'tab-size',
    'white-space',
    'word-break',
    'overflow-wrap',
    'padding-top',
    'padding-right',
    'padding-bottom',
    'padding-left',
  ])
    mirror.style.setProperty(property, style.getPropertyValue(property))
  Object.assign(mirror.style, {
    position: 'fixed',
    left: '0',
    top: '0',
    visibility: 'hidden',
    pointerEvents: 'none',
    boxSizing: 'border-box',
    border: '0',
    margin: '0',
    // clientWidth is integer-rounded; retain the native fractional content width.
    width: `${nativeBox.width - textarea.offsetWidth + textarea.clientWidth}px`,
    height: 'auto',
    minHeight: '0',
    maxHeight: 'none',
    overflow: 'hidden',
    direction: 'ltr',
  })
  const text = document.createTextNode(`${textarea.value}\u200b`)
  mirror.append(text)
  // Initialize the native fixed-point line strut before the first layout. A
  // block strut rounds at the opposite boundary from a native text control.
  const lineHeight = Number.parseFloat(style.lineHeight)
  if (Number.isFinite(lineHeight))
    mirror.style.lineHeight = `${(Math.floor(lineHeight * 64) - 0.5) / 64}px`
  document.body.append(mirror)
  try {
    const agreesWithNative = () =>
      Math.abs(
        textarea.scrollHeight -
          Math.max(textarea.clientHeight, mirror.scrollHeight),
      ) <= 1 &&
      Math.abs(
        textarea.scrollWidth -
          Math.max(textarea.clientWidth, mirror.scrollWidth),
      ) <= 1
    if (!agreesWithNative()) return null
    const origin = mirror.getBoundingClientRect()
    const range = document.createRange()
    range.setStart(text, selection.start)
    range.setEnd(text, selection.end)
    const rects = Array.from(range.getClientRects())
    if (!rects.length || rects.some((rect) => rect.height <= 0)) return null
    let top = Infinity
    let bottom = -Infinity
    let left = Infinity
    let right = -Infinity
    for (const rect of rects) {
      top = Math.min(top, rect.top - origin.top)
      bottom = Math.max(bottom, rect.bottom - origin.top)
      left = Math.min(left, rect.left - origin.left)
      right = Math.max(right, rect.right - origin.left)
    }
    const box = textarea.getBoundingClientRect()
    // Transformed ancestors/zoom need a different coordinate mapping; fail closed.
    if (
      Math.abs(box.width - textarea.offsetWidth) > 1 ||
      Math.abs(box.height - textarea.offsetHeight) > 1
    )
      return null
    const x = box.left + textarea.clientLeft
    const y = box.top + textarea.clientTop
    const target = {
      top: y + top - textarea.scrollTop,
      bottom: y + bottom - textarea.scrollTop,
      left: x + left - textarea.scrollLeft,
      right: x + right - textarea.scrollLeft,
    }
    let clipTop = Math.max(y, view.visualViewport?.offsetTop ?? 0)
    let clipLeft = Math.max(x, view.visualViewport?.offsetLeft ?? 0)
    let clipBottom = Math.min(
      y + textarea.clientHeight,
      (view.visualViewport?.offsetTop ?? 0) +
        (view.visualViewport?.height ?? view.innerHeight),
    )
    let clipRight = Math.min(
      x + textarea.clientWidth,
      (view.visualViewport?.offsetLeft ?? 0) +
        (view.visualViewport?.width ?? view.innerWidth),
    )
    for (
      let parent = textarea.parentElement;
      parent;
      parent = parent.parentElement
    ) {
      const css = view.getComputedStyle(parent)
      const rect = parent.getBoundingClientRect()
      if (
        uncertainClip(css, rect) ||
        css.transform !== 'none' ||
        css.visibility !== 'visible' ||
        Number(css.opacity) === 0
      )
        return null
      if (/(auto|scroll|hidden|clip)/u.test(css.overflowY)) {
        clipTop = Math.max(clipTop, rect.top + parent.clientTop)
        clipBottom = Math.min(
          clipBottom,
          rect.top + parent.clientTop + parent.clientHeight,
        )
      }
      if (/(auto|scroll|hidden|clip)/u.test(css.overflowX)) {
        clipLeft = Math.max(clipLeft, rect.left + parent.clientLeft)
        clipRight = Math.min(
          clipRight,
          rect.left + parent.clientLeft + parent.clientWidth,
        )
      }
    }
    const inside =
      target.top >= clipTop &&
      target.bottom <= clipBottom &&
      target.left >= clipLeft &&
      target.right <= clipRight
    const regions = rects.map((rect) => ({
      top: y + rect.top - origin.top - textarea.scrollTop,
      bottom: y + rect.bottom - origin.top - textarea.scrollTop,
      left: x + rect.left - origin.left - textarea.scrollLeft,
      right: x + rect.right - origin.left - textarea.scrollLeft,
    }))
    return {
      top,
      bottom,
      left,
      right,
      visible: inside,
      regions,
      nativeBounds: {
        left: box.left,
        top: box.top,
        width: box.width,
        height: box.height,
      },
      fingerprint: JSON.stringify([
        regions,
        target,
        textarea.scrollTop,
        textarea.scrollLeft,
        box.width,
        box.height,
      ]),
    }
  } finally {
    mirror.remove()
  }
}
