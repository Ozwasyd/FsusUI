import type { MarkdownEmbedMode } from './markdown-embed-directive'
import type { MarkdownEmbedResult, MarkdownEmbedProviderStatus } from './markdown-embed-provider'

export interface MarkdownEmbedPresentation {
  readonly visible: boolean
  readonly title: string | null
  readonly mode: MarkdownEmbedMode
  readonly status: MarkdownEmbedProviderStatus | string
  readonly card: false
  readonly hasNestedScroll: false
  readonly tabStop: false
  readonly actions: readonly ('source-reveal' | 'open-source' | 'retry' | 'copy')[]
  readonly excerpt?: string
  readonly error?: boolean
}

export const sanitizeEmbedExcerpt = (excerpt?: string): string => {
  if (!excerpt) return ''
  return excerpt
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, '')
    .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
    .replace(/javascript:[^\s"'>]+/gi, '')
    .trim()
}

export const presentMarkdownEmbed = (
  result: MarkdownEmbedResult | { readonly status: string; readonly target: string; readonly mode: MarkdownEmbedMode; readonly title?: string; readonly excerpt?: string },
): MarkdownEmbedPresentation => {
  const status = result.status
  const isResolved = status === 'resolved'
  const isPending = status === 'pending'
  const isFailure = !isResolved && !isPending && status !== 'idle'

  const actions = isResolved
    ? (['source-reveal', 'open-source', 'copy'] as const)
    : isFailure
      ? (['source-reveal', 'retry', 'open-source', 'copy'] as const)
      : (['source-reveal', 'copy'] as const)

  return Object.freeze({
    visible: isResolved || isPending || isFailure,
    title: result.title ?? result.target ?? null,
    mode: result.mode,
    status,
    card: false as const,
    hasNestedScroll: false as const,
    tabStop: false as const,
    actions,
    excerpt: sanitizeEmbedExcerpt(result.excerpt),
    error: isFailure || undefined,
  })
}
