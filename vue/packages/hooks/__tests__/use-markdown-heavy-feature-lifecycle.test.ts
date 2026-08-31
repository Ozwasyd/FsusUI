import { describe, expect, it } from 'vitest'

import {
  createMarkdownHeavyFeatureLifecycle,
  evaluateMarkdownHeavyFeatureLifecycleMutations,
  type MarkdownHeavyFeatureIdentity,
  type MarkdownHeavyFeatureKind,
} from '../use-markdown-heavy-feature-lifecycle'

const identity = (
  kind: MarkdownHeavyFeatureKind,
  overrides: Partial<MarkdownHeavyFeatureIdentity> = {},
): MarkdownHeavyFeatureIdentity => ({
  config: 'default',
  documentEpoch: 1,
  documentKey: 'doc-a',
  featureKind: kind,
  gatewayVersion: 'gateway@1',
  locale: 'en',
  nodeId: `${kind}-node`,
  rendererVersion: 'renderer@1',
  revision: 1,
  sourceIdentity: 'source-a',
  theme: 'light',
  ...overrides,
})

const activate = (
  lifecycle: ReturnType<typeof createMarkdownHeavyFeatureLifecycle>,
  featureIdentity: MarkdownHeavyFeatureIdentity,
  element: HTMLElement,
  render: () => Promise<Readonly<{ payload: string }>>,
  commit: (value: Readonly<{ payload: string }>) => void = () => undefined,
) =>
  lifecycle.activate({
    commit,
    element,
    estimateBytes: (value) => value.payload.length * 2,
    identity: featureIdentity,
    render,
  })

