import { createHash, webcrypto } from 'node:crypto'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  cancelMarkdownEmbedRequest,
  createMarkdownEmbedProjectionRequest,
  prepareMarkdownEmbedResult,
  readMarkdownEmbedProjection,
  commitMarkdownEmbedResult,
  createMarkdownEmbedRequest,
  evaluateMarkdownEmbedProviderMutations,
} from '../markdown-runtime'

describe('markdown embed consumer provider', () => {
  it('binds request identity and rejects stale results', async () => {
    const request = createMarkdownEmbedRequest({
      documentIdentity: { id: 'doc', epoch: 1 },
      revision: 3,
      nodeId: 'syn:embed:1',
      target: 'note-a',
      mode: 'article',
      version: 1,
    })
    const provider = async (current) => ({
      requestId: current.requestId,
      status: 'resolved' as const,
      target: current.target,
      mode: current.mode,
      version: current.version,
      documentIdentity: current.documentIdentity,
      revision: current.revision,
      nodeId: current.nodeId,
      title: 'Note A',
    })
    const result = commitMarkdownEmbedResult(request, await provider(request))
    expect(result.status).toBe('resolved')
    expect(result.title).toBe('Note A')
    const stale = commitMarkdownEmbedResult(request, {
      ...result,
      version: 2,
    })
    expect(stale.status).toBe('stale')
    expect(stale.title).toBeUndefined()
    const report = evaluateMarkdownEmbedProviderMutations(request)
    for (const mutation of report.mutations) {
      expect(mutation.accepted).toBe(false)
    }
    expect(report.mutations.map((mutation) => mutation.kind)).toEqual(
      expect.arrayContaining([
        'stale-commit',
        'html-result',
        'provider-source-mutation',
        'target-only-cache',
      ]),
    )
    const otherDoc = createMarkdownEmbedRequest({
      documentIdentity: { id: 'other', epoch: 1 },
      revision: 3,
      nodeId: 'syn:embed:1',
      target: 'note-a',
      mode: 'article',
      version: 1,
    })
    expect(otherDoc.requestId).not.toBe(request.requestId)
  })
})

const projectionFixture = async (source = 'Verified **body**.\n') => {
  vi.stubGlobal('crypto', webcrypto)
  const request = await createMarkdownEmbedProjectionRequest({
    documentIdentity: { id: 'host', epoch: 3 },
    revision: 8,
    nodeId: 'embed-one',
    target: 'opaque-target',
    mode: 'article',
    version: 2,
  })
  const contentDigest = createHash('sha256').update(source).digest('hex')
  const targetVersion = Object.freeze({
    targetIdentity: 'opaque-business-identity',
    resolvedRevision: '17',
    targetVersionIdentity: 'opaque-version',
    projectionIdentity: 'opaque-projection',
    projectionDigest: contentDigest,
  })
  const result = {
    ...request,
    status: 'resolved' as const,
    targetVersion,
    projection: {
      kind: 'markdown' as const,
      projectionIdentity: targetVersion.projectionIdentity,
      contentDigest,
      source,
    },
  }
  return {
    request,
    result,
    authority: { readTargetVersion: () => targetVersion },
  }
}

afterEach(() => vi.unstubAllGlobals())

