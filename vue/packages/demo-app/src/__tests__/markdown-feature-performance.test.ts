import { describe, expect, it } from 'vitest'
import {
  MarkdownFeatureActivationSequence,
  createMarkdownFeatureActivationSource,
  hasCompleteMarkdownFeatureActivation,
} from '../markdown-feature-performance'

const completeActivation = {
  activated: [
    { count: 1, kind: 'mermaid' },
    { count: 1, kind: 'latex' },
    { count: 1, kind: 'code-highlight' },
  ],
  errors: [],
} as const

describe('markdown feature activation performance fixture', () => {
  it('requires all three built-in features without errors', () => {
    expect(hasCompleteMarkdownFeatureActivation(completeActivation)).toBe(true)
    expect(
      hasCompleteMarkdownFeatureActivation({
        activated: completeActivation.activated.slice(0, 2),
        errors: [],
      }),
    ).toBe(false)
    expect(
      hasCompleteMarkdownFeatureActivation({
        activated: completeActivation.activated,
        errors: [{ kind: 'mermaid' }],
      }),
    ).toBe(false)
    expect(
      hasCompleteMarkdownFeatureActivation({
        activated: [
          { count: 2, kind: 'mermaid' },
          { count: 1, kind: 'latex' },
          { count: 1, kind: 'code-highlight' },
        ],
        errors: [],
      }),
    ).toBe(false)
    expect(
      hasCompleteMarkdownFeatureActivation({
        activated: [
          { count: 1, kind: 'mermaid' },
          { count: 1, kind: 'mermaid' },
          { count: 1, kind: 'latex' },
          { count: 1, kind: 'code-highlight' },
        ],
        errors: [],
      }),
    ).toBe(false)
  })

  it('creates five distinct source/version cycles and waits for each activation', async () => {
    const sequence = new MarkdownFeatureActivationSequence()
    const revisions: number[] = []
    const sources = new Set<string>()

    for (let index = 0; index < 5; index += 1) {
      const cycle = sequence.begin()
      let completed = false
      void cycle.completion.then(() => {
        completed = true
      })
      await Promise.resolve()
      expect(completed).toBe(false)

      sources.add(createMarkdownFeatureActivationSource(cycle.revision))
      expect(sequence.complete(completeActivation)).toBe(true)
      revisions.push(await cycle.completion)
    }

    expect(revisions).toEqual([1, 2, 3, 4, 5])
    expect(sources.size).toBe(5)
  })
})
