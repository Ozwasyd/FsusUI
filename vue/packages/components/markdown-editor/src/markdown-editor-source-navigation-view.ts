import type {
  MarkdownEditorSession,
  MarkdownEditorSessionDocumentState,
} from './markdown-editor-session'
import type { MarkdownEditorResolvedSelection } from './markdown-editor-transaction'

/** Original mounted source owner only; not a checkpoint acquisition or navigation admission. */
export interface MarkdownEditorSourceNavigationViewOptions {
  readonly session: MarkdownEditorSession
  readonly expected: MarkdownEditorSessionDocumentState
  readonly signal: AbortSignal
  /** Synchronous; its original thrown value is propagated unchanged. */
  readonly assertAdmission: () => void
}

/** Nontransferable observation. Copies and observations from another instance are not current. */
export interface MarkdownEditorSourceNavigationView extends MarkdownEditorSessionDocumentState {
  readonly editorSessionRef: string
  readonly viewGeneration: number
  readonly selection: MarkdownEditorResolvedSelection
  readonly focusOffset: number
  readonly affinity: 'before' | 'after'
  /** Focus endpoint block-start minus usable source viewport block-start, in CSS pixels; may be negative. */
  readonly viewportOffset: number
  /** Actual scrollTop / (scrollHeight - clientHeight); zero only for a real zero-range or top position. */
  readonly percentage: number
  readonly viewport: Readonly<{
    readonly blockStart: number
    readonly height: number
    readonly reducedMotion: boolean
  }>
}

/** Actual trusted source input, not inferred from scroll and never an automatic resume notification. */
export interface MarkdownEditorSourceNavigationGesture extends MarkdownEditorSessionDocumentState {
  readonly viewGeneration: number
  readonly gesture: 'wheel' | 'touch' | 'pointer' | 'keyboard'
}

import {
  measureMarkdownEditorReveal,
  prepareMarkdownEditorRevealTextLayout,
} from './markdown-editor-reveal-completion'
import type { MarkdownEditorRevealTextLayout } from './markdown-editor-reveal-completion'
import { resolveMarkdownEditorFocusEndpoint } from './markdown-editor-live-layout'

interface NativeViewContext extends MarkdownEditorSessionDocumentState {
  readonly session: MarkdownEditorSession | null
  readonly root: HTMLElement
  readonly textarea: HTMLTextAreaElement
  readonly selection: MarkdownEditorResolvedSelection
  readonly source: string
  readonly nativeGeneration: number
  readonly mode: string
}

