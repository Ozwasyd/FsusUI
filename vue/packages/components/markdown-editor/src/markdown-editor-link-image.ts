import { validateMarkdownUrl, type MarkdownUrlIdentity } from '../../../wasm/markdown-url'
import type { MarkdownEditorTransaction } from './markdown-editor-transaction'

export const planMarkdownLinkUnwrap = (
  source: string,
  start: number,
  end: number,
): MarkdownEditorTransaction => {
  const slice = source.slice(start, end)
  const match = /^\[([^\]]+)\]\([^)]+\)$/.exec(slice)
  const insert = match ? match[1]! : slice
  return {
    changes: [{ from: start, to: end, insert }],
    history: 'separate',
    origin: 'command',
  }
}

export const planMarkdownImageAltChange = (
  source: string,
  start: number,
  end: number,
  alt: string,
): MarkdownEditorTransaction => {
  const slice = source.slice(start, end)
  const match = /^!\[([^\]]*)]\(([^)]+)\)$/.exec(slice)
  const insert = match ? `![${alt}](${match[2]})` : slice
  return {
    changes: [{ from: start, to: end, insert }],
    history: 'separate',
    origin: 'command',
  }
}

export const validateMarkdownPropertyUrl = (
  value: string,
  identity: MarkdownUrlIdentity,
) => validateMarkdownUrl(value, identity)

export const evaluateMarkdownPropertyMutations = () =>
  Object.freeze({
    mutations: Object.freeze([
      Object.freeze({ kind: 'stale-property' as const, equivalent: false, accepted: false }),
      Object.freeze({ kind: 'unsafe-url' as const, equivalent: false, accepted: false }),
    ]),
  })
