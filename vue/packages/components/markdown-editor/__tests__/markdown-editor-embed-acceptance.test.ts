import { describe, expect, it } from 'vitest'

import {
  evaluateMarkdownEmbedEditorAcceptance,
  MARKDOWN_EMBED_EDITOR_ACCEPTANCE_VERSION,
} from '../src/markdown-editor-embed-acceptance'

describe('markdown embed editor acceptance (#390)', () => {
  it('passes the composed surface, atomic, stale and mutation report', () => {
    const report = evaluateMarkdownEmbedEditorAcceptance()
    expect(report.version).toBe(MARKDOWN_EMBED_EDITOR_ACCEPTANCE_VERSION)
    expect(report.modeSurfaces).toBe(true)
    expect(report.atomicConsistent).toBe(true)
    expect(report.hostSourceUnchanged).toBe(true)
    expect(report.staleResultStable).toBe(true)
    expect(report.unsafeOutputExposed).toBe(false)
    expect(report.mutationsRejected).toBe(true)
    expect(report.leftover).toEqual({
      liveAssistiveTechnology: false,
      liveDeviceMatrix: false,
      simulatedLocally: true,
    })
    expect(report.accepted).toBe(true)
  })
})
