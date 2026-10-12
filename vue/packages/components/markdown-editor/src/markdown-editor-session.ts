import { createMarkdownEditorSessionResourceCoordinator } from './markdown-editor-session-resources'
import { MarkdownEditorTransactionStore } from './markdown-editor-transaction'
import type { MarkdownEditorSessionPanelCapture, MarkdownEditorSessionPanelRefs, MarkdownEditorSessionPanelState } from './markdown-editor-session-panels'
import type { MarkdownEditorSessionResourceCensus, MarkdownEditorSessionResourceParticipant } from './markdown-editor-session-resources'
import type { MarkdownRendererCheckpointHandle } from '../../markdown-renderer/src/markdown-renderer-session-resources'
import type {
  MarkdownHeavyFeatureDocumentAuthority,
  MarkdownHeavyFeatureDocumentAuthorityTicket,
  MarkdownHeavyFeatureDocumentAuthorityRetirementHandle,
} from '../../../hooks/use-markdown-heavy-feature-lifecycle'
import type {
  MarkdownEditorDocumentIdentity,
  MarkdownEditorHistoryState,
  MarkdownEditorResolvedSelection,
  MarkdownEditorRetainedTransactionSnapshot,
  MarkdownEditorRetainedTransactionPreparation,
} from './markdown-editor-transaction'

export interface MarkdownEditorSessionResourceUsage {
  readonly editorInstances: number
  readonly renderers: number
  readonly observers: number
  readonly timers: number
  readonly backgroundTasks: number
  readonly networkRequests: number
  readonly memoryUnits: number
}

/** Ref into the actual mounted full-document renderer, never synthesized. */
export interface MarkdownEditorSessionLastValidRender {
  readonly ref: string
  readonly documentIdentity: MarkdownEditorDocumentIdentity
  readonly revision: number
}

/** Retained in the mounted editor; not a serializable eviction checkpoint. */
export interface MarkdownEditorSessionSnapshot {
  readonly schema: 'fsusui.markdown-editor-retained-session.v1'
  readonly snapshotRef: string
  readonly editorSessionRef: string
  readonly documentIdentity: MarkdownEditorDocumentIdentity
  readonly revision: number
  readonly history: MarkdownEditorHistoryState
  readonly selection: MarkdownEditorResolvedSelection
  readonly editorContentDigest: string
  readonly selectionRef: string
  readonly historyRef: string
  readonly viewStateRef: string
  readonly lastValidRender: MarkdownEditorSessionLastValidRender | null
  readonly panelRefs: MarkdownEditorSessionPanelRefs | null
}

/** One original owner's uncommitted candidate; metadata alone cannot publish it. */
export interface MarkdownEditorSessionPreparedSnapshot {
  readonly snapshot: MarkdownEditorSessionSnapshot
}

/** Original native candidate sealed after allocation/admission; not a full-host authority token. */
export interface MarkdownEditorSessionSnapshotPublication {
  readonly snapshot: MarkdownEditorSessionSnapshot
  readonly scope: 'native-owner-custody'
}

export interface MarkdownEditorSessionCapabilities {
  readonly snapshot: 'retained'
  readonly restoration: 'same-owner-same-revision'
  readonly resources: 'available' | 'unavailable'
  readonly eviction: 'unavailable'
  readonly missingOwners: readonly string[]
}

export interface MarkdownEditorSessionRestoreProof {
  readonly status: 'restored' | 'blocked'
  readonly snapshotRef: string
  readonly reason: string | null
}

export interface MarkdownEditorSessionRenderRestoreProof {
  readonly ref: string
  readonly status: 'restored' | 'blocked'
  readonly reason: string | null
}

export interface MarkdownEditorSessionDocumentState {
  readonly documentIdentity: MarkdownEditorDocumentIdentity
  readonly revision: number
}

export interface MarkdownEditorSessionContentDigest extends MarkdownEditorSessionDocumentState {
  readonly editorContentDigest: string
}

/** Scalar observations only; unknown owners never become aggregate resource usage. */
export interface MarkdownEditorSessionRendererResourceSource {
  readonly complete: false
  readonly measuredUsageOnly: true
  readonly sourceReview: 'unqualified'
  readonly missingSourceDependencies: readonly string[]
  readonly measuredUsage: Omit<MarkdownEditorSessionResourceUsage, 'networkRequests'>
  readonly measuredNetworkRequests: number | null
  readonly retainedListeners: number
  readonly pendingRenderAdmissions: number
  readonly pendingControlTransitions: number
  readonly unknownUsage: {
    readonly timers: string | null
    readonly networkRequests: string | null
    readonly workerInternals: readonly string[]
    readonly poolAttribution: readonly string[]
  }
}

