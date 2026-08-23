import { describe, expect, it } from 'vitest'

import {
  createMarkdownAttachmentRequest,
  evaluateMarkdownAttachmentMutations,
} from '../src/markdown-editor-attachment'
import {
  cancelMarkdownAttachmentJob,
  createMarkdownAttachmentJob,
  progressMarkdownAttachmentJob,
} from '../src/markdown-editor-attachment-lifecycle'

describe('markdown attachment provider contract', () => {
  it('keeps consumer-owned request identity', () => {
    const request = createMarkdownAttachmentRequest(
      'paste',
      {
        documentIdentity: { id: 'doc', epoch: 1 },
        revision: 2,
        nodeId: null,
        sourceOffset: 4,
      },
      'image/png',
    )
    expect(request.requestId).toContain('doc')
    expect(request.intent).toBe('paste')
    const report = evaluateMarkdownAttachmentMutations(request)
    expect(report.mutations.every((mutation) => mutation.accepted === false)).toBe(true)
    const job = createMarkdownAttachmentJob('att-1')
    progressMarkdownAttachmentJob(job, 40)
    expect(job.phase).toBe('progress')
    cancelMarkdownAttachmentJob(job)
    expect(job.phase).toBe('cancelled')
  })
})