/** One mounted component's layout custody. No document, session or History registry. */
export const createMarkdownEditorSourceNavigationViewOwner = (owner: {
  readNative(): NativeViewContext | null
  requestFrame(run: () => void): number | undefined
  cancelFrame(frame: number): void
  bind(
    target: EventTarget,
    events: Readonly<Record<string, (event: Event) => unknown>>,
  ): () => void
  notify(event: MarkdownEditorSourceNavigationGesture): void
}) => {
  let generation = 0
  let layout: MarkdownEditorRevealTextLayout | null = null
  let frame: number | undefined
  let root: HTMLElement | null = null
  let mountedDocument: Document | null = null
  let lastPhysical: string | null = null
  let media: MediaQueryList | null = null
  let releases: Array<() => void> = []
  let disposed = false
  const issued = new WeakMap<
    MarkdownEditorSourceNavigationView,
    {
      options: MarkdownEditorSourceNavigationViewOptions
      generation: number
      fingerprint: string
    }
  >()
  const invalidate = () => {
    generation += 1
  }
  const prepare = () => {
    frame = undefined
    const context = owner.readNative()
    layout?.dispose()
    layout = context
      ? prepareMarkdownEditorRevealTextLayout(context.textarea)
      : null
  }
  const refresh = () => {
    invalidate()
    // An original document/lifecycle lease can suppress the old callback. Do
    // not let its undelivered handle starve preparation for the current native view.
    if (frame !== undefined) owner.cancelFrame(frame)
    frame = undefined
    if (!disposed) frame = owner.requestFrame(prepare)
  }
  const pause = () => {
    invalidate()
    if (frame !== undefined) owner.cancelFrame(frame)
    frame = undefined
    for (const release of releases) release()
    releases = []
    media = null
    root = null
    mountedDocument = null
    layout?.dispose()
    layout = null
  }
  const mount = () => {
    if (disposed) return
    const context = owner.readNative()
    if (!context) {
      pause()
      return
    }
    if (
      root === context.root &&
      layout?.textarea === context.textarea &&
      mountedDocument === context.textarea.ownerDocument
    ) {
      refresh()
      return
    }
    pause()
    root = context.root
    const document = context.textarea.ownerDocument
    mountedDocument = document
    const view = document.defaultView
    if (!view || typeof view.matchMedia !== 'function') return
    media = view.matchMedia('(prefers-reduced-motion: reduce)')
    releases.push(owner.bind(media, { change: refresh }))
    if (document.fonts)
      releases.push(
        owner.bind(document.fonts, {
          loading: refresh,
          loadingdone: refresh,
          loadingerror: refresh,
        }),
      )
    releases.push(owner.bind(document, { visibilitychange: refresh }))
    refresh()
  }
  const unavailable = () => {
    if (lastPhysical !== null) {
      lastPhysical = null
      invalidate()
    }
    return null
  }
  const snapshot = (options: MarkdownEditorSourceNavigationViewOptions) => {
    const context = owner.readNative()
    if (disposed || !context || !layout || !media) return unavailable()
    if (
      context.session !== options.session ||
      context.documentIdentity.id !== options.expected.documentIdentity.id ||
      context.documentIdentity.epoch !==
        options.expected.documentIdentity.epoch ||
      context.revision !== options.expected.revision
    )
      return null
    const { textarea, selection } = context
    if (
      textarea.ownerDocument !== mountedDocument ||
      context.root.getRootNode() !== mountedDocument
    )
      return unavailable()
    if (
      textarea.value !== context.source ||
      textarea.selectionStart !== selection.start ||
      textarea.selectionEnd !== selection.end ||
      textarea.selectionDirection !== selection.direction ||
      textarea.ownerDocument.visibilityState !== 'visible' ||
      textarea.ownerDocument.fonts?.status !== 'loaded'
    )
      return unavailable()
    const focus = resolveMarkdownEditorFocusEndpoint(selection)
    const endpoint = measureMarkdownEditorReveal(
      textarea,
      {
        start: focus.offset,
        end: focus.offset,
        direction: selection.direction,
      },
      layout,
    )
    if (
      !endpoint ||
      endpoint.regions.some((region) => region.top !== endpoint.regions[0].top)
    )
      return unavailable()
    const measured = endpoint
    const height = measured.viewport.bottom - measured.viewport.top
    const range = textarea.scrollHeight - textarea.clientHeight
    const top = textarea.scrollTop
    if (
      !Number.isFinite(height) ||
      height <= 0 ||
      measured.viewport.right <= measured.viewport.left ||
      !Number.isFinite(range) ||
      range < 0 ||
      !Number.isFinite(top) ||
      top < 0 ||
      top > range ||
      typeof media.matches !== 'boolean'
    )
      return unavailable()
    const viewportOffset = endpoint.regions[0].top - measured.viewport.top
    if (!Number.isFinite(viewportOffset)) return unavailable()
    const selectionCopy = Object.freeze({
      start: selection.start,
      end: selection.end,
      direction: selection.direction,
    })
    const state = {
      editorSessionRef: options.session.editorSessionRef,
      documentIdentity: Object.freeze({
        id: context.documentIdentity.id,
        epoch: context.documentIdentity.epoch,
      }),
      revision: context.revision,
      viewGeneration: generation,
      selection: selectionCopy,
      focusOffset: focus.offset,
      affinity: focus.affinity,
      viewportOffset,
      percentage: range === 0 ? 0 : top / range,
      viewport: Object.freeze({
        blockStart: measured.viewport.top,
        height,
        reducedMotion: media.matches,
      }),
    }
    const physical = JSON.stringify([
      { ...state, viewGeneration: undefined },
      context.nativeGeneration,
      context.mode,
      measured.fingerprint,
      endpoint.fingerprint,
      textarea.scrollHeight,
      textarea.clientHeight,
      layout.key,
    ])
    if (physical !== lastPhysical) {
      lastPhysical = physical
      invalidate()
    }
    state.viewGeneration = generation
    return { state, fingerprint: JSON.stringify([physical, generation]) }
  }
  const admit = (options: MarkdownEditorSourceNavigationViewOptions) => {
    AbortSignal.prototype.throwIfAborted.call(options.signal)
    options.assertAdmission()
    AbortSignal.prototype.throwIfAborted.call(options.signal)
  }
  const read = (
    options: MarkdownEditorSourceNavigationViewOptions,
  ): MarkdownEditorSourceNavigationView | null => {
    const bound = Object.freeze({
      session: options.session,
      signal: options.signal,
      assertAdmission: options.assertAdmission,
      expected: Object.freeze({
        documentIdentity: Object.freeze({
          ...options.expected.documentIdentity,
        }),
        revision: options.expected.revision,
      }),
    })
    admit(bound)
    const before = snapshot(bound)
    admit(bound)
    const after = snapshot(bound)
    if (!before || !after || before.fingerprint !== after.fingerprint)
      return null
    const view = Object.freeze(after.state)
    issued.set(view, {
      options: bound,
      generation,
      fingerprint: after.fingerprint,
    })
    return view
  }
  const current = (view: MarkdownEditorSourceNavigationView): boolean => {
    const record = issued.get(view)
    if (!record) return false
    admit(record.options)
    const before = snapshot(record.options)
    admit(record.options)
    const after = snapshot(record.options)
    return (
      !!before &&
      !!after &&
      generation === record.generation &&
      before.fingerprint === record.fingerprint &&
      after.fingerprint === record.fingerprint
    )
  }
  const gesture = (
    event: Event | undefined,
    kind: MarkdownEditorSourceNavigationGesture['gesture'],
  ) => {
    if (!event?.isTrusted) return
    const context = owner.readNative()
    if (!context || event.target !== context.textarea) return
    refresh()
    owner.notify(
      Object.freeze({
        gesture: kind,
        viewGeneration: generation,
        documentIdentity: Object.freeze({ ...context.documentIdentity }),
        revision: context.revision,
      }),
    )
  }
  return Object.freeze({
    read,
    current,
    mount,
    refresh,
    invalidate,
    gesture,
    pause,
    dispose() {
      pause()
      disposed = true
    },
    inspect: () => ({
      memoryUnits: layout
        ? Math.ceil(
            ((layout.text.length + layout.key.length + layout.cssText.length) *
              2) /
              65536,
          )
        : 0,
    }),
  })
}