/** The sole attachment/embed owner's observations, excluding opaque consumer resources. */
export interface MarkdownEditorSessionAttachmentResourceSource {
  readonly complete: false
  readonly measuredUsageOnly: true
  readonly sourceReview: 'unqualified'
  readonly missingSourceDependencies: readonly string[]
  readonly measuredUsage: Omit<MarkdownEditorSessionResourceUsage, 'networkRequests'>
  readonly measuredNetworkRequests: null
  readonly retainedListeners: number
  readonly unknownUsage: readonly string[]
}

/** The original native producer types; no alternate ticket or retirement realm. */
export type MarkdownEditorSessionDocumentAuthority = MarkdownHeavyFeatureDocumentAuthority
export type MarkdownEditorSessionDocumentAuthorityTicket = MarkdownHeavyFeatureDocumentAuthorityTicket
export type MarkdownEditorSessionDocumentAuthorityRetirementHandle = MarkdownHeavyFeatureDocumentAuthorityRetirementHandle

export interface MarkdownEditorSession {
  readonly editorSessionRef: string
  /** Exact original heavy-feature authority; absent owners refuse with null. */
  readonly documentAuthority: MarkdownEditorSessionDocumentAuthority | null
  inspectCapabilities(): MarkdownEditorSessionCapabilities
  inspectDocumentState(): MarkdownEditorSessionDocumentState
  /** Read the original body only inside the digest callback; no checkpoint/history mutation. */
  inspectContentDigest(digestSource: (source: string) => string, expected?: {
    readonly documentIdentity: MarkdownEditorDocumentIdentity
    readonly revision: number
    readonly assertAdmission?: () => void
  }): MarkdownEditorSessionContentDigest
  inspectResourceParticipants(): MarkdownEditorSessionResourceCensus
  inspectRendererResourceSource(): MarkdownEditorSessionRendererResourceSource | null
  /** Exact original renderer methods/tokens; an unassembled owner returns null. */
  getRendererCheckpointHandle(): MarkdownRendererCheckpointHandle | null
  inspectAttachmentResourceSource(): MarkdownEditorSessionAttachmentResourceSource | null
  captureLastValidRender(): MarkdownEditorSessionLastValidRender | null
  restoreLastValidRender(render: MarkdownEditorSessionLastValidRender, expected: {
    readonly documentIdentity: MarkdownEditorDocumentIdentity
    readonly revision: number
  }): Promise<MarkdownEditorSessionRenderRestoreProof>
  captureSnapshot(digestSource: (source: string) => string, expected?: {
    readonly documentIdentity: MarkdownEditorDocumentIdentity
    readonly revision: number
    readonly assertAdmission?: () => void
  }): MarkdownEditorSessionSnapshot
  prepareSnapshot(digestSource: (source: string) => string, expected?: {
    readonly documentIdentity: MarkdownEditorDocumentIdentity
    readonly revision: number
    readonly assertAdmission?: () => void
  }): MarkdownEditorSessionPreparedSnapshot
  commitPreparedSnapshot(preparation: MarkdownEditorSessionPreparedSnapshot, assertAdmission?: () => void): MarkdownEditorSessionSnapshot
  sealPreparedSnapshot(preparation: MarkdownEditorSessionPreparedSnapshot, assertAdmission?: () => void): MarkdownEditorSessionSnapshotPublication
  /** Private original native continuity only; no external owner/source/lifetime callbacks. */
  hasSealedSnapshotCustody(publication: MarkdownEditorSessionSnapshotPublication): boolean
  /** Same published pointer/private generation only; no availability/view/source readers. */
  hasRetainedSnapshotCustody(snapshot: MarkdownEditorSessionSnapshot): boolean
  publishSealedSnapshot(publication: MarkdownEditorSessionSnapshotPublication): MarkdownEditorSessionSnapshot | null
  /** Cancels only this exact candidate, including after owner retirement; never releases the old snapshot. */
  discardPreparedSnapshot(preparation: MarkdownEditorSessionPreparedSnapshot): boolean
  /** Read-only original token/document custody check; does not restore, capture or certify resources. */
  validateRetainedSnapshot(snapshot: MarkdownEditorSessionSnapshot, expected: {
    readonly documentIdentity: MarkdownEditorDocumentIdentity
    readonly revision: number
  }): boolean
  /** Resolve only the original current bounded panel custody; foreign/string-only/stale refs refuse. */
  readPanelState(snapshot: MarkdownEditorSessionSnapshot): MarkdownEditorSessionPanelState | null
  restoreSnapshot(
    snapshot: MarkdownEditorSessionSnapshot,
    expected: { readonly documentIdentity: MarkdownEditorDocumentIdentity; readonly revision: number; readonly assertAdmission?: () => void },
  ): MarkdownEditorSessionRestoreProof
  inspectResources(): MarkdownEditorSessionResourceUsage
  pauseResources(): MarkdownEditorSessionResourceUsage
  resumeResources(): MarkdownEditorSessionResourceUsage
  disposeAfterSnapshot(snapshotRef: string): void
}

