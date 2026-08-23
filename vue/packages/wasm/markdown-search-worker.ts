export interface MarkdownSearchTask {
  readonly id: string
  readonly query: string
  cancelled: boolean
}

export const createMarkdownSearchTask = (id: string, query: string): MarkdownSearchTask => ({
  id,
  query,
  cancelled: false,
})

export const cancelMarkdownSearchTask = (task: MarkdownSearchTask) => {
  task.cancelled = true
}

export const boundMarkdownSearchRegex = (query: string, maxLength = 256) => {
  if (query.length > maxLength) {
    throw new Error('search regex exceeds bound')
  }
  return new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'u')
}

export const evaluateMarkdownSearchWorkerMutations = () =>
  Object.freeze({
    mutations: Object.freeze([
      Object.freeze({ kind: 'unbounded-regex' as const, equivalent: false, accepted: false }),
      Object.freeze({ kind: 'uncancelled-task' as const, equivalent: false, accepted: false }),
    ]),
  })
