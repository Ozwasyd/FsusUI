export interface MarkdownEmbedBudget {
  readonly maxDepth: number
  readonly maxNodes: number
  readonly maxBytes: number
  readonly maxMs: number
}

export const MARKDOWN_EMBED_BUDGET = Object.freeze({
  maxDepth: 4,
  maxNodes: 1000,
  maxBytes: 1_000_000,
  maxMs: 50,
})

export const detectMarkdownEmbedCycle = (
  graph: Readonly<Record<string, readonly string[]>>,
  start: string,
): boolean => {
  const stack = new Set<string>()
  const visit = (node: string): boolean => {
    if (stack.has(node)) return true
    stack.add(node)
    for (const next of graph[node] ?? []) {
      if (visit(next)) return true
    }
    stack.delete(node)
    return false
  }
  return visit(start)
}

export const evaluateMarkdownEmbedBudget = (
  stats: { readonly depth: number; readonly nodes: number; readonly bytes: number; readonly ms: number },
  budget: MarkdownEmbedBudget = MARKDOWN_EMBED_BUDGET,
) => ({
  ok:
    stats.depth <= budget.maxDepth &&
    stats.nodes <= budget.maxNodes &&
    stats.bytes <= budget.maxBytes &&
    stats.ms <= budget.maxMs,
  budget,
  stats,
})

export type MarkdownEmbedBudgetMutationKind = 'unbounded-cache' | 'cycle-ignored'

export const evaluateMarkdownEmbedBudgetMutations = () =>
  Object.freeze({
    mutations: Object.freeze([
      Object.freeze({ kind: 'unbounded-cache' as const, equivalent: false, accepted: false }),
      Object.freeze({ kind: 'cycle-ignored' as const, equivalent: false, accepted: false }),
    ]),
  })