describe('controlled embed projection transport', () => {
  it('snapshots host identity and the full request digest, and freezes verified bytes', async () => {
    const identity = { id: 'host', epoch: 3 }
    const request = createMarkdownEmbedRequest({
      documentIdentity: identity,
      revision: 8,
      nodeId: 'one',
      target: 'opaque',
      mode: 'article',
      version: 2,
    })
    identity.epoch = 4
    expect(request.documentIdentity.epoch).toBe(3)
    const fixture = await projectionFixture()
    const result = await prepareMarkdownEmbedResult(
      fixture.request,
      fixture.result,
      fixture.authority,
    )
    expect(Object.isFrozen(result)).toBe(true)
    expect(Object.isFrozen(result.projection)).toBe(true)
    expect(fixture.request.requestDigest).toMatch(/^[a-f0-9]{64}$/)
    expect(commitMarkdownEmbedResult(fixture.request, result)).toBe(result)
    expect(readMarkdownEmbedProjection(result)).toBe(
      fixture.result.projection.source,
    )
    cancelMarkdownEmbedRequest(fixture.request)
    expect(readMarkdownEmbedProjection(result)).toBeNull()
  })

  it('preserves legacy metadata providers that omit the new digest field', async () => {
    const { request } = await projectionFixture()
    const legacy = {
      requestId: request.requestId,
      documentIdentity: request.documentIdentity,
      revision: request.revision,
      nodeId: request.nodeId,
      target: request.target,
      mode: request.mode,
      version: request.version,
      status: 'resolved' as const,
      title: 'Legacy metadata',
    }
    expect(commitMarkdownEmbedResult(request, legacy)).toBe(legacy)
  })

  it('enforces the existing byte budget before digest verification', async () => {
    const fixture = await projectionFixture('😀'.repeat(260_000))
    expect(
      (
        await prepareMarkdownEmbedResult(
          fixture.request,
          fixture.result,
          fixture.authority,
        )
      ).status,
    ).toBe('size-exceeded')
  })

  it('times out a local reference without admitting its late completion', async () => {
    const fixture = await projectionFixture()
    let finish!: (source: string) => void
    const work = prepareMarkdownEmbedResult(
      fixture.request,
      {
        ...fixture.result,
        projection: {
          kind: 'markdown-reference',
          projectionIdentity: fixture.result.projection.projectionIdentity,
          contentDigest: fixture.result.projection.contentDigest,
        },
      },
      {
        ...fixture.authority,
        resolveMarkdown: (_reference, request) =>
          new Promise<string>((resolve) => {
            finish = resolve
            expect(request.signal).toBeDefined()
          }),
      },
    )
    expect((await work).status).toBe('time-exceeded')
    finish(fixture.result.projection.source)
    await new Promise((resolve) => setTimeout(resolve, 0))
  })

  it('bounds unresolved reference work without an unbounded retained map', async () => {
    const fixture = await projectionFixture()
    const finish: ((source: string) => void)[] = []
    const result = {
      ...fixture.result,
      projection: {
        kind: 'markdown-reference' as const,
        projectionIdentity: fixture.result.projection.projectionIdentity,
        contentDigest: fixture.result.projection.contentDigest,
      },
    }
    const authority = {
      ...fixture.authority,
      resolveMarkdown: () =>
        new Promise<string>((resolve) => {
          finish.push(resolve)
        }),
    }
    const work = Array.from({ length: 4 }, () =>
      prepareMarkdownEmbedResult(fixture.request, result, authority),
    )
    expect(
      (await prepareMarkdownEmbedResult(fixture.request, result, authority))
        .status,
    ).toBe('rejected')
    finish.forEach((resolve) => resolve(fixture.result.projection.source))
    expect(
      (await Promise.all(work)).every((each) => each.status === 'resolved'),
    ).toBe(true)
  })

  it.each([
    'missing',
    'forbidden',
    'deleted',
    'unsupported',
    'mode-mismatch',
  ] as const)(
    'keeps %s a classified failure with no projection',
    async (status) => {
      const fixture = await projectionFixture()
      const result = { ...fixture.request, status }
      expect(
        await prepareMarkdownEmbedResult(
          fixture.request,
          result,
          fixture.authority,
        ),
      ).toBe(result)
      expect(readMarkdownEmbedProjection(result)).toBeNull()
    },
  )

  it('refuses unsupported projection kinds, accessors and executable properties', async () => {
    const fixture = await projectionFixture()
    const unknown = {
      ...fixture.result,
      projection: { ...fixture.result.projection, kind: 'safe-projection' },
    }
    expect(
      (
        await prepareMarkdownEmbedResult(
          fixture.request,
          unknown as typeof fixture.result,
          fixture.authority,
        )
      ).status,
    ).toBe('unsupported')
    const executable = { ...fixture.result, component: () => null }
    expect(commitMarkdownEmbedResult(fixture.request, executable).status).toBe(
      'rejected',
    )
    const accessor = Object.defineProperty({ ...fixture.result }, 'html', {
      get: () => {
        throw new Error('must not read')
      },
    })
    expect(commitMarkdownEmbedResult(fixture.request, accessor).status).toBe(
      'rejected',
    )
  })
})
