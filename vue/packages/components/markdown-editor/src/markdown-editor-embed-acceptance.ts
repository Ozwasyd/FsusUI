import {
  evaluateMarkdownEmbedPresentationMutations,
  type MarkdownEmbedResult,
  type MarkdownStableProjection,
} from '../../../wasm/markdown-runtime'
import {
  createMarkdownEditorProjection,
  stabilizeMarkdownEditorProjection,
  type MarkdownDocumentIdentity,
} from '../../../wasm/markdown-runtime'
import {
  planMarkdownEmbedSurface,
  resolveMarkdownEmbedAtomic,
  resolveMarkdownEmbedHeight,
  resolveMarkdownEmbedSurface,
} from './markdown-editor-embed-surface'
import {
  MARKDOWN_EMBED_PRESENTATION_MODES,
} from '../../../wasm/markdown-runtime'
import { MarkdownEditorTransactionStore } from './markdown-editor-transaction'

export const MARKDOWN_EMBED_EDITOR_ACCEPTANCE_VERSION =
  'markdown-embed-editor-acceptance@2026-08-28'

/**
 * Local simulation of browser-only viewport/zoom/soft-keyboard matrices per
 * the runtime environment constraint: 375/1440 layouts are represented by
 * the single-column, no-nested-scroll presentation contract, zoom and soft
 * keyboard reuse the shared #336 triggers, and screen reader semantics are
 * the frozen a11y contract instead of a live AT session.
 */
export interface MarkdownEmbedEditorAcceptanceLeftover {
  readonly liveAssistiveTechnology: false
  readonly liveDeviceMatrix: false
  readonly simulatedLocally: true
}

export interface MarkdownEmbedEditorAcceptanceReport {
  readonly accepted: boolean
  readonly atomicConsistent: boolean
  readonly hostSourceUnchanged: boolean
  readonly leftover: MarkdownEmbedEditorAcceptanceLeftover
  readonly modeSurfaces: boolean
  readonly mutationsRejected: boolean
  readonly staleResultStable: boolean
  readonly unsafeOutputExposed: boolean
  readonly version: typeof MARKDOWN_EMBED_EDITOR_ACCEPTANCE_VERSION
}

const IDENTITY: MarkdownDocumentIdentity = Object.freeze({
  epoch: 1,
  id: 'embed-acceptance',
})

const DIRECTIVE = '::embed[target="acceptance-note" mode="article"]'
const SOURCE = `intro\n\n${DIRECTIVE}\n\ntail\n`

const projectionOf = (source: string): MarkdownStableProjection =>
  stabilizeMarkdownEditorProjection(
    createMarkdownEditorProjection(source),
    IDENTITY,
  )

const embedNodeOf = (source: string) => {
  const node = projectionOf(source).nodes.find((item) => item.kind === 'embed')
  if (!node) throw new Error('projection did not emit an embed node')
  return node
}

const selectionAt = (offset: number) =>
  ({ direction: 'none' as const, end: offset, start: offset })

const resolvedResult = (nodeId: string): MarkdownEmbedResult => ({
  requestId: `${IDENTITY.id}:1:${nodeId}:1`,
  status: 'resolved',
  target: 'acceptance-note',
  mode: 'article',
  version: 1,
  documentIdentity: IDENTITY,
  revision: 1,
  nodeId,
  title: '<img src=x onerror=alert(1)>',
  excerpt: '<script>alert(2)</script><form><input name="target"></form>',
})

const coverModeSurfaces = (node: ReturnType<typeof embedNodeOf>) =>
  MARKDOWN_EMBED_PRESENTATION_MODES.every((mode) => {
    const surface = resolveMarkdownEmbedSurface({
      mode,
      node,
      source: SOURCE,
    })
    if (mode === 'source') {
      return (
        surface.directiveVisible &&
        !surface.contentVisible &&
        surface.presentation.directive === DIRECTIVE
      )
    }
    return (
      !surface.directiveVisible &&
      surface.contentVisible &&
      surface.presentation.content.html === null &&
      surface.presentation.content.editable === false
    )
  })

