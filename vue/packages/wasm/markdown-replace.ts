import type { MarkdownSearchHit } from './markdown-syntax-consumers'

export const planMarkdownReplaceCurrent = (
  source: string,
  hit: MarkdownSearchHit,
  replacement: string,
  revision: number,
  expectedRevision: number,
) => {
  if (revision !== expectedRevision) return { rejected: 'stale' as const }
  return {
    changes: [{ from: hit.range.start, to: hit.range.end, insert: replacement }],
    history: 'separate' as const,
    origin: 'command' as const,
  }
}

export const planMarkdownReplaceAll = (
  source: string,
  hits: readonly MarkdownSearchHit[],
  replacement: string,
  revision: number,
  expectedRevision: number,
) => {
  if (revision !== expectedRevision) return { rejected: 'stale' as const }
  const changes = [...hits]
    .sort((left, right) => right.range.start - left.range.start)
    .map((hit) => ({ from: hit.range.start, to: hit.range.end, insert: replacement }))
  return { changes, history: 'separate' as const, origin: 'command' as const }
}
