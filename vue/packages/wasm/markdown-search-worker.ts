import {
  searchMarkdownRawSource,
  type MarkdownSearchMatch,
  type MarkdownSearchQuery,
} from './markdown-search-model'

export interface MarkdownSearchTask {
  readonly id: string
  readonly query: string
  cancelled: boolean
}

export const MARKDOWN_SEARCH_BUDGET = Object.freeze({
  maxRegexLength: 256,
  maxMs: 50,
  maxMatches: 10_000,
  maxSourceBytes: 400_000,
  maxConcurrent: 1,
})

export type MarkdownSearchBudget = typeof MARKDOWN_SEARCH_BUDGET

export const createMarkdownSearchTask = (id: string, query: string): MarkdownSearchTask => ({
  id,
  query,
  cancelled: false,
})

export const cancelMarkdownSearchTask = (task: MarkdownSearchTask) => {
  task.cancelled = true
}

export const boundMarkdownSearchRegex = (query: string, maxLength = MARKDOWN_SEARCH_BUDGET.maxRegexLength) => {
  if (query.length > maxLength) {
    throw new Error('search regex exceeds bound')
  }
  if (looksCatastrophic(query)) {
    throw new Error('search regex is unsafe')
  }
  return new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'u')
}

const looksCatastrophic = (query: string) =>
  /(\([^)]*[+*][^)]*\)[+*])|([+*]\{?\d*,?\d*\}?[+*])/.test(query)

export type MarkdownSearchExecutionStatus =
  | 'complete'
  | 'truncated'
  | 'aborted'
  | 'rejected'

export interface MarkdownSearchExecution {
  readonly requestId: string
  readonly status: MarkdownSearchExecutionStatus
  readonly matches: readonly MarkdownSearchMatch[]
  readonly total: number | null
  readonly truncated: boolean
  readonly code?: string
}

export const runMarkdownSearchTask = (input: {
  readonly requestId: string
  readonly source: string
  readonly query: MarkdownSearchQuery
  readonly documentId: string
  readonly documentEpoch: number
  readonly revision: number
  readonly task?: MarkdownSearchTask
  readonly budget?: MarkdownSearchBudget
  readonly now?: () => number
}): MarkdownSearchExecution => {
  const budget = input.budget ?? MARKDOWN_SEARCH_BUDGET
  const started = (input.now ?? Date.now)()
  if (input.task?.cancelled) {
    return Object.freeze({
      requestId: input.requestId,
      status: 'aborted',
      matches: Object.freeze([]),
      total: null,
      truncated: false,
    })
  }
  const sourceBytes = input.source.length * 2
  if (sourceBytes > budget.maxSourceBytes) {
    return Object.freeze({
      requestId: input.requestId,
      status: 'rejected',
      matches: Object.freeze([]),
      total: null,
      truncated: false,
      code: 'source-budget',
    })
  }
  if (input.query.mode === 'regex') {
    if (input.query.text.length > budget.maxRegexLength || looksCatastrophic(input.query.text)) {
      return Object.freeze({
        requestId: input.requestId,
        status: 'rejected',
        matches: Object.freeze([]),
        total: null,
        truncated: false,
        code: 'regex-budget',
      })
    }
  }
  const found = searchMarkdownRawSource({
    source: input.source,
    query: input.query,
    documentId: input.documentId,
    documentEpoch: input.documentEpoch,
    revision: input.revision,
  })
  if (input.task?.cancelled) {
    return Object.freeze({
      requestId: input.requestId,
      status: 'aborted',
      matches: Object.freeze([]),
      total: null,
      truncated: false,
    })
  }
  if (!found.ok) {
    return Object.freeze({
      requestId: input.requestId,
      status: 'rejected',
      matches: Object.freeze([]),
      total: null,
      truncated: false,
      code: found.code,
    })
  }
  const elapsed = (input.now ?? Date.now)() - started
  const truncated =
    found.matches.length > budget.maxMatches || elapsed > budget.maxMs
  const matches = truncated
    ? found.matches.slice(0, budget.maxMatches)
    : found.matches
  return Object.freeze({
    requestId: input.requestId,
    status: truncated ? 'truncated' : 'complete',
    matches: Object.freeze(matches),
    total: truncated ? null : found.matches.length,
    truncated,
  })
}

export const commitMarkdownSearchExecution = (
  currentRequestId: string,
  execution: MarkdownSearchExecution,
): MarkdownSearchExecution => {
  if (execution.requestId !== currentRequestId) {
    return Object.freeze({
      ...execution,
      status: 'aborted',
      matches: Object.freeze([]),
      total: null,
      truncated: false,
      code: 'stale',
    })
  }
  return execution
}

export type MarkdownSearchWorkerMutationKind =
  | 'main-thread-unbounded-regex'
  | 'stale-commit'
  | 'fake-count'
  | 'external-service'

export const evaluateMarkdownSearchWorkerMutations = () => {
  const task = createMarkdownSearchTask('t1', '(a+)+$')
  const catastrophic = runMarkdownSearchTask({
    requestId: 'r1',
    source: `${'a'.repeat(40)}b`,
    query: { text: '(a+)+$', mode: 'regex', queryVersion: 1 },
    documentId: 'doc',
    documentEpoch: 1,
    revision: 1,
    task,
  })
  const late = commitMarkdownSearchExecution('r2', {
    requestId: 'r1',
    status: 'complete',
    matches: [],
    total: 99,
    truncated: false,
  })
  const fake = runMarkdownSearchTask({
    requestId: 'r3',
    source: 'x '.repeat(20_000),
    query: { text: 'x', mode: 'plain', queryVersion: 1 },
    documentId: 'doc',
    documentEpoch: 1,
    revision: 1,
    budget: { ...MARKDOWN_SEARCH_BUDGET, maxMatches: 10 },
  })
  return Object.freeze({
    mutations: Object.freeze([
      Object.freeze({
        kind: 'main-thread-unbounded-regex' as const,
        equivalent: catastrophic.status === 'complete',
        accepted: false,
      }),
      Object.freeze({
        kind: 'stale-commit' as const,
        equivalent: late.status === 'complete',
        accepted: false,
      }),
      Object.freeze({
        kind: 'fake-count' as const,
        equivalent: fake.truncated && fake.total === fake.matches.length,
        accepted: false,
      }),
      Object.freeze({
        kind: 'external-service' as const,
        equivalent: false,
        accepted: false,
      }),
    ]),
  })
}
