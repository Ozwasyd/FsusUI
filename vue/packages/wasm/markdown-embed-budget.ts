import type { MarkdownEmbedMode } from './markdown-embed-directive'

export interface MarkdownEmbedBudget {
  readonly maxDepth: number
  readonly maxNodes: number
  readonly maxBytes: number
  readonly maxMs: number
  readonly maxConcurrent: number
  readonly maxCacheEntries: number
}

export const MARKDOWN_EMBED_BUDGET: MarkdownEmbedBudget = Object.freeze({
  maxDepth: 4,
  maxNodes: 1000,
  maxBytes: 1_000_000,
  maxMs: 50,
  maxConcurrent: 4,
  maxCacheEntries: 256,
})

export type MarkdownEmbedBudgetFailure =
  | 'cycle'
  | 'depth-exceeded'
  | 'node-exceeded'
  | 'size-exceeded'
  | 'time-exceeded'
  | 'concurrency-exceeded'
  | 'cancelled'
  | 'stale'

export interface MarkdownEmbedTargetIdentity {
  readonly targetId: string
  readonly targetVersion: number
  readonly targetToken?: string
}

export interface MarkdownEmbedCacheKey {
  readonly targetId: string
  readonly targetVersion: number
  readonly mode: MarkdownEmbedMode
  readonly providerVersion: number
  readonly feature?: string
  readonly theme?: string
  readonly locale?: string
}

export const markdownEmbedTargetIdentityKey = (identity: MarkdownEmbedTargetIdentity) =>
  `${identity.targetId}@${identity.targetVersion}`

export const markdownEmbedCacheKey = (input: MarkdownEmbedCacheKey) =>
  [
    input.targetId,
    `@${input.targetVersion}`,
    `:${input.mode}`,
    `:p${input.providerVersion}`,
    `:${input.feature ?? ''}`,
    `:${input.theme ?? ''}`,
    `:${input.locale ?? ''}`,
  ].join('')

export const detectMarkdownEmbedCycle = (
  graph: Readonly<Record<string, readonly string[]>>,
  start: string,
): boolean => {
  const stack = new Set<string>()
  const seen = new Set<string>()
  const visit = (node: string): boolean => {
    if (stack.has(node)) return true
    if (seen.has(node)) return false
    stack.add(node)
    seen.add(node)
    for (const next of graph[node] ?? []) {
      if (visit(next)) return true
    }
    stack.delete(node)
    return false
  }
  return visit(start)
}

export const pathContainsMarkdownEmbedCycle = (
  path: readonly string[],
  nextIdentity: string,
) => path.includes(nextIdentity)

export const evaluateMarkdownEmbedBudget = (
  stats: { readonly depth: number; readonly nodes: number; readonly bytes: number; readonly ms: number },
  budget: MarkdownEmbedBudget = MARKDOWN_EMBED_BUDGET,
): { readonly ok: boolean; readonly budget: MarkdownEmbedBudget; readonly stats: typeof stats; readonly failure?: MarkdownEmbedBudgetFailure } => {
  if (stats.depth > budget.maxDepth) {
    return { ok: false, budget, stats, failure: 'depth-exceeded' }
  }
  if (stats.nodes > budget.maxNodes) {
    return { ok: false, budget, stats, failure: 'node-exceeded' }
  }
  if (stats.bytes > budget.maxBytes) {
    return { ok: false, budget, stats, failure: 'size-exceeded' }
  }
  if (stats.ms > budget.maxMs) {
    return { ok: false, budget, stats, failure: 'time-exceeded' }
  }
  return { ok: true, budget, stats }
}

export interface MarkdownEmbedWalkNode {
  readonly targetId: string
  readonly targetVersion: number
  readonly targetToken: string
  readonly mode: MarkdownEmbedMode
  readonly bytes: number
  readonly children?: readonly MarkdownEmbedWalkNode[]
}

export interface MarkdownEmbedWalkFailure {
  readonly ok: false
  readonly failure: MarkdownEmbedBudgetFailure
  readonly identity: string
  readonly depth: number
  readonly nodes: number
  readonly bytes: number
  readonly ms: number
}

export interface MarkdownEmbedWalkSuccess {
  readonly ok: true
  readonly nodes: number
  readonly bytes: number
  readonly ms: number
  readonly depth: number
  readonly identities: readonly string[]
}

export type MarkdownEmbedWalkResult = MarkdownEmbedWalkSuccess | MarkdownEmbedWalkFailure

export interface MarkdownEmbedBudgetTask {
  readonly id: string
  readonly documentId: string
  readonly documentEpoch: number
  cancelled: boolean
}

