import { describe, expect, it } from 'vitest'

import { createMarkdownEditorProjection } from '../../../wasm/markdown-runtime'
import {
  collectMarkdownEmbedNodes,
  defaultMarkdownEditorCommands,
  runMarkdownEmbedInsert,
  type MarkdownEditorCommandContext,
} from '../src/markdown-editor'

const context = (
  value: string,
): MarkdownEditorCommandContext => ({
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
    selection: { direction: 'none', end: value.length, start: value.length },
    value,
  }),
  documentIdentity: { epoch: 1, id: 'doc' },
  mode: 'source',
  readonly: false,
  revision: 1,
  selection: { direction: 'none', end: value.length, start: value.length },
  signal: new AbortController().signal,
  value,
})

describe('markdown editor embed command contract', () => {
  it('inserts the unique directive through a #268 command transaction', () => {
    const source = 'body\n'
    const result = runMarkdownEmbedInsert(context(source), 'note', 'article')
    expect(result.transaction?.origin).toBe('command')
    expect(result.transaction?.history).toBe('separate')
    const change = result.transaction?.changes[0]
    expect(change).toBeTruthy()
    const next = `${source.slice(0, change!.from)}${change!.insert}${source.slice(change!.to)}`
    const nodes = collectMarkdownEmbedNodes(next)
    expect(nodes.some((node) => node.ok && node.target === 'note' && node.mode === 'article')).toBe(
      true,
    )
    const projection = createMarkdownEditorProjection(next)
    expect(projection.nodes.some((node) => node.kind === 'embed')).toBe(true)
    expect(defaultMarkdownEditorCommands.some((command) => command.key === 'bold')).toBe(
      true,
    )
  })
})
