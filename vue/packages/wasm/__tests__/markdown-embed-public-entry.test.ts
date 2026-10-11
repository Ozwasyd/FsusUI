import { webcrypto } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as markdown from '../../element-plus/markdown-runtime'
import * as wasm from '../../element-plus/wasm'
import * as provider from '../markdown-embed-provider'
import { resolveMarkdownEmbedPresentation } from '../markdown-embed-presentation'
import fixture from '../../../tests/consumer-install/markdown-embed-projection-blog-coordinate.json'

beforeEach(() => vi.stubGlobal('crypto', webcrypto))
afterEach(() => vi.unstubAllGlobals())

describe('public Markdown embed entry identity', () => {
  it('shares the editor provider and presentation through both public entries', () => {
    for (const entry of [markdown, wasm]) {
      expect(entry.createMarkdownEmbedRequest).toBe(
        provider.createMarkdownEmbedRequest,
      )
      expect(entry.createMarkdownEmbedProjectionRequest).toBe(
        provider.createMarkdownEmbedProjectionRequest,
      )
      expect(entry.prepareMarkdownEmbedResult).toBe(
        provider.prepareMarkdownEmbedResult,
      )
      expect(entry.commitMarkdownEmbedResult).toBe(
        provider.commitMarkdownEmbedResult,
      )
      expect(entry.cancelMarkdownEmbedRequest).toBe(
        provider.cancelMarkdownEmbedRequest,
      )
      expect(entry.resolveMarkdownEmbedPresentation).toBe(
        resolveMarkdownEmbedPresentation,
      )
    }
  })

  it.each([
    ['markdown-runtime', markdown, wasm],
    ['wasm', wasm, markdown],
  ] as const)(
    'keeps real preparation, private proof and cancellation current across %s',
    async (_name, producer, consumer) => {
      const target = fixture.coordinate.target.portableArticleIdentity
      const coordinate = {
        targetIdentity: target,
        resolvedRevision: String(fixture.coordinate.resolvedRevision),
        targetVersionIdentity: fixture.coordinate.targetVersionIdentity,
        projectionIdentity: fixture.projection.projectionIdentity,
        projectionDigest: fixture.projection.contentDigest,
      }
      let current = coordinate
      const request = await producer.createMarkdownEmbedProjectionRequest({
        documentIdentity: { id: 'public:文章:😀:host', epoch: 17 },
        revision: 0,
        nodeId: 'public-entry-node',
        target,
        mode: 'article',
        version: 1,
      })
      try {
        expect(request.requestDigest).toMatch(/^[a-f0-9]{64}$/)
        const result = await producer.prepareMarkdownEmbedResult(
          request,
          {
            ...request,
            status: 'resolved',
            targetVersion: coordinate,
            projection: {
              kind: 'markdown-reference',
              projectionIdentity: coordinate.projectionIdentity,
              contentDigest: coordinate.projectionDigest,
            },
          },
          {
            readTargetVersion: () => current,
            resolveMarkdown: () => fixture.source,
          },
        )
        expect(result.status).toBe('resolved')
        expect(consumer.commitMarkdownEmbedResult(request, result)).toBe(result)
        expect(provider.commitMarkdownEmbedResult(request, result)).toBe(result)
        expect(provider.readMarkdownEmbedProjection(result)).toBe(
          fixture.source,
        )
        const [node] = consumer.collectMarkdownEmbedNodes(
          `::embed[target="${target}" mode="article"]`,
        )
        expect(
          consumer.resolveMarkdownEmbedPresentation(
            { kind: 'valid', node, result, request },
            'preview',
          ).content.markdown,
        ).toBe(fixture.source)

        const clone = { ...result }
        expect(consumer.commitMarkdownEmbedResult(request, clone).reason).toBe(
          'projection-unverified',
        )
        expect(provider.readMarkdownEmbedProjection(clone)).toBeNull()

        current = {
          ...coordinate,
          resolvedRevision: `${coordinate.resolvedRevision}:next`,
        }
        expect(consumer.commitMarkdownEmbedResult(request, result).status).toBe(
          'stale',
        )
        expect(provider.readMarkdownEmbedProjection(result)).toBeNull()
        current = coordinate
        expect(consumer.commitMarkdownEmbedResult(request, result)).toBe(result)

        consumer.cancelMarkdownEmbedRequest(request.requestId)
        expect(request.signal?.aborted).toBe(true)
        expect(producer.commitMarkdownEmbedResult(request, result).status).toBe(
          'stale',
        )
        expect(provider.readMarkdownEmbedProjection(result)).toBeNull()
      } finally {
        producer.cancelMarkdownEmbedRequest(request)
      }
    },
  )
})
