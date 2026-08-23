import { describe, expect, it } from 'vitest'

import {
  boundMarkdownSearchRegex,
  cancelMarkdownSearchTask,
  createMarkdownSearchTask,
} from '../markdown-search-worker'
import { planMarkdownReplaceAll, planMarkdownReplaceCurrent } from '../markdown-replace'

describe('search replace and attachment lifecycle', () => {
  it('cancels search tasks and bounds regex', () => {
    const task = createMarkdownSearchTask('t1', 'Alpha')
    cancelMarkdownSearchTask(task)
    expect(task.cancelled).toBe(true)
    expect(boundMarkdownSearchRegex('a+b').test('a+b')).toBe(true)
    expect(() => boundMarkdownSearchRegex('x'.repeat(300))).toThrow(/bound/)
  })

  it('replaces current/all hits with stale checks', () => {
    const hit = {
      id: 'syn:heading:0',
      kind: 'heading',
      range: { start: 2, end: 7 },
      query: 'Alpha',
    }
    const current = planMarkdownReplaceCurrent('# Alpha\n', hit, 'Beta', 1, 1)
    expect('changes' in current).toBe(true)
    expect(planMarkdownReplaceCurrent('# Alpha\n', hit, 'Beta', 1, 2)).toEqual({
      rejected: 'stale',
    })
    const all = planMarkdownReplaceAll('# Alpha\n# Alpha\n', [hit, { ...hit, range: { start: 10, end: 15 } }], 'Beta', 1, 1)
    expect('changes' in all && all.changes.length).toBe(2)
  })

})
