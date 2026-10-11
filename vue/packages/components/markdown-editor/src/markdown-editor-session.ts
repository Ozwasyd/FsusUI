import { createMarkdownEditorSessionResourceCoordinator } from './markdown-editor-session-resources'
import type { MarkdownEditorSessionResourceCensus, MarkdownEditorSessionResourceParticipant } from './markdown-editor-session-resources'
import type {
  MarkdownEditorDocumentIdentity,
  MarkdownEditorHistoryState,
  MarkdownEditorResolvedSelection,
  MarkdownEditorRetainedTransactionSnapshot,
  MarkdownEditorTransactionStore,
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

export interface MarkdownEditorSession {
  readonly editorSessionRef: string
  inspectCapabilities(): MarkdownEditorSessionCapabilities
  inspectDocumentState(): MarkdownEditorSessionDocumentState
  inspectResourceParticipants(): MarkdownEditorSessionResourceCensus
  inspectRendererResourceSource(): MarkdownEditorSessionRendererResourceSource | null
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
  /** Read-only original token/document custody check; does not restore, capture or certify resources. */
  validateRetainedSnapshot(snapshot: MarkdownEditorSessionSnapshot, expected: {
    readonly documentIdentity: MarkdownEditorDocumentIdentity
    readonly revision: number
  }): boolean
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
  readonly isComposing: () => boolean
  readonly isDisposed: () => boolean
  readonly captureViewState: () => ViewState
  readonly restoreViewState: (state: ViewState) => void
  readonly resourceParticipants: () => readonly MarkdownEditorSessionResourceParticipant[]
  readonly captureLastValidRender: () => MarkdownEditorSessionLastValidRender | null
  readonly inspectRendererResourceSource?: () => MarkdownEditorSessionRendererResourceSource | null
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
): MarkdownEditorSessionExpose => {
  const resources = createMarkdownEditorSessionResourceCoordinator(owner.resourceParticipants)
  let session: MarkdownEditorSession | undefined
  let retained: {
    readonly snapshot: MarkdownEditorSessionSnapshot
    readonly transaction: MarkdownEditorRetainedTransactionSnapshot
    readonly view: ViewState
  } | undefined
  let sequence = 0
  let capturing = false

  const assertAvailable = () => {
    if (owner.isDisposed()) throw new Error('editor-session-disposed')
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
    getSession(editorSessionRef: string) {
      assertAvailable()
      if (!/^[a-zA-Z0-9][a-zA-Z0-9._:-]{2,127}$/u.test(editorSessionRef)) {
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
        inspectCapabilities,
        inspectDocumentState() {
          assertAvailable()
          const store = owner.transactionStore
          return Object.freeze({
            documentIdentity: Object.freeze({ ...store.documentIdentity }),
            revision: store.revision,
          })
        },
        inspectResourceParticipants: () => { assertAvailable(); return resources.inspectParticipants() },
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
            if (expected && (
              identity.id !== expected.documentIdentity.id ||
              identity.epoch !== expected.documentIdentity.epoch ||
              revision !== expected.revision
            )) throw new Error('editor-session-snapshot-context-mismatch')
            const digest = digestSource(source)
            assertAvailable()
            if (
              store.revision !== revision || store.value !== source ||
              store.documentIdentity.id !== identity.id ||
              store.documentIdentity.epoch !== identity.epoch
            ) throw new Error('editor-session-snapshot-stale')
            if (!/^[a-f0-9]{64}$/u.test(digest)) {
              throw new Error('editor-session-content-digest-invalid')
            }
            const lastValidRender = captureLastValidRender()
            const view = owner.captureViewState()
            // Actual consumer admission follows the last owner callback, before custody replacement.
            assertAdmission?.()
            assertAvailable()
            if (store.revision !== revision || store.value !== source ||
                store.documentIdentity.id !== identity.id || store.documentIdentity.epoch !== identity.epoch) {
              throw new Error('editor-session-snapshot-stale')
            }
            const transaction = store.retainSnapshot()
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
            })
            retained = { snapshot, transaction, view }
            return snapshot
          } finally {
            capturing = false
          }
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
          // Final actual admission after renderer callbacks and before history/selection mutation.
          assertAdmission?.()
          assertAvailable()
          if (retained !== custody) return blocked('editor-session-snapshot-custody-invalid')
          if (!store.restoreRetainedSnapshot(custody.transaction)) {
            return blocked('editor-session-history-checkpoint-invalid')
          }
          owner.restoreViewState(custody.view)
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
