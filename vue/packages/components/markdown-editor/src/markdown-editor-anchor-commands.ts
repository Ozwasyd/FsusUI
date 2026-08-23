import {
  collectMarkdownAnchorNodes,
  type MarkdownAnchorValidNode,
} from '../../../wasm/markdown-anchor-grammar'
import type { MarkdownEditorTransaction } from './markdown-editor-transaction'

export const planMarkdownAnchorInsert = (
  source: string,
  offset: number,
  id: string,
): MarkdownEditorTransaction => ({
  changes: [{ from: offset, to: offset, insert: ` ^${id}` }],
  history: 'separate',
  origin: 'command',
})

export const planMarkdownAnchorRemove = (
  node: MarkdownAnchorValidNode,
): MarkdownEditorTransaction => ({
  changes: [{ from: node.ranges.full.start, to: node.ranges.full.end, insert: '' }],
  history: 'separate',
  origin: 'command',
})

export const currentMarkdownAnchors = (source: string) =>
  collectMarkdownAnchorNodes(source).filter((node): node is MarkdownAnchorValidNode => node.ok)
