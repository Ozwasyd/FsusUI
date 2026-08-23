import { describe, expect, it } from 'vitest'

import { defaultMarkdownEditorCommands, type MarkdownEditorCommandContext } from '../src/markdown-editor'
import { createMarkdownOutlineModel } from '../src/markdown-editor-outline'
import {
  evaluateMarkdownOutlineActiveMutations,
  planMarkdownOutlineReveal,
  resolveMarkdownActiveHeading,
} from '../src/markdown-editor-outline-active'
import {
  evaluateMarkdownTableInputMutations,
  moveMarkdownTableCell,
  parseMarkdownTableTsv,
} from '../src/markdown-editor-table-input'
import { convertSanitizedHtmlToMarkdown } from '../src/markdown-editor-html-to-markdown'
import {
  createMarkdownEditorCommandSession,
  resolveMarkdownEditorCommandSession,
} from '../src/markdown-editor-command-async'
import {
  groupMarkdownEditorCommands,
  resolveMarkdownSlashQuery,
  searchMarkdownEditorCommands,
} from '../src/markdown-editor-surfaces'
import { resolveMarkdownSelectionToolbarPlacement } from '../src/markdown-editor-selection-toolbar'
import { createWritingAidsController } from '../src/markdown-editor-writing-aids'

const context = (revision = 1): MarkdownEditorCommandContext => ({
  dispatch: () => ({
    accepted: true,
    history: {
      canRedo: false,
      canUndo: false,
      redoDepth: 0,
      retainedUnits: 0,
      undoDepth: 0,
    },
    revision,
    selection: { direction: 'none', end: 0, start: 0 },
    value: '',
  }),
  documentIdentity: { epoch: 1, id: 'doc' },
  mode: 'source',
  readonly: false,
  revision,
  selection: { direction: 'none', end: 0, start: 0 },
  signal: new AbortController().signal,
  value: 'hello',
})

describe('markdown follow-on contracts', () => {
  it('resolves active heading and reveal from outline identities', () => {
    const model = createMarkdownOutlineModel('# One\n\n# Two\n', { id: 'doc', epoch: 1 })
    const active = resolveMarkdownActiveHeading(model.items, { start: 0, end: 4 })
    expect(active?.text).toBe('One')
    const reveal = planMarkdownOutlineReveal(model.items, model.items[1]!.nodeId)
    expect(reveal.status).toBe('success')
    expect(
      evaluateMarkdownOutlineActiveMutations(model.items, { start: 0, end: 4 }).mutations.every(
        (mutation) => mutation.accepted === false,
      ),
    ).toBe(true)
  })

  it('moves table cells and parses TSV without a second keydown authority', () => {
    const next = moveMarkdownTableCell(
      { tableId: 'syn:table:0', row: 0, column: 0, status: 'current' },
      'Tab',
      2,
      2,
    )
    expect(next).toMatchObject({ row: 0, column: 1, status: 'current' })
    expect(parseMarkdownTableTsv('a\tb\nc\td')).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ])
    expect(evaluateMarkdownTableInputMutations().mutations.every((mutation) => !mutation.accepted)).toBe(
      true,
    )
  })

  it('converts sanitized HTML to markdown with a loss report', () => {
    const result = convertSanitizedHtmlToMarkdown('<h1>Title</h1><script>x()</script><p>Hi</p>')
    expect(result.markdown).toContain('# Title')
    expect(result.markdown).toContain('Hi')
    expect(result.markdown).not.toContain('script')
    expect(result.loss).toContain('script')
  })

  it('marks command sessions stale after revision change and searches palette groups', () => {
    const session = createMarkdownEditorCommandSession('bold', context(1))
    expect(resolveMarkdownEditorCommandSession(session, context(2), 'resolved-current')).toBe(
      'stale',
    )
    const found = searchMarkdownEditorCommands(defaultMarkdownEditorCommands, context(), 'bol')
    expect(found.some((command) => command.key === 'bold')).toBe(true)
    expect(groupMarkdownEditorCommands(defaultMarkdownEditorCommands).size).toBeGreaterThan(0)
    expect(resolveMarkdownSlashQuery('see /bol', 8)).toBe('bol')
    expect(resolveMarkdownSlashQuery('https://x', 9)).toBeNull()
    expect(
      resolveMarkdownSelectionToolbarPlacement({ start: 1, end: 4 }, 3, 3).visible,
    ).toBe(true)
    expect(
      resolveMarkdownSelectionToolbarPlacement({ start: 1, end: 1 }, 3, 3).visible,
    ).toBe(false)
    expect(
      resolveMarkdownSelectionToolbarPlacement({ start: 1, end: 4 }, 2, 3).reason,
    ).toBe('stale')
  })

  it('keeps writing aids on projection identity', () => {
    const controller = createWritingAidsController({
      documentIdentity: 'doc',
      documentEpoch: 1,
      revision: 1,
      projection: {
        currentBlock: { id: 'block-a', sourceRange: [0, 4] },
        caretAnchor: { blockId: 'block-a', sourceOffset: 1 },
      },
    })
    expect(controller.currentBlock?.id).toBe('block-a')
    controller.updateDocument({ documentIdentity: 'doc-b', documentEpoch: 2, revision: 1 })
    expect(controller.currentBlock).toBeNull()
  })
})
