import { afterEach, describe, expect, it, vi } from 'vitest'
import * as projections from '../markdown-editor-projection'
import { createMarkdownHeavyFeatureProjectionTracker } from '../markdown-heavy-feature-identity'

const source =
  '```ts\nconst value = 1\n```\n\n$$\nx^2\n$$\n\n```mermaid\nflowchart LR\n A --> B\n```\n'
const input = { documentKey: 'document-a', documentEpoch: 1, source }
afterEach(() => vi.restoreAllMocks())

describe('heavy feature source projection reuse', () => {
  it('projects once for repeated mounted chunks without changing frozen node identities', () => {
    const project = vi.spyOn(projections, 'createMarkdownEditorProjection')
    const tracker = createMarkdownHeavyFeatureProjectionTracker()
    const first = tracker.project(input)!
    for (let chunk = 0; chunk < 32; chunk++) {
      expect(tracker.project({ ...input })).toBe(first)
    }
    expect(project).toHaveBeenCalledTimes(1)
    expect(first.nodeIds['code-highlight']).toHaveLength(1)
    expect(first.nodeIds.latex).toHaveLength(1)
    expect(first.nodeIds.mermaid).toHaveLength(1)
    expect(Object.isFrozen(first)).toBe(true)
    expect(Object.isFrozen(first.nodeIds)).toBe(true)
    for (const ids of Object.values(first.nodeIds))
      expect(Object.isFrozen(ids)).toBe(true)
  })

  it('retains the same edit lineage as a tracker with no repeated activations', () => {
    const tracker = createMarkdownHeavyFeatureProjectionTracker()
    const oracle = createMarkdownHeavyFeatureProjectionTracker()
    for (const text of [
      source,
      '# Before\n\n' + source,
      source.replace('value = 1', 'value = 2'),
      source,
    ]) {
      const next = { ...input, source: text }
      const expected = oracle.project(next)
      expect(tracker.project(next)).toEqual(expected)
      expect(tracker.project(next)).toEqual(expected)
    }
  })

  it('never reuses across a document or epoch boundary and still rejects invalid epochs', () => {
    const project = vi.spyOn(projections, 'createMarkdownEditorProjection')
    const tracker = createMarkdownHeavyFeatureProjectionTracker()
    const first = tracker.project(input)
    expect(tracker.project({ ...input, documentEpoch: '1' })).toBeNull()
    expect(tracker.project({ ...input, documentEpoch: Number.NaN })).toBeNull()
    const second = tracker.project({ ...input, documentEpoch: 2 })
    const third = tracker.project({
      ...input,
      documentKey: 'document-b',
      documentEpoch: 2,
    })
    expect(second).not.toEqual(first)
    expect(third).not.toEqual(second)
    expect(project).toHaveBeenCalledTimes(3)
  })

  it('compares raw source exactly and keeps only the most recent input', () => {
    const project = vi.spyOn(projections, 'createMarkdownEditorProjection')
    const tracker = createMarkdownHeavyFeatureProjectionTracker()
    const first = tracker.project(input)
    const crlf = tracker.project({
      ...input,
      source: source.replaceAll('\n', '\r\n'),
    })
    expect(crlf).not.toBe(first)
    expect(crlf).toEqual(first)
    expect(tracker.project(input)).not.toBe(first)
    expect(project).toHaveBeenCalledTimes(3)
  })
})