export interface MarkdownEmbedBudgetSession {
  readonly budget: MarkdownEmbedBudget
  readonly cache: Map<string, { readonly key: MarkdownEmbedCacheKey; readonly identity: string }>
  readonly tasks: Map<string, MarkdownEmbedBudgetTask>
  createTask(documentId: string, documentEpoch: number): MarkdownEmbedBudgetTask
  cancelTask(id: string): void
  abortDocument(documentId: string, documentEpoch?: number): void
  getCached(key: MarkdownEmbedCacheKey): string | undefined
  setCached(key: MarkdownEmbedCacheKey): string
  walk(input: {
    readonly root: MarkdownEmbedWalkNode
    readonly providerVersion: number
    readonly task?: MarkdownEmbedBudgetTask
    readonly theme?: string
    readonly locale?: string
    readonly feature?: string
    readonly now?: () => number
  }): MarkdownEmbedWalkResult
}

export const createMarkdownEmbedBudgetSession = (
  budget: MarkdownEmbedBudget = MARKDOWN_EMBED_BUDGET,
): MarkdownEmbedBudgetSession => {
  const cache = new Map<string, { readonly key: MarkdownEmbedCacheKey; readonly identity: string }>()
  const tasks = new Map<string, MarkdownEmbedBudgetTask>()
  let taskSeq = 0

  const createTask = (documentId: string, documentEpoch: number): MarkdownEmbedBudgetTask => {
    const live = [...tasks.values()].filter((task) => !task.cancelled).length
    const task: MarkdownEmbedBudgetTask = {
      id: `embed-task-${taskSeq++}`,
      documentId,
      documentEpoch,
      cancelled: live >= budget.maxConcurrent,
    }
    if (!task.cancelled) tasks.set(task.id, task)
    return task
  }

  const cancelTask = (id: string) => {
    const task = tasks.get(id)
    if (task) task.cancelled = true
  }

  const abortDocument = (documentId: string, documentEpoch?: number) => {
    for (const task of tasks.values()) {
      if (task.documentId !== documentId) continue
      if (documentEpoch !== undefined && task.documentEpoch !== documentEpoch) continue
      task.cancelled = true
    }
  }

  const getCached = (key: MarkdownEmbedCacheKey) => cache.get(markdownEmbedCacheKey(key))?.identity

  const setCached = (key: MarkdownEmbedCacheKey) => {
    const identity = markdownEmbedTargetIdentityKey(key)
    const packed = markdownEmbedCacheKey(key)
    if (cache.size >= budget.maxCacheEntries && !cache.has(packed)) {
      const first = cache.keys().next().value
      if (typeof first === 'string') cache.delete(first)
    }
    cache.set(packed, { key: Object.freeze({ ...key }), identity })
    return identity
  }

  const walk = (input: {
    readonly root: MarkdownEmbedWalkNode
    readonly providerVersion: number
    readonly task?: MarkdownEmbedBudgetTask
    readonly theme?: string
    readonly locale?: string
    readonly feature?: string
    readonly now?: () => number
  }): MarkdownEmbedWalkResult => {
    const started = (input.now ?? Date.now)()
    const identities: string[] = []
    let nodes = 0
    let bytes = 0
    let maxDepth = 0
    const stack: { node: MarkdownEmbedWalkNode; path: readonly string[]; depth: number }[] = [
      { node: input.root, path: [], depth: 1 },
    ]
    while (stack.length > 0) {
      if (input.task?.cancelled) {
        return Object.freeze({
          ok: false,
          failure: 'cancelled',
          identity: markdownEmbedTargetIdentityKey(input.root),
          depth: maxDepth,
          nodes,
          bytes,
          ms: (input.now ?? Date.now)() - started,
        })
      }
      const current = stack.pop()!
      const identity = markdownEmbedTargetIdentityKey(current.node)
      if (pathContainsMarkdownEmbedCycle(current.path, identity)) {
        return Object.freeze({
          ok: false,
          failure: 'cycle',
          identity,
          depth: current.depth,
          nodes,
          bytes,
          ms: (input.now ?? Date.now)() - started,
        })
      }
      if (current.depth > budget.maxDepth) {
        return Object.freeze({
          ok: false,
          failure: 'depth-exceeded',
          identity,
          depth: current.depth,
          nodes,
          bytes,
          ms: (input.now ?? Date.now)() - started,
        })
      }
      nodes += 1
      bytes += current.node.bytes
      maxDepth = Math.max(maxDepth, current.depth)
      identities.push(identity)
      const elapsed = (input.now ?? Date.now)() - started
      const stats = evaluateMarkdownEmbedBudget({
        depth: maxDepth,
        nodes,
        bytes,
        ms: elapsed,
      }, budget)
      if (!stats.ok) {
        return Object.freeze({
          ok: false,
          failure: stats.failure ?? 'time-exceeded',
          identity,
          depth: maxDepth,
          nodes,
          bytes,
          ms: elapsed,
        })
      }
      if (input.task && [...tasks.values()].filter((task) => !task.cancelled).length > budget.maxConcurrent) {
        return Object.freeze({
          ok: false,
          failure: 'concurrency-exceeded',
          identity,
          depth: maxDepth,
          nodes,
          bytes,
          ms: elapsed,
        })
      }
      setCached({
        targetId: current.node.targetId,
        targetVersion: current.node.targetVersion,
        mode: current.node.mode,
        providerVersion: input.providerVersion,
        feature: input.feature,
        theme: input.theme,
        locale: input.locale,
      })
      const nextPath = [...current.path, identity]
      const children = current.node.children ?? []
      for (let index = children.length - 1; index >= 0; index -= 1) {
        stack.push({ node: children[index]!, path: nextPath, depth: current.depth + 1 })
      }
    }
    return Object.freeze({
      ok: true,
      nodes,
      bytes,
      ms: (input.now ?? Date.now)() - started,
      depth: maxDepth,
      identities: Object.freeze(identities),
    })
  }

  return {
    budget,
    cache,
    tasks,
    createTask,
    cancelTask,
    abortDocument,
    getCached,
    setCached,
    walk,
  }
}