describe('markdown heavy feature lifecycle', () => {
  it('starts empty and keeps no resident scheduler or resource', () => {
    const lifecycle = createMarkdownHeavyFeatureLifecycle()
    expect(lifecycle.metrics()).toMatchObject({
      activeNodes: 0,
      cacheBytes: 0,
      cacheEntries: 0,
      staticNodes: 0,
    })
  })

  it('runs code, Mermaid, and LaTeX through one active-to-static authority', async () => {
    const lifecycle = createMarkdownHeavyFeatureLifecycle()
    const kinds = ['code-highlight', 'mermaid', 'latex'] as const
    for (const kind of kinds) {
      await activate(
        lifecycle,
        identity(kind),
        document.createElement('div'),
        async () => Object.freeze({ payload: kind }),
      )
    }
    expect(lifecycle.metrics()).toMatchObject({
      activations: 3,
      activeNodes: 0,
      cacheEntries: 3,
      staticNodes: 3,
    })
  })

  it('reuses immutable output without rerendering and still commits it', async () => {
    const lifecycle = createMarkdownHeavyFeatureLifecycle()
    const featureIdentity = identity('mermaid')
    let renders = 0
    let commits = 0
    const render = async () => {
      renders += 1
      return Object.freeze({ payload: '<svg />' })
    }
    const commit = () => {
      commits += 1
    }
    const first = document.createElement('div')
    await activate(lifecycle, featureIdentity, first, render, commit)
    lifecycle.unmountRoot(first)
    await activate(
      lifecycle,
      featureIdentity,
      document.createElement('div'),
      render,
      commit,
    )
    expect({ commits, renders }).toEqual({ commits: 2, renders: 1 })
    expect(lifecycle.metrics().reuses).toBe(1)
  })

  it('aborts offscreen work and rejects its stale result', async () => {
    const lifecycle = createMarkdownHeavyFeatureLifecycle()
    const element = document.createElement('div')
    let resolve!: (value: Readonly<{ payload: string }>) => void
    let commits = 0
    const pending = activate(
      lifecycle,
      identity('latex'),
      element,
      () => new Promise((next) => (resolve = next)),
      () => {
        commits += 1
      },
    )
    lifecycle.unmountRoot(element)
    resolve(Object.freeze({ payload: 'late' }))
    await pending
    expect(commits).toBe(0)
    expect(lifecycle.metrics()).toMatchObject({
      aborts: 1,
      activeNodes: 0,
      staleCommits: 1,
      teardowns: 1,
    })
  })

  it('removes externally aborted work instead of retaining an active record', async () => {
    const lifecycle = createMarkdownHeavyFeatureLifecycle()
    const controller = new AbortController()
    const element = document.createElement('div')
    let resolve!: (value: Readonly<{ payload: string }>) => void
    const pending = lifecycle.activate<Readonly<{ payload: string }>>({
      commit: () => undefined,
      element,
      estimateBytes: (value) => value.payload.length * 2,
      identity: identity('latex'),
      render: () => new Promise((next) => (resolve = next)),
      signal: controller.signal,
    })
    controller.abort()
    resolve(Object.freeze({ payload: 'late' }))
    await pending
    expect(lifecycle.metrics()).toMatchObject({
      activeNodes: 0,
      staleCommits: 1,
      staticNodes: 0,
    })
  })

  it('rejects nested mutable cache values and non-finite byte estimates', async () => {
    const lifecycle = createMarkdownHeavyFeatureLifecycle()
    const element = document.createElement('div')
    await lifecycle.activate({
      commit: () => undefined,
      element,
      estimateBytes: () => Number.NaN,
      identity: identity('mermaid'),
      render: async () => Object.freeze({ nested: { payload: 'mutable' } }),
    })
    expect(lifecycle.metrics()).toMatchObject({
      cacheBytes: 0,
      cacheEntries: 0,
      staleCommits: 1,
    })
  })

  it('does not collide when exact identity fields contain separators', async () => {
    const lifecycle = createMarkdownHeavyFeatureLifecycle()
    let renders = 0
    for (const featureIdentity of [
      identity('latex', { documentKey: 'a\u0000b', nodeId: 'c' }),
      identity('latex', { documentKey: 'a', nodeId: 'b\u0000c' }),
    ]) {
      const element = document.createElement('div')
      await activate(lifecycle, featureIdentity, element, async () => {
        renders += 1
        return Object.freeze({ payload: String(renders) })
      })
      lifecycle.unmountRoot(element)
    }
    expect(renders).toBe(2)
    expect(lifecycle.metrics().cacheEntries).toBe(2)
  })

  it('isolates identical source across documents and evicts to exact budgets', async () => {
    const lifecycle = createMarkdownHeavyFeatureLifecycle({
      maxBytes: 16,
      maxEntries: 1,
    })
    let renders = 0
    for (const documentEpoch of [1, 2]) {
      await activate(
        lifecycle,
        identity('code-highlight', {
          documentEpoch,
          nodeId: 'same-node',
          sourceIdentity: 'same-source',
        }),
        document.createElement('pre'),
        async () => {
          renders += 1
          return Object.freeze({ payload: '12345678' })
        },
      )
    }
    expect(renders).toBe(2)
    expect(lifecycle.metrics()).toMatchObject({
      cacheBytes: 16,
      cacheEntries: 1,
      evictions: 1,
      reuses: 0,
    })
  })

  it('keys material theme/config/version changes without clearing unrelated cache', async () => {
    const lifecycle = createMarkdownHeavyFeatureLifecycle()
    let renders = 0
    const run = async (overrides: Partial<MarkdownHeavyFeatureIdentity>) => {
      const element = document.createElement('div')
      await activate(
        lifecycle,
        identity('latex', overrides),
        element,
        async () => {
          renders += 1
          return Object.freeze({ payload: `render-${renders}` })
        },
      )
      lifecycle.unmountRoot(element)
    }
    await run({ theme: 'light' })
    await run({ theme: 'dark' })
    await run({ config: 'strict', theme: 'dark' })
    await run({ rendererVersion: 'renderer@2', theme: 'dark' })
    await run({ theme: 'light' })
    expect(renders).toBe(4)
    expect(lifecycle.metrics()).toMatchObject({ cacheEntries: 4, reuses: 1 })
  })

  it('kills the required lifecycle mutation fixtures', async () => {
    const report = await evaluateMarkdownHeavyFeatureLifecycleMutations()
    expect(report.mutations).toHaveLength(6)
    expect(report.mutations.every((mutation) => !mutation.accepted)).toBe(true)
  })
})