export interface MarkdownEditorSessionExpose {
  getSession(editorSessionRef: string): MarkdownEditorSession
}

/** Internal binding, created once by the real MarkdownEditor setup. */
export interface MarkdownEditorSessionOwner<ViewState> {
  readonly transactionStore: MarkdownEditorTransactionStore
  readonly documentAuthority?: MarkdownEditorSessionDocumentAuthority
  readonly isComposing: () => boolean
  readonly isDisposed: () => boolean
  readonly captureViewState: () => ViewState
  readonly restoreViewState: (state: ViewState) => void
  readonly capturePanelState?: () => MarkdownEditorSessionPanelCapture | null
  readonly resourceParticipants: () => readonly MarkdownEditorSessionResourceParticipant[]
  readonly captureLastValidRender: () => MarkdownEditorSessionLastValidRender | null
  readonly inspectRendererResourceSource?: () => MarkdownEditorSessionRendererResourceSource | null
  readonly getRendererCheckpointHandle?: () => MarkdownRendererCheckpointHandle | null
  readonly inspectAttachmentResourceSource?: () => MarkdownEditorSessionAttachmentResourceSource | null
  readonly restoreLastValidRender?: (ref: string) => Promise<MarkdownEditorSessionRenderRestoreProof>
}

const capabilities: MarkdownEditorSessionCapabilities = Object.freeze({
  snapshot: 'retained',
  restoration: 'same-owner-same-revision',
  resources: 'unavailable',
  eviction: 'unavailable',
  missingOwners: Object.freeze([
    'renderer-projection-resource-census-and-pause-resume',
    'renderer-last-valid-render-checkpoint',
    'language-search-provider-resource-census-and-pause-resume',
    'attachment-embed-provider-resource-census-and-pause-resume',
    'frame-observer-viewport-resource-census-and-pause-resume',
    'recoverable-disposal-owner',
  ]),
})

