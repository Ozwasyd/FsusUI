import { createMarkdownEditorProjection } from './markdown-editor-projection'
import { type MarkdownProjectionInvalidationPlan } from './markdown-projection-invalidation'
import {
  createMarkdownProjectionWorkerHost,
  projectMarkdownOnWorker,
  type MarkdownProjectionWorkerRequest,
} from './markdown-projection-worker'
import {
  stabilizeMarkdownEditorProjection,
  type MarkdownDocumentIdentity,
} from './markdown-syntax-identity'

export type MarkdownKeystrokeMutationKind =
  | 'every-keystroke-full-reparse'
  | 'fake-local-evidence'
  | 'stale-worker-commit'

export interface MarkdownKeystrokeMutationResult {
  readonly kind: MarkdownKeystrokeMutationKind
  readonly equivalent: boolean
  readonly accepted: boolean
  readonly detail: string
}

export interface MarkdownKeystrokeStroke {
  readonly revision: number
  readonly source: string
  readonly change: { readonly from: number; readonly to: number; readonly insert: string }
  readonly plan: MarkdownProjectionInvalidationPlan
}

export interface MarkdownKeystrokeMutationReport {
  readonly documentIdentity: MarkdownDocumentIdentity
  readonly strokes: readonly MarkdownKeystrokeStroke[]
  readonly commits: readonly {
    readonly ok: boolean
    readonly reason?: string
    readonly revision?: number
  }[]
  readonly mutations: readonly MarkdownKeystrokeMutationResult[]
}

const applyChange = (
  source: string,
  change: { readonly from: number; readonly to: number; readonly insert: string },
) => source.slice(0, change.from) + change.insert + source.slice(change.to)

const rangeCoversSource = (
  plan: MarkdownProjectionInvalidationPlan,
  source: string,
) =>
  plan.invalidatedRanges.some(
    (range) => range.start <= 0 && range.end >= source.length,
  )

const looksLikeFullReparse = (
  plan: MarkdownProjectionInvalidationPlan,
  source: string,
) =>
  plan.budget.scannedBytes >= source.length && rangeCoversSource(plan, source)

const fakeFullReparsePlan = (
  plan: MarkdownProjectionInvalidationPlan,
  source: string,
): MarkdownProjectionInvalidationPlan =>
  Object.freeze({
    ...plan,
    expanded: true,
    reason: 'expanded-unsafe' as const,
    invalidatedRanges: Object.freeze([{ start: 0, end: source.length }]),
    budget: Object.freeze({
      scannedBytes: source.length,
      examinedNodes: plan.budget.examinedNodes,
      maxScannedBytes: plan.budget.maxScannedBytes,
      maxExaminedNodes: plan.budget.maxExaminedNodes,
      capped: source.length > plan.budget.maxScannedBytes,
    }),
  })

const fakeLocalEvidencePlan = (
  plan: MarkdownProjectionInvalidationPlan,
  source: string,
): MarkdownProjectionInvalidationPlan =>
  Object.freeze({
    ...plan,
    expanded: false,
    reason: 'local-edit' as const,
    invalidatedRanges: Object.freeze([{ start: 0, end: source.length }]),
    budget: Object.freeze({
      scannedBytes: 1,
      examinedNodes: 1,
      maxScannedBytes: plan.budget.maxScannedBytes,
      maxExaminedNodes: plan.budget.maxExaminedNodes,
      capped: false,
    }),
  })

export const evaluateMarkdownProjectionKeystrokeMutations = (input: {
  readonly source: string
  readonly documentIdentity: MarkdownDocumentIdentity
  readonly from: number
  readonly typed: string
}): MarkdownKeystrokeMutationReport => {
  if (!input.typed) {
    throw new Error('keystroke mutation requires typed characters')
  }

  const strokes: MarkdownKeystrokeStroke[] = []
  let source = input.source
  let previous = stabilizeMarkdownEditorProjection(
    createMarkdownEditorProjection(source),
    input.documentIdentity,
  )
  const posted: MarkdownProjectionWorkerRequest[] = []
  const host = createMarkdownProjectionWorkerHost({
    documentIdentity: input.documentIdentity,
    port: {
      post(request) {
        posted.push(request)
      },
    },
  })

  for (let index = 0; index < input.typed.length; index += 1) {
    const insert = input.typed[index]!
    const change = {
      from: input.from + index,
      to: input.from + index,
      insert,
    }
    const nextSource = applyChange(source, change)
    const plan = host.dispatch({
      previous,
      previousSource: source,
      change,
      source: nextSource,
    })
    strokes.push(
      Object.freeze({
        revision: plan.revision,
        source: nextSource,
        change: Object.freeze(change),
        plan,
      }),
    )
    source = nextSource
    previous = stabilizeMarkdownEditorProjection(
      createMarkdownEditorProjection(source),
      input.documentIdentity,
    )
  }

  const results = posted.map((request) => projectMarkdownOnWorker(request))
  const commits = results.map((result) => {
    const commit = host.accept(result)
    return commit.ok
      ? { ok: true as const, revision: commit.value.revision }
      : { ok: false as const, reason: commit.reason }
  })

  const fullEquivalent = strokes.every((stroke) => {
    const fake = fakeFullReparsePlan(stroke.plan, stroke.source)
    return (
      looksLikeFullReparse(stroke.plan, stroke.source) &&
      fake.budget.scannedBytes === stroke.plan.budget.scannedBytes
    )
  })
  const fakeLocalEquivalent = strokes.every((stroke) => {
    const fake = fakeLocalEvidencePlan(stroke.plan, stroke.source)
    return (
      fake.reason === stroke.plan.reason &&
      fake.budget.scannedBytes === stroke.plan.budget.scannedBytes &&
      rangeCoversSource(stroke.plan, stroke.source)
    )
  })
  const lastRevision = strokes.at(-1)?.revision
  const staleAccepted = commits.some(
    (commit) => commit.ok && commit.revision !== lastRevision,
  )

  return Object.freeze({
    documentIdentity: input.documentIdentity,
    strokes: Object.freeze(strokes),
    commits: Object.freeze(commits),
    mutations: Object.freeze([
      Object.freeze({
        kind: 'every-keystroke-full-reparse' as const,
        equivalent: fullEquivalent,
        accepted: fullEquivalent,
        detail: 'local keystrokes must not scan or invalidate the whole source',
      }),
      Object.freeze({
        kind: 'fake-local-evidence' as const,
        equivalent: fakeLocalEquivalent,
        accepted: fakeLocalEquivalent,
        detail: 'a 1-byte scan cannot claim a full-document invalidated range',
      }),
      Object.freeze({
        kind: 'stale-worker-commit' as const,
        equivalent: false,
        accepted: staleAccepted,
        detail: 'only the latest worker revision may commit after rapid input',
      }),
    ]),
  })
}

export const markdownKeystrokePlanStaysBounded = (
  plan: MarkdownProjectionInvalidationPlan,
  source: string,
) =>
  plan.budget.scannedBytes <= MARKDOWN_PROJECTION_INVALIDATION_BUDGET.maxScannedBytes &&
  !rangeCoversSource(plan, source) &&
  plan.invalidatedRanges.every((range) => range.end - range.start < source.length)

export const markdownKeystrokeFullReparseRejected = (
  report: MarkdownKeystrokeMutationReport,
) =>
  report.mutations.find((mutation) => mutation.kind === 'every-keystroke-full-reparse')
    ?.accepted === false
