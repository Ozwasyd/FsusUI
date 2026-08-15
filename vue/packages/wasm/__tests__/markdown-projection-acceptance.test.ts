import { describe, expect, it } from 'vitest'

import {
  MARKDOWN_PROJECTION_ACCEPTANCE_VERSION,
  MARKDOWN_PROJECTION_INVALIDATION_BUDGET,
  evaluateMarkdownProjectionAcceptance,
} from '../markdown-runtime'

describe('markdown projection acceptance gate', () => {
  it('accepts the landed coordinate, projection, identity, invalidation, and anchor contracts', () => {
    const report = evaluateMarkdownProjectionAcceptance()
    expect(report.version).toBe(MARKDOWN_PROJECTION_ACCEPTANCE_VERSION)
    expect(report.threadsEquivalent).toBe(true)
    expect(report.coordinateThreadsEquivalent).toBe(true)
    expect(report.staleRejected).toBe(true)
    expect(report.documentSwitchRejected).toBe(true)
    expect(report.deletedAnchorRejected).toBe(true)
    expect(report.projectionMutationsRejected).toBe(true)
    expect(report.identityMutationsRejected).toBe(true)
    expect(report.anchorMutationsRejected).toBe(true)
    expect(report.accepted).toBe(true)
    expect(report.budgets).toEqual({
      version: MARKDOWN_PROJECTION_ACCEPTANCE_VERSION,
      maxScannedBytes: MARKDOWN_PROJECTION_INVALIDATION_BUDGET.maxScannedBytes,
      maxExaminedNodes: MARKDOWN_PROJECTION_INVALIDATION_BUDGET.maxExaminedNodes,
    })
  })

  it('still rejects HTML reverse and stale commits on a consumer-owned source', () => {
    const report = evaluateMarkdownProjectionAcceptance({
      source: '# Alpha\n\n# Alpha\n\nNot \\[escaped](no) then [same](a) and [same](b)\n',
      documentIdentity: { id: 'gate-doc', epoch: 3 },
    })
    expect(report.documentIdentity).toEqual({ id: 'gate-doc', epoch: 3 })
    expect(report.projectionMutationsRejected).toBe(true)
    expect(report.staleRejected).toBe(true)
    expect(report.accepted).toBe(true)
  })
})
