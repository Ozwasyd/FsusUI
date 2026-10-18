import { readFileSync } from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'

interface Work {
  element: { name: string }
  context: { kind: string; root: object }
  dependencies: Work[]
  completed: Promise<void>
  complete: () => void
  committed?: boolean
  error?: { kind: string; message: string }
}

const source = readFileSync(
  path.resolve(import.meta.dirname, '../markdown-runtime.ts'),
  'utf8',
)
const parsed = ts.createSourceFile('runtime.ts', source, ts.ScriptTarget.Latest)
const statement = parsed.statements.find(
  (node) =>
    ts.isVariableStatement(node) &&
    node.declarationList.declarations.some(
      (item) => item.name.getText(parsed) === 'activateMarkdownFeatureWork',
    ),
)!
const code = ts.transpileModule(statement.getText(parsed), {
  compilerOptions: { target: ts.ScriptTarget.ESNext },
}).outputText

const makeWork = (name: string, dependencies: Work[] = []): Work => {
  let complete!: () => void
  const completed = new Promise<void>((resolve) => {
    complete = resolve
  })
  return {
    element: { name },
    context: { kind: name, root: {} },
    dependencies,
    completed,
    complete,
  }
}
const flush = async () => {
  for (let index = 0; index < 30; index++) await Promise.resolve()
}
const harness = (stale = new Set<string>()) => {
  const started: string[] = []
  const finish = new Map<
    string,
    { resolve: () => void; reject: (error: Error) => void }
  >()
  let active = 0
  let maxActive = 0
  const run = vm.runInNewContext(`${code}\nactivateMarkdownFeatureWork`, {
    isElementInActivationRoot: (_root: object, element: Work['element']) =>
      !stale.has(element.name),
    activateBuiltInFeature: async (element: Work['element']) => {
      started.push(element.name)
      active += 1
      maxActive = Math.max(maxActive, active)
      try {
        await new Promise<void>((resolve, reject) => {
          finish.set(element.name, { resolve, reject })
        })
        return true
      } finally {
        active -= 1
      }
    },
    createActivationError: (kind: string, error: Error) => ({
      kind,
      message: error.message,
    }),
  }) as (
    batches: { work: Work[] }[],
    concurrency: number,
    signal?: AbortSignal,
  ) => Promise<void>
  return { run, started, finish, maxActive: () => maxActive }
}

