import {
  createMarkdownHeavyFeatureLifecycle,
  type MarkdownHeavyFeatureIdentity,
} from './index'

export type MarkdownHeavyFeatureLifecycleMutationKind =
  | 'cross-document-reuse'
  | 'feature-local-scheduler'
  | 'hidden-background-loop'
  | 'missing-teardown'
  | 'offscreen-resident-runtime'
  | 'stale-commit'
  | 'unbounded-cache'

export interface MarkdownHeavyFeatureAdapterMutationEvidence {
  readonly featureLocalRetention: Readonly<{ accepted: boolean }>
  readonly featureLocalScheduler: Readonly<{ accepted: boolean }>
  readonly missingTeardown: Readonly<{ accepted: boolean }>
}

export const evaluateMarkdownHeavyFeatureLifecycleMutations = async (
  adapterMutations: MarkdownHeavyFeatureAdapterMutationEvidence,
) => {
  const lifecycle = createMarkdownHeavyFeatureLifecycle({
    maxBytes: 32,
    maxEntries: 1,
  })
  const element = document.createElement('div')
  let resolveRender!: (value: Readonly<{ payload: string }>) => void
  let resourceTeardowns = 0
  const identity = (
    epoch: number,
    nodeId: string,
  ): MarkdownHeavyFeatureIdentity => ({
    config: 'default',
    documentEpoch: epoch,
    documentKey: 'doc',
    featureKind: 'latex',
    gatewayVersion: 'gateway@1',
    locale: 'en',
    nodeId,
    rendererVersion: 'renderer@1',
    revision: 1,
    sourceIdentity: `source:${epoch}:${nodeId}`,
    theme: 'light',
  })
  const pending = lifecycle.activate<Readonly<{ payload: string }>>({
    commit: () => undefined,
    element,
    estimateBytes: (value) => value.payload.length * 2,
    identity: identity(1, 'stale'),
    resources: { runtimes: 1, tasks: 1 },
    render: () =>
      new Promise((resolve) => {
        resolveRender = resolve
      }),
    teardown: () => {
      resourceTeardowns += 1
    },
  })
  lifecycle.unmountRoot(element)
  resolveRender(Object.freeze({ payload: 'stale' }))
  await pending
  let documentRenders = 0
  for (const epoch of [10, 11]) {
    const documentElement = document.createElement('div')
    await lifecycle.activate({
      commit: () => undefined,
      element: documentElement,
      estimateBytes: (value) => value.payload.length * 2,
      identity: {
        ...identity(epoch, 'same-node'),
        sourceIdentity: 'same-source',
      },
      render: async () => {
        documentRenders += 1
        return Object.freeze({ payload: 'same' })
      },
    })
    lifecycle.unmountRoot(documentElement)
  }
  for (const nodeId of ['a', 'b']) {
    await lifecycle.activate({
      commit: () => undefined,
      element,
      estimateBytes: (value) => value.payload.length * 2,
      identity: identity(2, nodeId),
      render: async () => Object.freeze({ payload: nodeId.repeat(12) }),
    })
  }
  const report = lifecycle.metrics()
  lifecycle.dispose()
  return Object.freeze({
    mutations: Object.freeze([
      {
        accepted:
          report.activeNodes > 0 ||
          report.retainedResources > 0 ||
          resourceTeardowns !== 1,
        kind: 'offscreen-resident-runtime' as const,
      },
      { accepted: report.cacheEntries > 1, kind: 'unbounded-cache' as const },
      { accepted: report.staleCommits === 0, kind: 'stale-commit' as const },
      {
        accepted:
          report.teardowns === 0 || adapterMutations.missingTeardown.accepted,
        kind: 'missing-teardown' as const,
      },
      {
        accepted: documentRenders !== 2,
        kind: 'cross-document-reuse' as const,
      },
      {
        accepted: adapterMutations.featureLocalScheduler.accepted,
        kind: 'feature-local-scheduler' as const,
      },
      {
        accepted: adapterMutations.featureLocalRetention.accepted,
        kind: 'hidden-background-loop' as const,
      },
    ]),
    report,
    adapterMutations,
  })
}
