import { describe, expect, it } from 'vitest'

import {
  MARKDOWN_SEARCH_BUDGET,
  boundMarkdownSearchRegex,
  cancelMarkdownSearchTask,
  commitMarkdownSearchExecution,
  createMarkdownSearchTask,
  evaluateMarkdownSearchWorkerMutations,
  runMarkdownSearchTask,
} from '../markdown-search-worker'
import {
  isMarkdownReplacePlan,
  planMarkdownReplaceAll,
  planMarkdownReplaceCurrent,
} from '../markdown-replace'

describe('search replace and attachment lifecycle', () => {
  it('cancels search tasks and bounds regex', () => {
    const task = createMarkdownSearchTask('t1', 'Alpha')
    cancelMarkdownSearchTask(task)
    expect(task.cancelled).toBe(true)
    expect(boundMarkdownSearchRegex('a+b').test('a+b')).toBe(true)
    expect(() => boundMarkdownSearchRegex('x'.repeat(300))).toThrow(/bound/)
    expect(() => boundMarkdownSearchRegex('(a+)+$')).toThrow(/unsafe/)
  })

  it('runs bounded cancellable search and refuses stale or fake totals', () => {
    const source = `${'hit '.repeat(20)}end`
    const complete = runMarkdownSearchTask({
      requestId: 'q1',
      source,
      query: { text: 'hit', mode: 'plain', queryVersion: 1 },
      documentId: 'doc',
      documentEpoch: 1,
      revision: 3,
    })
    expect(complete.status).toBe('complete')
    expect(complete.total).toBe(complete.matches.length)
    expect(complete.matches[0]?.range.start).toBeGreaterThanOrEqual(0)

    const cancelled = createMarkdownSearchTask('t2', 'hit')
    cancelMarkdownSearchTask(cancelled)
    expect(
      runMarkdownSearchTask({
        requestId: 'q2',
        source,
        query: { text: 'hit', mode: 'plain', queryVersion: 2 },
        documentId: 'doc',
        documentEpoch: 1,
        revision: 3,
        task: cancelled,
      }).status,
    ).toBe('aborted')

    const truncated = runMarkdownSearchTask({
      requestId: 'q3',
      source: 'x '.repeat(500),
      query: { text: 'x', mode: 'plain', queryVersion: 1 },
      documentId: 'doc',
      documentEpoch: 1,
      revision: 1,
      budget: { ...MARKDOWN_SEARCH_BUDGET, maxMatches: 8 },
    })
    expect(truncated.status).toBe('truncated')
    expect(truncated.total).toBeNull()
    expect(truncated.matches).toHaveLength(8)

    const stale = commitMarkdownSearchExecution('current', {
      requestId: 'old',
      status: 'complete',
      matches: complete.matches,
      total: complete.total,
      truncated: false,
    })
    expect(stale.status).toBe('aborted')
    expect(stale.code).toBe('stale')

    const large = 'word '.repeat(25_000)
    const many = runMarkdownSearchTask({
      requestId: 'q4',
      source: large,
      query: { text: 'word', mode: 'whole-word', queryVersion: 1 },
      documentId: 'doc',
      documentEpoch: 2,
      revision: 1,
    })
    expect(many.status === 'complete' || many.status === 'truncated').toBe(true)
    if (many.truncated) expect(many.total).toBeNull()

    const report = evaluateMarkdownSearchWorkerMutations()
    for (const mutation of report.mutations) {
      expect(mutation.accepted).toBe(false)
      expect(mutation.equivalent).toBe(false)
    }
  })

  it('replaces current/all hits with stale checks', () => {
    const document = {
      source: '# Alpha\n',
      documentId: 'doc',
      documentEpoch: 1,
      revision: 1,
      query: { text: 'Alpha', mode: 'plain' as const, queryVersion: 1 },
    }
    const hit = {
      documentId: 'doc',
      documentEpoch: 1,
      revision: 1,
      queryVersion: 1,
      range: { start: 2, end: 7 },
    }
    const current = planMarkdownReplaceCurrent(document, hit, 'Beta')
    expect(isMarkdownReplacePlan(current)).toBe(true)
    expect(
      planMarkdownReplaceCurrent({ ...document, revision: 2 }, hit, 'Beta'),
    ).toEqual({
      rejected: 'stale',
    })
    const all = planMarkdownReplaceAll(
      { ...document, source: '# Alpha\n# Alpha\n' },
      [hit, { ...hit, range: { start: 10, end: 15 } }],
      'Beta',
    )
    expect(isMarkdownReplacePlan(all) && all.changes.length).toBe(2)
  })

})
