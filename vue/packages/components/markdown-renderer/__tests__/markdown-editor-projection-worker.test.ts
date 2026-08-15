import { describe, expect, it } from 'vitest'

import { describe, expect, it } from 'vitest'

import {
  MARKDOWN_EDITOR_PROJECTION_PARSER,
  MARKDOWN_RENDERER_VERSION,
  compareMarkdownEditorProjectionThreads,
  createMarkdownEditorProjection,
  createMarkdownEditorWorkerProjection,
  markdownEditorProjectionsEquivalent,
} from '../../../wasm/markdown-runtime'

describe('markdown editor projection worker contract', () => {
  it('requires a deterministic worker projection bound to the render identity', () => {
    const raw = '\uFEFF# Title\r\nworker'
    const compared = compareMarkdownEditorProjectionThreads(raw)
    const mainThread = createMarkdownEditorProjection(raw)
    const workerEquivalent = createMarkdownEditorWorkerProjection(raw)

    expect(mainThread.identity.parser).toBe(MARKDOWN_EDITOR_PROJECTION_PARSER)
    expect(mainThread.identity.rawSource).toBe(raw)
    expect(mainThread.identity.normalizedSource).toBe('# Title\nworker')
    expect(mainThread.identity.version).toBe(MARKDOWN_RENDERER_VERSION)
    expect(compared.equivalent).toBe(true)
    expect(markdownEditorProjectionsEquivalent(mainThread, workerEquivalent)).toBe(
      true,
    )
    expect(workerEquivalent.identity).toEqual(mainThread.identity)
    expect(workerEquivalent.syntaxCoverage).toEqual(mainThread.syntaxCoverage)
    expect(workerEquivalent.nodes.map((node) => node.kind)).toEqual(
      mainThread.nodes.map((node) => node.kind),
    )
  })
})