export const createMarkdownEditorSessionBinding = <ViewState>(
  owner: MarkdownEditorSessionOwner<ViewState>,
): MarkdownEditorSessionExpose & {
  inspectRetainedPanelMemoryUnits(): number
  invalidatePublicationAuthority(): void
  retirePublicationAuthority(): void
} => {
  const transactionStore = owner.transactionStore
  const documentAuthority = owner.documentAuthority ?? null
  const readRendererCheckpointHandle = owner.getRendererCheckpointHandle?.bind(owner)
  // Pin the original producer implementation, not replaceable consumer methods.
  const validatePreparedTransaction = MarkdownEditorTransactionStore.prototype.validatePreparedRetainedSnapshot.bind(transactionStore)
  const publishPreparedTransaction = MarkdownEditorTransactionStore.prototype.commitPreparedRetainedSnapshot.bind(transactionStore)
  const validateRetainedTransaction = MarkdownEditorTransactionStore.prototype.validateRetainedSnapshot.bind(transactionStore)
  const resources = createMarkdownEditorSessionResourceCoordinator(owner.resourceParticipants)
  let session: MarkdownEditorSession | undefined
  let retained: {
    readonly snapshot: MarkdownEditorSessionSnapshot
    readonly transaction: MarkdownEditorRetainedTransactionSnapshot
    readonly view: ViewState
    readonly panels: MarkdownEditorSessionPanelCapture | null
  } | undefined
  let retainedGeneration: number | undefined
  let prepared: {
    readonly preparation: MarkdownEditorSessionPreparedSnapshot
    readonly transaction: MarkdownEditorRetainedTransactionPreparation
    readonly store: MarkdownEditorTransactionStore
    readonly next: NonNullable<typeof retained>
    readonly previous: typeof retained
    readonly assertAdmission: (() => void) | undefined
    readonly authorityGeneration: number
  } | undefined
  let sequence = 0
  let capturing = false
  let authorityGeneration = 0
  let authorityRetired = false
  let sealed: {
    readonly publication: MarkdownEditorSessionSnapshotPublication
    readonly candidate: NonNullable<typeof prepared>
    readonly generation: number
  } | undefined

  const invalidatePublicationAuthority = () => {
    sealed = undefined
    if (authorityGeneration === Number.MAX_SAFE_INTEGER) authorityRetired = true
    else authorityGeneration += 1
  }
  const hasSealedSnapshotCustody = (publication: MarkdownEditorSessionSnapshotPublication): boolean => {
    const custody = sealed
    return custody !== undefined && custody.publication === publication && !authorityRetired && !capturing &&
      custody.generation === authorityGeneration && prepared === custody.candidate &&
      retained === custody.candidate.previous && validatePreparedTransaction(custody.candidate.transaction)
  }

  const assertAvailable = () => {
    if (authorityRetired || owner.isDisposed()) throw new Error('editor-session-disposed')
    if (owner.isComposing()) throw new Error('editor-session-composition-active')
  }
  const captureLastValidRender = () => {
    assertAvailable()
    const render = owner.captureLastValidRender()
    const store = owner.transactionStore
    if (!render || !render.ref ||
      render.documentIdentity.id !== store.documentIdentity.id ||
      render.documentIdentity.epoch !== store.documentIdentity.epoch ||
      render.revision !== store.revision) return null
    return render
  }
  const inspectCapabilities = (): MarkdownEditorSessionCapabilities => {
    const census = resources.inspectParticipants()
    return Object.freeze({
      ...capabilities,
      resources: census.complete ? 'available' : 'unavailable',
      missingOwners: Object.freeze([
        ...census.missingOwners,
        ...(captureLastValidRender() ? [] : ['renderer-last-valid-render-checkpoint']),
        'recoverable-disposal-owner',
      ]),
    })
  }

  return Object.freeze({
    invalidatePublicationAuthority,
    retirePublicationAuthority: () => { authorityRetired = true; invalidatePublicationAuthority() },
    inspectRetainedPanelMemoryUnits: () => (retained?.panels?.memoryUnits ?? 0) + (prepared?.next.panels?.memoryUnits ?? 0),
    getSession(editorSessionRef: string) {
      assertAvailable()
      if (typeof editorSessionRef !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9._:-]{2,127}$/u.test(editorSessionRef)) {
        throw new Error('editor-session-ref-invalid')
      }
      if (session) {
        if (session.editorSessionRef !== editorSessionRef) {
          throw new Error('editor-session-owner-already-bound')
        }
        return session
      }
      session = Object.freeze({
        editorSessionRef,
        documentAuthority,
        inspectCapabilities,
        inspectDocumentState() {
          assertAvailable()
          const store = owner.transactionStore
          return Object.freeze({
            documentIdentity: Object.freeze({ ...store.documentIdentity }),
            revision: store.revision,
          })
        },
        inspectContentDigest(digestSource: (source: string) => string, expected?: {
          readonly documentIdentity: MarkdownEditorDocumentIdentity
          readonly revision: number
          readonly assertAdmission?: () => void
        }): MarkdownEditorSessionContentDigest {
          assertAvailable()
          if (capturing) throw new Error('editor-session-snapshot-reentrant')
          capturing = true
          try {
            const assertAdmission = expected?.assertAdmission
            assertAdmission?.()
            assertAvailable()
            const store = owner.transactionStore
            const identity = store.documentIdentity
            const revision = store.revision
            const source = store.value
            if (expected && (identity.id !== expected.documentIdentity.id || identity.epoch !== expected.documentIdentity.epoch ||
                revision !== expected.revision)) throw new Error('editor-session-content-context-mismatch')
            const digest = digestSource(source)
            if (typeof digest !== 'string') throw new Error('editor-session-content-digest-invalid')
            assertAdmission?.()
            assertAvailable()
            if (store.value !== source || store.revision !== revision || store.documentIdentity.id !== identity.id ||
                store.documentIdentity.epoch !== identity.epoch) throw new Error('editor-session-content-digest-stale')
            if (!/^[a-f0-9]{64}$/u.test(digest)) throw new Error('editor-session-content-digest-invalid')
            return Object.freeze({ documentIdentity: identity, revision, editorContentDigest: digest })
          } finally {
            capturing = false
          }
        },
        inspectResourceParticipants: () => { assertAvailable(); return resources.inspectParticipants() },
        getRendererCheckpointHandle() {
          assertAvailable()
          const id = transactionStore.documentIdentity.id
          const epoch = transactionStore.documentIdentity.epoch
          const revision = transactionStore.revision
          const handle = readRendererCheckpointHandle?.() ?? null
          assertAvailable()
          if (transactionStore.documentIdentity.id !== id || transactionStore.documentIdentity.epoch !== epoch ||
              transactionStore.revision !== revision)
            throw new Error('editor-session-renderer-checkpoint-handle-stale')
          return handle
        },
        inspectRendererResourceSource() {
          assertAvailable()
          const store = owner.transactionStore
          const id = store.documentIdentity.id
          const epoch = store.documentIdentity.epoch
          const revision = store.revision
          const source = owner.inspectRendererResourceSource?.() ?? null
          assertAvailable()
          if (store.documentIdentity.id !== id || store.documentIdentity.epoch !== epoch || store.revision !== revision)
            throw new Error('editor-session-renderer-resource-source-stale')
          return source
        },
        inspectAttachmentResourceSource() {
          assertAvailable()
          const store = owner.transactionStore
          const id = store.documentIdentity.id
          const epoch = store.documentIdentity.epoch
          const revision = store.revision
          const source = owner.inspectAttachmentResourceSource?.() ?? null
          assertAvailable()
          if (store.documentIdentity.id !== id || store.documentIdentity.epoch !== epoch || store.revision !== revision)
            throw new Error('editor-session-attachment-resource-source-stale')
          return source
        },
        captureLastValidRender,
        async restoreLastValidRender(render: MarkdownEditorSessionLastValidRender, expected: {
          readonly documentIdentity: MarkdownEditorDocumentIdentity
          readonly revision: number
        }): Promise<MarkdownEditorSessionRenderRestoreProof> {
          assertAvailable()
          const renderRef = render.ref
          const renderContext = Object.freeze({ id: render.documentIdentity.id, epoch: render.documentIdentity.epoch, revision: render.revision })
          const expectedContext = Object.freeze({ id: expected.documentIdentity.id, epoch: expected.documentIdentity.epoch, revision: expected.revision })
          const blocked = (reason: string): MarkdownEditorSessionRenderRestoreProof =>
            Object.freeze({ ref: renderRef, status: 'blocked', reason })
          const isCurrent = () => {
            const store = owner.transactionStore
            return store.documentIdentity.id === expectedContext.id &&
              store.documentIdentity.epoch === expectedContext.epoch &&
              store.revision === expectedContext.revision &&
              renderContext.id === expectedContext.id &&
              renderContext.epoch === expectedContext.epoch &&
              renderContext.revision === expectedContext.revision
          }
          if (capturing || !isCurrent()) return blocked('editor-session-render-context-mismatch')
          const current = captureLastValidRender()
          if (!current || current.ref !== renderRef)
            return blocked('editor-session-render-checkpoint-custody-invalid')
          if (!owner.restoreLastValidRender)
            return blocked('editor-session-render-restoration-owner-unavailable')
          const proof = await owner.restoreLastValidRender(renderRef)
          assertAvailable()
          if (!isCurrent() || proof.ref !== renderRef)
            return blocked('editor-session-render-restore-stale')
          return proof
        },
        captureSnapshot(digestSource: (source: string) => string, expected?: {
          readonly documentIdentity: MarkdownEditorDocumentIdentity
          readonly revision: number
          readonly assertAdmission?: () => void
        }) {
          const preparation = session!.prepareSnapshot(digestSource, expected)
          return session!.commitPreparedSnapshot(preparation)
        },
        prepareSnapshot(digestSource: (source: string) => string, expected?: {
          readonly documentIdentity: MarkdownEditorDocumentIdentity
          readonly revision: number
          readonly assertAdmission?: () => void
        }) {
          assertAvailable()
          if (capturing) throw new Error('editor-session-snapshot-reentrant')
          if (prepared) throw new Error('editor-session-snapshot-preparation-pending')
          if (sequence === Number.MAX_SAFE_INTEGER) throw new Error('editor-session-snapshot-sequence-exhausted')
          const previous = retained
          const store = owner.transactionStore
          let transactionPreparation: MarkdownEditorRetainedTransactionPreparation | undefined
          capturing = true
          try {
            const assertAdmission = expected?.assertAdmission
            assertAdmission?.()
            assertAvailable()
            const identity = store.documentIdentity
            const revision = store.revision
            const source = store.value
            if (expected && (
              identity.id !== expected.documentIdentity.id ||
              identity.epoch !== expected.documentIdentity.epoch ||
              revision !== expected.revision
            )) throw new Error('editor-session-snapshot-context-mismatch')
            const digest = digestSource(source)
            if (typeof digest !== 'string') throw new Error('editor-session-content-digest-invalid')
            assertAvailable()
            if (
              store.revision !== revision || store.value !== source ||
              store.documentIdentity.id !== identity.id ||
              store.documentIdentity.epoch !== identity.epoch
            ) throw new Error('editor-session-snapshot-stale')
            if (!/^[a-f0-9]{64}$/u.test(digest)) {
              throw new Error('editor-session-content-digest-invalid')
            }
            const render = captureLastValidRender()
            const lastValidRender = render && Object.freeze({
              ref: render.ref, documentIdentity: Object.freeze({ ...render.documentIdentity }), revision: render.revision,
            })
            const view = owner.captureViewState()
            const panels = owner.capturePanelState?.() ?? null
            // Actual consumer admission follows the last owner callback, before custody replacement.
            assertAdmission?.()
            assertAvailable()
            if (store.revision !== revision || store.value !== source ||
                store.documentIdentity.id !== identity.id || store.documentIdentity.epoch !== identity.epoch) {
              throw new Error('editor-session-snapshot-stale')
            }
            if (panels && !panels.isCurrent()) throw new Error('editor-session-panel-owner-stale')
            assertAdmission?.()
            assertAvailable()
            // Admission can synchronously schedule original panel continuations
            // without changing the document. Fence them before retaining history.
            if (panels && !panels.isCurrent()) throw new Error('editor-session-panel-owner-stale')
            if (store.revision !== revision || store.value !== source ||
                store.documentIdentity.id !== identity.id || store.documentIdentity.epoch !== identity.epoch) {
              throw new Error('editor-session-snapshot-stale')
            }
            transactionPreparation = store.prepareRetainedSnapshot()
            const transaction = transactionPreparation.snapshot
            const snapshotRef = `${editorSessionRef}:snapshot:${++sequence}`
            const snapshot: MarkdownEditorSessionSnapshot = Object.freeze({
              schema: 'fsusui.markdown-editor-retained-session.v1',
              snapshotRef,
              editorSessionRef,
              documentIdentity: transaction.documentIdentity,
              revision: transaction.revision,
              history: transaction.history,
              selection: transaction.selection,
              editorContentDigest: digest,
              selectionRef: `${snapshotRef}:selection`,
              historyRef: `${snapshotRef}:history`,
              viewStateRef: `${snapshotRef}:view`,
              lastValidRender,
              panelRefs: panels ? Object.freeze({
                activeNodeRef: `${snapshotRef}:active-node`,
                scrollAnchorRef: `${snapshotRef}:scroll-anchor`,
                outlineRef: `${snapshotRef}:outline`,
                searchRef: `${snapshotRef}:search`,
                attachmentStateRef: panels.state.attachment === null ? null : `${snapshotRef}:attachment`,
              }) : null,
            })
            const preparation = Object.freeze({ snapshot })
            prepared = { preparation, transaction: transactionPreparation, store,
              next: { snapshot, transaction, view, panels }, previous, assertAdmission, authorityGeneration }
            return preparation
          } catch (error) {
            if (transactionPreparation) store.discardPreparedRetainedSnapshot(transactionPreparation)
            throw error
          } finally {
            capturing = false
          }
        },
        commitPreparedSnapshot(preparation: MarkdownEditorSessionPreparedSnapshot, assertAdmission?: () => void) {
          const publication = session!.sealPreparedSnapshot(preparation, assertAdmission)
          const snapshot = session!.publishSealedSnapshot(publication)
          if (!snapshot) {
            session!.discardPreparedSnapshot(preparation)
            throw new Error('editor-session-snapshot-publication-stale')
          }
          return snapshot
        },
        sealPreparedSnapshot(preparation: MarkdownEditorSessionPreparedSnapshot, assertAdmission?: () => void) {
          if (capturing) throw new Error('editor-session-snapshot-reentrant')
          const custody = prepared
          if (!custody || preparation !== custody.preparation) throw new Error('editor-session-snapshot-preparation-invalid')
          if (sealed) throw new Error('editor-session-snapshot-already-sealed')
          let admitted = false
          capturing = true
          try {
            const publication: MarkdownEditorSessionSnapshotPublication = Object.freeze({ snapshot: custody.next.snapshot, scope: 'native-owner-custody' })
            // Allocate reservation metadata before any final native or consumer guard.
            const reservation = { publication, candidate: custody, generation: custody.authorityGeneration }
            // Native array allocation can reenter application admission without
            // changing the native revision. Finish it before EVERY final owner guard.
            if (!custody.store.allocatePreparedRetainedSnapshot(custody.transaction))
              throw new Error('editor-session-snapshot-preparation-stale')
            const admit = () => {
              custody.assertAdmission?.()
              if (assertAdmission !== custody.assertAdmission) assertAdmission?.()
            }
            admit()
            assertAvailable()
            const snapshot = custody.next.snapshot
            const render = snapshot.lastValidRender
            if (render) {
              const current = captureLastValidRender()
              if (!current || current.ref !== render.ref || current.revision !== render.revision ||
                  current.documentIdentity.id !== render.documentIdentity.id || current.documentIdentity.epoch !== render.documentIdentity.epoch)
                throw new Error('editor-session-render-checkpoint-custody-invalid')
            }
            const panels = custody.next.panels
            if (panels && !panels.isCurrent()) throw new Error('editor-session-panel-owner-stale')
            admit()
            assertAvailable()
            if (panels && !panels.isCurrent()) throw new Error('editor-session-panel-owner-stale')
            // Original private checks follow every admission/view/renderer callback.
            if (prepared !== custody || retained !== custody.previous || owner.transactionStore !== custody.store ||
                !custody.store.validatePreparedRetainedSnapshot(custody.transaction))
              throw new Error('editor-session-snapshot-preparation-stale')
            if (authorityRetired || authorityGeneration !== reservation.generation)
              throw new Error('editor-session-publication-authority-retired')
            sealed = reservation
            admitted = true
            return publication
          } finally {
            if (!admitted && prepared === custody) {
              custody.store.discardPreparedRetainedSnapshot(custody.transaction)
              prepared = undefined
            }
            capturing = false
          }
        },
        hasSealedSnapshotCustody,
        hasRetainedSnapshotCustody(snapshot: MarkdownEditorSessionSnapshot): boolean {
          const custody = retained
          return custody !== undefined && custody.snapshot === snapshot && !authorityRetired && !capturing &&
            retainedGeneration === authorityGeneration && validateRetainedTransaction(custody.transaction)
        },
        publishSealedSnapshot(publication: MarkdownEditorSessionSnapshotPublication): MarkdownEditorSessionSnapshot | null {
          if (!hasSealedSnapshotCustody(publication)) return null
          const custody = sealed!
          const next = custody.candidate.next
          const transaction = publishPreparedTransaction(custody.candidate.transaction)
          if (transaction !== next.transaction) return null
          // Only genuine preallocated original-owner pointers are published.
          retained = next
          retainedGeneration = custody.generation
          prepared = undefined
          sealed = undefined
          return publication.snapshot
        },
        discardPreparedSnapshot(preparation: MarkdownEditorSessionPreparedSnapshot): boolean {
          const custody = prepared
          if (!custody || preparation !== custody.preparation) return false
          const discarded = custody.store.discardPreparedRetainedSnapshot(custody.transaction)
          prepared = undefined
          sealed = undefined
          return discarded
        },
        readPanelState(snapshot: MarkdownEditorSessionSnapshot): MarkdownEditorSessionPanelState | null {
          assertAvailable()
          const custody = retained
          if (capturing || !custody || snapshot !== custody.snapshot || !custody.panels ||
              !owner.transactionStore.validateRetainedSnapshot(custody.transaction)) return null
          if (!custody.panels.isCurrent()) return null
          assertAvailable()
          return retained === custody && owner.transactionStore.validateRetainedSnapshot(custody.transaction)
            ? custody.panels.state : null
        },
        validateRetainedSnapshot(snapshot: MarkdownEditorSessionSnapshot, expected: {
          readonly documentIdentity: MarkdownEditorDocumentIdentity
          readonly revision: number
        }): boolean {
          const expectedId = expected.documentIdentity.id
          const expectedEpoch = expected.documentIdentity.epoch
          const expectedRevision = expected.revision
          assertAvailable()
          if (capturing || !retained || snapshot !== retained.snapshot) return false
          const store = owner.transactionStore
          const identity = store.documentIdentity
          return identity.id === expectedId && identity.epoch === expectedEpoch &&
            identity.id === snapshot.documentIdentity.id && identity.epoch === snapshot.documentIdentity.epoch &&
            store.revision === expectedRevision && store.revision === snapshot.revision &&
            store.validateRetainedSnapshot(retained.transaction)
        },
        restoreSnapshot(snapshot: MarkdownEditorSessionSnapshot, expected: {
          readonly documentIdentity: MarkdownEditorDocumentIdentity
          readonly revision: number
          readonly assertAdmission?: () => void
        }): MarkdownEditorSessionRestoreProof {
          const assertAdmission = expected.assertAdmission
          assertAvailable()
          const store = owner.transactionStore
          const identity = store.documentIdentity
          const blocked = (reason: string): MarkdownEditorSessionRestoreProof =>
            Object.freeze({ status: 'blocked', snapshotRef: snapshot.snapshotRef, reason })
          if (capturing) return blocked('editor-session-snapshot-reentrant')
          const custody = retained
          if (!custody || snapshot !== custody.snapshot) {
            return blocked('editor-session-snapshot-custody-invalid')
          }
          if (
            identity.id !== expected.documentIdentity.id ||
            identity.epoch !== expected.documentIdentity.epoch ||
            identity.id !== snapshot.documentIdentity.id ||
            identity.epoch !== snapshot.documentIdentity.epoch
          ) return blocked('editor-session-document-mismatch')
          if (store.revision !== expected.revision || store.revision !== snapshot.revision) {
            return blocked('editor-session-revision-mismatch')
          }
          if (snapshot.lastValidRender) {
            const currentRender = captureLastValidRender()
            if (!currentRender || currentRender.ref !== snapshot.lastValidRender.ref) {
              return blocked('editor-session-render-checkpoint-custody-invalid')
            }
          }
          if (custody.panels && !custody.panels.isCurrent()) return blocked('editor-session-panel-owner-stale')
          // Final actual admission after renderer callbacks and before history/selection mutation.
          assertAdmission?.()
          assertAvailable()
          // openSearch and other public callbacks can enqueue original nextTick
          // work at the same revision. No native mutation precedes this fence.
          if (custody.panels && !custody.panels.isCurrent()) return blocked('editor-session-panel-owner-stale')
          if (retained !== custody) return blocked('editor-session-snapshot-custody-invalid')
          if (!store.restoreRetainedSnapshot(custody.transaction)) {
            return blocked('editor-session-history-checkpoint-invalid')
          }
          if (custody.panels) custody.panels.restore()
          else owner.restoreViewState(custody.view)
          return Object.freeze({ status: 'restored', snapshotRef: snapshot.snapshotRef, reason: null })
        },
        inspectResources: () => { assertAvailable(); return resources.inspectResources() },
        pauseResources: () => { assertAvailable(); return resources.pauseResources() },
        resumeResources: () => { assertAvailable(); return resources.resumeResources() },
        disposeAfterSnapshot(snapshotRef: string) {
          assertAvailable()
          if (!retained || retained.snapshot.snapshotRef !== snapshotRef) {
            throw new Error('editor-session-snapshot-custody-invalid')
          }
          // No irreversible release until a recoverable renderer/provider
          // checkpoint and disposal owner exist. Preserve snapshot on failure.
          resources.disposeAfterSnapshot(snapshotRef)
        },
      })
      return session
    },
  })
}
