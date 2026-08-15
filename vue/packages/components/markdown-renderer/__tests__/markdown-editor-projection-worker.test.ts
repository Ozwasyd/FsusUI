import { describe, expect, it } from 'vitest'

import {
  MARKDOWN_EDITOR_PROJECTION_PARSER,
  MARKDOWN_RENDERER_VERSION,
  createMarkdownEditorProjection,
} from '@element-plus/wasm'

describe('markdown editor projection worker contract', () => {
  it('requires a deterministic worker projection bound to the render identity', () => {
    const raw = '\uFEFF# Title\r\nworker'
    const mainThread = createMarkdownEditorProjection(raw)
    const workerEquivalent = createMarkdownEditorProjection(raw)

    expect(mainThread.identity.parser).toBe(MARKDOWN_EDITOR_PROJECTION_PARSER)
    expect(mainThread.identity.rawSource).toBe(raw)
    expect(mainThread.identity.normalizedSource).toBe('# Title\nworker')
    expect(mainThread.identity.version).toBe(MARKDOWN_RENDERER_VERSION)
    expect(workerEquivalent.identity).toEqual(mainThread.identity)
    expect(workerEquivalent.syntaxCoverage).toEqual(mainThread.syntaxCoverage)
  })
})
