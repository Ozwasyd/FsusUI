import { describe, expect, it } from 'vitest'

import {
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
      status: 'resolved',
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
    const report = evaluateMarkdownEmbedProviderMutations(request)
    for (const mutation of report.mutations) {
      expect(mutation.accepted).toBe(false)
    }
  })
})
