import { describe, expect, it } from 'vitest'

import {
  MARKDOWN_TECHNICAL_ACCEPTANCE_MODES,
  MARKDOWN_TECHNICAL_ACCEPTANCE_SCALES,
  MARKDOWN_TECHNICAL_ACCEPTANCE_VERSION,
  evaluateMarkdownTechnicalAcceptance,
  evaluateMarkdownTechnicalAcceptanceMutations,
} from '../src/markdown-editor-technical-acceptance'
import { defaultMarkdownEditorCommands } from '../src/markdown-editor'

describe('markdown technical acceptance', () => {
  it('accepts the landed #382–#385 contracts on one candidate', () => {
    const report = evaluateMarkdownTechnicalAcceptance({
      documentIdentity: { epoch: 3, id: 'gate-tech' },
    })
    expect(report.version).toBe(MARKDOWN_TECHNICAL_ACCEPTANCE_VERSION)
    expect(report.documentIdentity).toEqual({ epoch: 3, id: 'gate-tech' })
    expect(report.scale).toEqual([...MARKDOWN_TECHNICAL_ACCEPTANCE_SCALES])
    expect(report.identitiesShared).toBe(true)
    expect(report.staleRejected).toBe(true)
    expect(report.atomicCopyDeleteUndo).toBe(true)
    expect(report.xssRejected).toBe(true)
    expect(report.mutationsRejected).toBe(true)
    expect(report.accepted).toBe(true)
    expect(report.leftover).toEqual({
      imeNative: false,
      screenReader: false,
      viewportMatrix: false,
    })
    expect(MARKDOWN_TECHNICAL_ACCEPTANCE_MODES).toContain('preview')
    expect(defaultMarkdownEditorCommands.some((command) => command.key === 'code')).toBe(
      true,
    )
  })

  it('kills regex parse, innerHTML, extra keydown, toast-only error, and body rewrite', () => {
    const report = evaluateMarkdownTechnicalAcceptanceMutations()
    const byKind = Object.fromEntries(
      report.mutations.map((mutation) => [mutation.kind, mutation]),
    )
    expect(byKind['regex-parse']?.accepted).toBe(false)
    expect(byKind.innerHTML?.accepted).toBe(false)
    expect(byKind['independent-keydown']?.accepted).toBe(false)
    expect(byKind['toast-only-error']?.accepted).toBe(false)
    expect(byKind['body-rewrite']?.accepted).toBe(false)
    expect(report.leftover.imeNative).toBe(false)
  })
})