describe('Markdown feature activation scheduling', () => {
  it('starts independent work in the genuine five-task graph while both parents are held', async () => {
    const mermaid = makeWork('mermaid')
    const latex = makeWork('latex')
    const nestedMermaid = makeWork('nested-mermaid', [mermaid])
    const nestedLatex = makeWork('nested-latex', [latex])
    const typescript = makeWork('typescript')
    const h = harness(new Set(['nested-mermaid', 'nested-latex']))
    const completion = h.run(
      [{ work: [mermaid, latex, nestedMermaid, nestedLatex, typescript] }],
      3,
    )
    await flush()
    expect(h.started).toEqual(['mermaid', 'latex', 'typescript'])
    expect(mermaid.committed).toBeUndefined()
    expect(latex.committed).toBeUndefined()
    for (const name of h.started) h.finish.get(name)!.resolve()
    await completion
    expect(h.maxActive()).toBe(3)
    expect(nestedMermaid.committed).toBeUndefined()
    expect(nestedLatex.committed).toBeUndefined()
  })

  it.each(['success', 'failure'] as const)(
    'releases children after parent %s without skipping connected fallback work',
    async (outcome) => {
      const parent = makeWork('parent')
      const child = makeWork('child', [parent])
      const h = harness()
      const completion = h.run([{ work: [parent, child] }], 2)
      await flush()
      expect(h.started).toEqual(['parent'])
      if (outcome === 'success') h.finish.get('parent')!.resolve()
      else h.finish.get('parent')!.reject(new Error('parent failed'))
      await flush()
      expect(h.started).toEqual(['parent', 'child'])
      h.finish.get('child')!.resolve()
      await completion
      expect(child.committed).toBe(true)
      expect(parent.error?.message).toBe(
        outcome === 'failure' ? 'parent failed' : undefined,
      )
    },
  )

  it.each([1, 3])(
    'settles idle workers and suppresses queued/dependent commits after cancellation at capacity %s',
    async (capacity) => {
      const parent = makeWork('parent')
      const child = makeWork('child', [parent])
      const later = makeWork('later')
      const controller = new AbortController()
      const h = harness()
      const completion = h.run(
        [{ work: [parent, child, later] }],
        capacity,
        controller.signal,
      )
      await flush()
      controller.abort()
      for (const task of h.finish.values()) task.resolve()
      await completion
      expect(h.started).toEqual(
        capacity === 1 ? ['parent'] : ['parent', 'later'],
      )
      expect(parent.committed).toBeUndefined()
      expect(later.committed).toBeUndefined()
      const alreadyAborted = harness()
      await alreadyAborted.run(
        [{ work: [makeWork('never')] }],
        2,
        controller.signal,
      )
      expect(alreadyAborted.started).toEqual([])
    },
  )

  it('does not let an aborted activation suppress a replacement generation', async () => {
    const controller = new AbortController()
    const h = harness()
    const oldParent = makeWork('old-parent')
    const obsolete = makeWork('obsolete', [oldParent])
    const oldCompletion = h.run(
      [{ work: [oldParent, obsolete] }],
      2,
      controller.signal,
    )
    await flush()
    controller.abort()
    const nextParent = makeWork('next-parent')
    const nextChild = makeWork('next-child', [nextParent])
    const nextCompletion = h.run([{ work: [nextParent, nextChild] }], 2)
    await flush()
    h.finish.get('old-parent')!.resolve()
    await oldCompletion
    expect(h.started).toEqual(['old-parent', 'next-parent'])
    expect(oldParent.committed).toBeUndefined()
    h.finish.get('next-parent')!.resolve()
    await flush()
    expect(h.started).toEqual(['old-parent', 'next-parent', 'next-child'])
    h.finish.get('next-child')!.resolve()
    await nextCompletion
    expect(nextChild.committed).toBe(true)
  })

  it('keeps ready work FIFO and appends newly released children without exceeding capacity', async () => {
    const parent = makeWork('parent')
    const child = makeWork('child', [parent])
    const h = harness()
    const completion = h.run(
      [{ work: [parent, child, makeWork('second'), makeWork('third')] }],
      1,
    )
    await flush()
    for (const name of ['parent', 'second', 'third', 'child']) {
      expect(h.started.at(-1)).toBe(name)
      h.finish.get(name)!.resolve()
      await flush()
    }
    await completion
    expect(h.started).toEqual(['parent', 'second', 'third', 'child'])
    expect(h.maxActive()).toBe(1)
  })

  it('checks stale queued roots at execution and isolates repeated scheduling', async () => {
    const stale = new Set<string>()
    const h = harness(stale)
    for (let iteration = 0; iteration < 3; iteration++) {
      stale.clear()
      h.started.length = 0
      h.finish.clear()
      const parent = makeWork('parent')
      const child = makeWork('child', [parent])
      const queued = makeWork('queued')
      const completion = h.run([{ work: [parent, child, queued] }], 1)
      await flush()
      stale.add('child')
      stale.add('queued')
      h.finish.get('parent')!.resolve()
      await completion
      expect(h.started).toEqual(['parent'])
      expect(child.committed).toBeUndefined()
      expect(queued.committed).toBeUndefined()
    }
  })

  it.each(['cycle', 'external', 'duplicate'] as const)(
    'refuses an invalid internal %s graph before starting work',
    async (invalid) => {
      const first = makeWork('first')
      const second = makeWork('second', [first])
      const h = harness()
      let work = [first, second]
      if (invalid === 'cycle') first.dependencies = [second]
      if (invalid === 'external') first.dependencies = [makeWork('external')]
      if (invalid === 'duplicate') work = [first, first]
      await expect(h.run([{ work }], 2)).rejects.toThrow(
        'markdown_feature_activation_dependency_invalid',
      )
      expect(h.started).toEqual([])
    },
  )
})
