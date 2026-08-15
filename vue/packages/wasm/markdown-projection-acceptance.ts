import { createMarkdownAnchorMap } from './markdown-anchor-map'
import { evaluateMarkdownAnchorMutations } from './markdown-anchor-mutations'
import {
  compareMarkdownEditorProjectionThreads,
  createMarkdownEditorProjection,
} from './markdown-editor-projection'
import {
  MARKDOWN_PROJECTION_INVALIDATION_BUDGET,
  planMarkdownProjectionInvalidation,
  type MarkdownProjectionInvalidationBudget,
} from './markdown-projection-invalidation'
import { createMarkdownProjectionWorkerHost } from './markdown-projection-worker'
import { evaluateMarkdownProjectionKeystrokeMutations } from './markdown-projection-keystroke-mutations'
import { evaluateMarkdownProjectionMutations } from './markdown-projection-mutations'
import { compareMarkdownSourceCoordinateMapThreads } from './markdown-source-coordinate-threads'
import { evaluateMarkdownSyntaxIdentityMutations } from './markdown-syntax-identity-mutations'
import {
  stabilizeMarkdownEditorProjection,
  type MarkdownDocumentIdentity,
} from './markdown-syntax-identity'

export const MARKDOWN_PROJECTION_ACCEPTANCE_VERSION =
  'markdown-projection-acceptance@2026-08-15'

export const MARKDOWN_PROJECTION_ACCEPTANCE_SCALE = Object.freeze({
  minSourceChars: 100_000,
  minBlocks: 3_000,
  minHeadings: 10_000,
})

export interface MarkdownProjectionAcceptanceBudgets {
  readonly version: typeof MARKDOWN_PROJECTION_ACCEPTANCE_VERSION
  readonly maxScannedBytes: number
  readonly maxExaminedNodes: number
}

export interface MarkdownProjectionAcceptanceScaleRecord {
  readonly version: typeof MARKDOWN_PROJECTION_ACCEPTANCE_VERSION
  readonly sourceChars: number
  readonly blockCount: number
  readonly headingCount: number
  readonly parserDurationMs: number
  readonly projectorDurationMs: number
  readonly taskId: string
  readonly aborted: boolean
  readonly invalidatedRangeCount: number
  readonly preservedIdentityCount: number
  readonly retainedNodeCount: number
  readonly heapUsedBefore: number
  readonly heapUsedAfter: number
  readonly heapDelta: number
  readonly budget: MarkdownProjectionInvalidationBudget
}

export interface MarkdownProjectionAcceptanceReport {
  readonly version: typeof MARKDOWN_PROJECTION_ACCEPTANCE_VERSION
  readonly documentIdentity: MarkdownDocumentIdentity
  readonly threadsEquivalent: boolean
  readonly coordinateThreadsEquivalent: boolean
  readonly staleRejected: boolean
  readonly documentSwitchRejected: boolean
  readonly deletedAnchorRejected: boolean
  readonly projectionMutationsRejected: boolean
  readonly identityMutationsRejected: boolean
  readonly anchorMutationsRejected: boolean
  readonly accepted: boolean
  readonly budgets: MarkdownProjectionAcceptanceBudgets
}

const defaultSource = [
  '\uFEFF# Title\r\n',
  '',
  'A paragraph.\r\n',
  '',
  '- item\n',
  '',
  '| h |\n| --- |\n| c |\n',
  '',
  'See [same](a) and [same](b)\n',
].join('\n')

