import type {
  MarkdownEditorSession,
  MarkdownEditorSessionDocumentState,
} from './markdown-editor-session'
import type { MarkdownEditorResolvedSelection } from './markdown-editor-transaction'

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
  constructor(
    readonly reason: MarkdownEditorRevealFailureReason,
    cause?: unknown,
  ) {
    super(`markdown-editor-reveal-${reason}`, { cause })
    this.name = 'MarkdownEditorRevealError'
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
  const style = view.getComputedStyle(textarea)
  if (
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
    width: `${textarea.clientWidth}px`,
    height: 'auto',
    minHeight: '0',
    maxHeight: 'none',
    overflow: 'hidden',
    direction: 'ltr',
  })
  const text = document.createTextNode(`${textarea.value}\u200b`)
  mirror.append(text)
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
    if (!agreesWithNative()) {
      // Native text controls quantize fractional line boxes to layout units.
      // Keep the native extent fence: this is never a relaxed success threshold.
      const lineHeight = Number.parseFloat(style.lineHeight)
      if (!Number.isFinite(lineHeight)) return null
      mirror.style.lineHeight = `${Math.floor(lineHeight * 64) / 64}px`
      if (!agreesWithNative()) return null
    }
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
      if (
        css.transform !== 'none' ||
        css.visibility !== 'visible' ||
        Number(css.opacity) === 0
      )
        return null
      const rect = parent.getBoundingClientRect()
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
    const unobscured =
      inside &&
      [
        [target.left, target.top],
        [target.right, target.bottom],
        [(target.left + target.right) / 2, (target.top + target.bottom) / 2],
      ].every(([px, py]) => document.elementFromPoint(px!, py!) === textarea)
    return {
      top,
      bottom,
      left,
      right,
      visible: unobscured,
      fingerprint: JSON.stringify([
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