export const commitMarkdownEmbedWalk = (
  current: { readonly documentId: string; readonly documentEpoch: number },
  result: MarkdownEmbedWalkResult & { readonly documentId?: string; readonly documentEpoch?: number },
  task?: MarkdownEmbedBudgetTask,
): MarkdownEmbedWalkResult => {
  if (task?.cancelled) {
    return Object.freeze({
      ok: false,
      failure: 'cancelled',
      identity: '',
      depth: 0,
      nodes: 0,
      bytes: 0,
      ms: 0,
    })
  }
  if (
    result.documentId !== undefined &&
    (result.documentId !== current.documentId || result.documentEpoch !== current.documentEpoch)
  ) {
    return Object.freeze({
      ok: false,
      failure: 'stale',
      identity: '',
      depth: 0,
      nodes: 0,
      bytes: 0,
      ms: 0,
    })
  }
  return result
}

export type MarkdownEmbedBudgetMutationKind =
  | 'token-only-cache'
  | 'no-cycle-detection'
  | 'unbounded-recursion'
  | 'stale-tree-commit'

export const evaluateMarkdownEmbedBudgetMutations = () => {
  const session = createMarkdownEmbedBudgetSession()
  const article: MarkdownEmbedWalkNode = {
    targetId: 'note-a',
    targetVersion: 1,
    targetToken: 'note',
    mode: 'article',
    bytes: 32,
  }
  session.setCached({
    targetId: article.targetId,
    targetVersion: 1,
    mode: 'article',
    providerVersion: 1,
  })
  const otherMode = session.getCached({
    targetId: article.targetId,
    targetVersion: 1,
    mode: 'heading',
    providerVersion: 1,
  })
  const otherVersion = session.getCached({
    targetId: article.targetId,
    targetVersion: 2,
    mode: 'article',
    providerVersion: 1,
  })
  const tokenOnly =
    markdownEmbedCacheKey({
      targetId: article.targetId,
      targetVersion: 1,
      mode: 'article',
      providerVersion: 1,
    }) === article.targetToken || Boolean(otherMode) || Boolean(otherVersion)

  const cyclic: MarkdownEmbedWalkNode = {
    ...article,
    children: [
      {
        targetId: 'note-b',
        targetVersion: 1,
        targetToken: 'note',
        mode: 'article',
        bytes: 16,
        children: [article],
      },
    ],
  }
  const cycle = session.walk({ root: cyclic, providerVersion: 1 })
  const deep: MarkdownEmbedWalkNode = {
    targetId: 'root',
    targetVersion: 1,
    targetToken: 'root',
    mode: 'article',
    bytes: 8,
    children: [
      {
        targetId: 'd2',
        targetVersion: 1,
        targetToken: 'd2',
        mode: 'article',
        bytes: 8,
        children: [
          {
            targetId: 'd3',
            targetVersion: 1,
            targetToken: 'd3',
            mode: 'article',
            bytes: 8,
            children: [
              {
                targetId: 'd4',
                targetVersion: 1,
                targetToken: 'd4',
                mode: 'article',
                bytes: 8,
                children: [
                  {
                    targetId: 'd5',
                    targetVersion: 1,
                    targetToken: 'd5',
                    mode: 'article',
                    bytes: 8,
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  }
  const unbounded = session.walk({ root: deep, providerVersion: 1 })
  const task = session.createTask('doc', 1)
  session.abortDocument('doc', 1)
  const stale = commitMarkdownEmbedWalk(
    { documentId: 'doc', documentEpoch: 2 },
    { ok: true, nodes: 1, bytes: 8, ms: 0, depth: 1, identities: ['note-a@1'], documentId: 'doc', documentEpoch: 1 },
    task,
  )

  return Object.freeze({
    mutations: Object.freeze([
      Object.freeze({
        kind: 'token-only-cache' as const,
        equivalent: tokenOnly,
        accepted: false,
      }),
      Object.freeze({
        kind: 'no-cycle-detection' as const,
        equivalent: cycle.ok,
        accepted: false,
      }),
      Object.freeze({
        kind: 'unbounded-recursion' as const,
        equivalent: unbounded.ok,
        accepted: false,
      }),
      Object.freeze({
        kind: 'stale-tree-commit' as const,
        equivalent: stale.ok,
        accepted: false,
      }),
    ]),
  })
}