export const evaluateMarkdownProjectionAcceptance = (input?: {
  readonly source?: string
  readonly documentIdentity?: MarkdownDocumentIdentity
}): MarkdownProjectionAcceptanceReport => {
  const source = input?.source ?? defaultSource
  const documentIdentity = input?.documentIdentity ??
    Object.freeze({ id: 'acceptance-doc', epoch: 1 })

  const threads = compareMarkdownEditorProjectionThreads(source)
  const coordinates = compareMarkdownSourceCoordinateMapThreads(source)
  const stable = stabilizeMarkdownEditorProjection(
    createMarkdownEditorProjection(source),
    documentIdentity,
  )
  const paragraph = stable.nodes.find((node) => node.kind === 'paragraph')
  const from = paragraph ? paragraph.rawRange.start + 1 : Math.min(2, source.length)
  const keystrokes = evaluateMarkdownProjectionKeystrokeMutations({
    source,
    documentIdentity,
    from,
    typed: 'xy',
  })
  const posted: unknown[] = []
  const host = createMarkdownProjectionWorkerHost({
    documentIdentity,
    port: {
      post(request) {
        posted.push(request)
      },
    },
  })
  host.dispatch({
    previous: stable,
    previousSource: source,
    change: { from, to: from, insert: 'z' },
    source: `${source.slice(0, from)}z${source.slice(from)}`,
  })
  host.replaceDocument({ id: 'other-doc', epoch: 1 })
  const switched = host.accept({
    type: 'result',
    taskId: 'stale',
    revision: 1,
    documentIdentity,
    sourceIdentity: 'ignored',
    parser: 'ignored',
    version: 'ignored',
    nodeIds: [],
    kinds: [],
    retainedCurrentIds: [],
  })

  const heading = stable.nodes.find((node) => node.kind === 'heading')
  const anchors = createMarkdownAnchorMap({
    identity: documentIdentity,
    source,
    projection: stable,
  })
  const deleted = heading
    ? anchors.remapRange(heading.rawRange, {
        delete: [heading.rawRange.start, heading.rawRange.end],
      })
    : { status: 'deleted' as const }

  const projectionMutations = evaluateMarkdownProjectionMutations(source)
  const identityMutations = evaluateMarkdownSyntaxIdentityMutations({
    previousSource: '# Alpha\n',
    nextSource: 'Alpha\n\n# Alpha\n',
    documentIdentity,
  })
  const rtlSource = '\uFEFF# Title\r\n\nHello \u05e9\u05dc\u05d5\u05dd Title'
  const hebrew = rtlSource.indexOf('\u05e9')
  const anchorMutations = evaluateMarkdownAnchorMutations({
    identity: documentIdentity,
    source: rtlSource,
    syntax: [
      { id: 'title', range: [1, rtlSource.indexOf('\n')] },
      { id: 'hebrew', range: [hebrew, hebrew + 4] },
    ],
  })

  const threadsEquivalent = threads.equivalent
  const coordinateThreadsEquivalent = coordinates.equivalent
  const staleRejected = keystrokes.mutations.every(
    (mutation) => mutation.accepted === false,
  )
  const documentSwitchRejected = switched.ok === false
  const deletedAnchorRejected = deleted.status === 'deleted'
  const projectionMutationsRejected = projectionMutations.mutations.every(
    (mutation) => mutation.accepted === false,
  )
  const identityMutationsRejected = identityMutations.mutations.every(
    (mutation) => mutation.accepted === false,
  )
  const anchorMutationsRejected = anchorMutations.mutations.every(
    (mutation) => mutation.accepted === false,
  )
  const accepted =
    threadsEquivalent &&
    coordinateThreadsEquivalent &&
    staleRejected &&
    documentSwitchRejected &&
    deletedAnchorRejected &&
    projectionMutationsRejected &&
    identityMutationsRejected &&
    anchorMutationsRejected

  return Object.freeze({
    version: MARKDOWN_PROJECTION_ACCEPTANCE_VERSION,
    documentIdentity,
    threadsEquivalent,
    coordinateThreadsEquivalent,
    staleRejected,
    documentSwitchRejected,
    deletedAnchorRejected,
    projectionMutationsRejected,
    identityMutationsRejected,
    anchorMutationsRejected,
    accepted,
    budgets: Object.freeze({
      version: MARKDOWN_PROJECTION_ACCEPTANCE_VERSION,
      maxScannedBytes: MARKDOWN_PROJECTION_INVALIDATION_BUDGET.maxScannedBytes,
      maxExaminedNodes: MARKDOWN_PROJECTION_INVALIDATION_BUDGET.maxExaminedNodes,
    }),
  })
}

export const createMarkdownProjectionAcceptanceScaleSource = (): string => {
  const chunks = Array.from(
    { length: MARKDOWN_PROJECTION_ACCEPTANCE_SCALE.minHeadings },
    (_, index) => `# H${String(index).padStart(5, '0')}\n\n`,
  )
  let source = chunks.join('')
  while (source.length < MARKDOWN_PROJECTION_ACCEPTANCE_SCALE.minSourceChars) {
    source += 'x'
  }
  return source
}

const heapUsed = () => {
  const memory = (
    globalThis as { process?: { memoryUsage?: () => { heapUsed: number } } }
  ).process?.memoryUsage?.()
  return memory?.heapUsed ?? 0
}

export const recordMarkdownProjectionAcceptanceScale = (input?: {
  readonly source?: string
  readonly documentIdentity?: MarkdownDocumentIdentity
}): MarkdownProjectionAcceptanceScaleRecord => {
  const source = input?.source ?? createMarkdownProjectionAcceptanceScaleSource()
  const documentIdentity = input?.documentIdentity ??
    Object.freeze({ id: 'scale-doc', epoch: 1 })
  const heapUsedBefore = heapUsed()
  const parseStarted = performance.now()
  const projection = createMarkdownEditorProjection(source)
  const parserDurationMs = performance.now() - parseStarted
  const projectStarted = performance.now()
  const stable = stabilizeMarkdownEditorProjection(projection, documentIdentity)
  const projectorDurationMs = performance.now() - projectStarted
  const headings = stable.nodes.filter((node) => node.kind === 'heading')
  const target = headings[Math.floor(headings.length / 2)] ?? stable.nodes[0]
  const from = target ? target.rawRange.start + 2 : 0
  const plan = planMarkdownProjectionInvalidation({
    identity: documentIdentity,
    revision: 1,
    previousSource: source,
    change: { from, to: from, insert: 'x' },
    previous: stable,
  })
  const heapUsedAfter = heapUsed()

  return Object.freeze({
    version: MARKDOWN_PROJECTION_ACCEPTANCE_VERSION,
    sourceChars: source.length,
    blockCount: stable.nodes.length,
    headingCount: headings.length,
    parserDurationMs,
    projectorDurationMs,
    taskId: plan.taskId,
    aborted: false,
    invalidatedRangeCount: plan.invalidatedRanges.length,
    preservedIdentityCount: plan.retainedNodeIds.length,
    retainedNodeCount: plan.retainedNodeIds.length,
    heapUsedBefore,
    heapUsedAfter,
    heapDelta: heapUsedAfter - heapUsedBefore,
    budget: plan.budget,
  })
}
