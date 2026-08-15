import { describe, expect, it } from 'vitest'

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import {
  MARKDOWN_PROJECTION_ACCEPTANCE_SCALE,
  MARKDOWN_PROJECTION_ACCEPTANCE_VERSION,
  MARKDOWN_PROJECTION_INVALIDATION_BUDGET,
  createMarkdownOutlineEntries,
  createMarkdownPropertyEntries,
  createMarkdownTableEntries,
  createMarkdownTechnicalEntries,
  evaluateMarkdownProjectionAcceptance,
  recordMarkdownProjectionAcceptanceScale,
  searchMarkdownStableProjection,
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

  it(
    'records parser, projector, invalidation, identity, and memory on a 100k/3000/10000 fixture',
    () => {
      const record = recordMarkdownProjectionAcceptanceScale()
      expect(record.version).toBe(MARKDOWN_PROJECTION_ACCEPTANCE_VERSION)
      expect(record.sourceChars).toBeGreaterThanOrEqual(
        MARKDOWN_PROJECTION_ACCEPTANCE_SCALE.minSourceChars,
      )
      expect(record.blockCount).toBeGreaterThanOrEqual(
        MARKDOWN_PROJECTION_ACCEPTANCE_SCALE.minBlocks,
      )
      expect(record.headingCount).toBeGreaterThanOrEqual(
        MARKDOWN_PROJECTION_ACCEPTANCE_SCALE.minHeadings,
      )
      expect(record.parserDurationMs).toBeGreaterThan(0)
      expect(record.projectorDurationMs).toBeGreaterThanOrEqual(0)
      expect(record.taskId.length).toBeGreaterThan(0)
      expect(record.aborted).toBe(false)
      expect(record.invalidatedRangeCount).toBeGreaterThan(0)
      expect(record.preservedIdentityCount).toBeGreaterThan(record.headingCount - 8)
      expect(record.retainedNodeCount).toBe(record.preservedIdentityCount)
      expect(record.budget.scannedBytes).toBeLessThanOrEqual(
        record.budget.maxScannedBytes + 2,
      )
      expect(record.budget.examinedNodes).toBeLessThanOrEqual(
        record.budget.maxExaminedNodes,
      )
      expect(record.budget.scannedBytes).toBeLessThan(record.sourceChars / 10)
      expect(Number.isFinite(record.heapUsedBefore)).toBe(true)
      expect(Number.isFinite(record.heapUsedAfter)).toBe(true)
      expect(Number.isFinite(record.heapDelta)).toBe(true)
    },
    30_000,
  )

  it('keeps the Contract V2 projection registry aligned with shipped consumer exports', () => {
    const registry = JSON.parse(
      readFileSync(
        resolve(
          process.cwd(),
          'spec/components/contracts/v2/markdown-runtime-projection.json',
        ),
        'utf8',
      ),
    ) as {
      version: string
      scale: { minSourceChars: number; minBlocks: number; minHeadings: number }
      budgets: { maxScannedBytes: number; maxExaminedNodes: number }
      consumers: Array<{ export: string }>
    }
    const shipped = {
      createMarkdownOutlineEntries,
      createMarkdownTableEntries,
      searchMarkdownStableProjection,
      createMarkdownTechnicalEntries,
      createMarkdownPropertyEntries,
    }
    expect(registry.version).toBe(MARKDOWN_PROJECTION_ACCEPTANCE_VERSION)
    expect(registry.scale).toEqual(MARKDOWN_PROJECTION_ACCEPTANCE_SCALE)
    expect(registry.budgets.maxScannedBytes).toBe(
      MARKDOWN_PROJECTION_INVALIDATION_BUDGET.maxScannedBytes,
    )
    expect(registry.consumers.map((consumer) => consumer.export)).toEqual(
      Object.keys(shipped),
    )
    expect(
      registry.consumers.every(
        (consumer) => typeof shipped[consumer.export as keyof typeof shipped] === 'function',
      ),
    ).toBe(true)
  })
})