const coverAtomic = (node: ReturnType<typeof embedNodeOf>) => {
  const store = new MarkdownEditorTransactionStore(SOURCE, selectionAt(0))
  const before = resolveMarkdownEmbedAtomic({
    action: 'caret-before',
    documentIdentity: IDENTITY,
    nodeId: node.id,
    revision: store.revision,
    selection: selectionAt(node.rawRange.start),
    source: store.value,
  })
  const after = resolveMarkdownEmbedAtomic({
    action: 'caret-after',
    documentIdentity: IDENTITY,
    nodeId: node.id,
    revision: store.revision,
    selection: selectionAt(node.rawRange.end),
    source: store.value,
  })
  const copyVisible = resolveMarkdownEmbedAtomic({
    action: 'copy-visible',
    documentIdentity: IDENTITY,
    nodeId: node.id,
    revision: store.revision,
    selection: selectionAt(node.rawRange.start),
    source: store.value,
  })
  const copyExact = resolveMarkdownEmbedAtomic({
    action: 'copy-source',
    documentIdentity: IDENTITY,
    nodeId: node.id,
    revision: store.revision,
    selection: selectionAt(node.rawRange.start),
    source: store.value,
  })
  const deleted = resolveMarkdownEmbedAtomic({
    action: 'delete',
    documentIdentity: IDENTITY,
    nodeId: node.id,
    revision: store.revision,
    selection: store.selection,
    source: store.value,
  })
  store.dispatch(deleted.transaction!)
  const hostSourceUnchanged = store.value === 'intro\n\n\ntail\n'
  store.undo()
  return {
    atomicConsistent:
      Boolean(before.transaction) &&
      Boolean(after.transaction) &&
      copyVisible.copy !== null &&
      copyExact.copy !== null &&
      before.accessibility.tabStop === false &&
      after.accessibility.tabStop === false,
    hostSourceUnchanged,
    undone: store.value === SOURCE,
  }
}

const coverStale = (node: ReturnType<typeof embedNodeOf>) => {
  const current = resolveMarkdownEmbedSurface({
    mode: 'live',
    node,
    result: resolvedResult(node.id),
    source: SOURCE,
  })
  const stale = resolveMarkdownEmbedSurface({
    mode: 'live',
    node,
    result: { ...resolvedResult(node.id), status: 'stale' as const },
    source: SOURCE,
  })
  const heightStable = resolveMarkdownEmbedHeight({
    documentIdentity: IDENTITY,
    previousAnchor: null,
    revision: 1,
    selection: selectionAt(8),
    source: SOURCE,
  })
  const heightYielded = resolveMarkdownEmbedHeight({
    documentIdentity: IDENTITY,
    gesture: 'wheel',
    revision: 1,
    selection: selectionAt(8),
    source: SOURCE,
  })
  return {
    caretStable: heightStable.scrollIntoView === false,
    gestureYields: heightYielded.action === 'yield',
    staleStable:
      current.presentation.state === 'resolved' &&
      stale.presentation.state === 'stale' &&
      stale.presentation.content.title === null &&
      stale.presentation.directive === current.presentation.directive,
  }
}

const coverUnsafe = (node: ReturnType<typeof embedNodeOf>) => {
  const surface = planMarkdownEmbedSurface({
    documentIdentity: IDENTITY,
    mode: 'live',
    node,
    result: resolvedResult(node.id),
    revision: 1,
    selection: selectionAt(8),
    source: SOURCE,
  })
  const presentation = surface.surface.presentation
  return {
    exposed:
      presentation.content.html !== null ||
      presentation.content.editable !== false ||
      presentation.layout.surface !== 'controlled-markdown',
    singleColumn:
      presentation.layout.columns === 1 &&
      presentation.layout.nestedScroll === 'none' &&
      presentation.layout.modeAsVisualVariant === false,
  }
}

export const evaluateMarkdownEmbedEditorAcceptance = (): MarkdownEmbedEditorAcceptanceReport => {
  const node = embedNodeOf(SOURCE)
  const atomic = coverAtomic(node)
  const stale = coverStale(node)
  const unsafe = coverUnsafe(node)
  const mutations = evaluateMarkdownEmbedPresentationMutations()
  const mutationsRejected = mutations.mutations.every(
    (mutation) => mutation.accepted === false && mutation.equivalent === false,
  )
  const report: MarkdownEmbedEditorAcceptanceReport = Object.freeze({
    accepted:
      coverModeSurfaces(node) &&
      atomic.atomicConsistent &&
      atomic.hostSourceUnchanged &&
      atomic.undone &&
      stale.staleStable &&
      stale.caretStable &&
      stale.gestureYields &&
      !unsafe.exposed &&
      unsafe.singleColumn &&
      mutationsRejected,
    atomicConsistent: atomic.atomicConsistent && atomic.undone,
    hostSourceUnchanged: atomic.hostSourceUnchanged,
    leftover: Object.freeze({
      liveAssistiveTechnology: false,
      liveDeviceMatrix: false,
      simulatedLocally: true,
    }),
    modeSurfaces: coverModeSurfaces(node),
    mutationsRejected,
    staleResultStable: stale.staleStable && stale.caretStable && stale.gestureYields,
    unsafeOutputExposed: unsafe.exposed,
    version: MARKDOWN_EMBED_EDITOR_ACCEPTANCE_VERSION,
  })
  return report
}
