import { describe, expect, it } from 'vitest'

import {
  defaultMarkdownEditorCommands,
  type MarkdownEditorCommandContext,
} from '../src/markdown-editor'
import { evaluateMarkdownEditorCommandMutations } from '../src/markdown-editor-command-snapshot'

const context = (): MarkdownEditorCommandContext => ({
  dispatch: () => ({
    accepted: true,
    history: {
      canRedo: false,
      canUndo: false,
      redoDepth: 0,
      retainedUnits: 0,
      undoDepth: 0,
    },
    revision: 1,
    selection: { direction: 'none', end: 0, start: 0 },
    value: '',
  }),
  documentIdentity: { epoch: 1, id: 'doc' },
  mode: 'source',
  readonly: false,
  revision: 1,
  selection: { direction: 'none', end: 0, start: 0 },
  signal: new AbortController().signal,
  value: 'text',
})

describe('markdown editor command snapshot', () => {
  it('shares one snapshot and fails closed on duplicate shortcuts', () => {
    const report = evaluateMarkdownEditorCommandMutations(
      defaultMarkdownEditorCommands,
      context(),
    )
    expect(report.authority.some((item) => item.key === 'bold')).toBe(true)
    expect(report.mutations.every((mutation) => mutation.accepted === false)).toBe(true)
    expect(
      report.mutations.find((mutation) => mutation.kind === 'duplicate-shortcut')
        ?.equivalent,
    ).toBe(false)
  })
})
