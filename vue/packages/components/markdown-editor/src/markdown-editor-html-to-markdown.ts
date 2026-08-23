import { sanitizeMarkdownHtmlImport } from '../../../wasm/markdown-html-import'

export interface MarkdownHtmlConversion {
  readonly markdown: string
  readonly loss: readonly string[]
}

const block = (html: string) =>
  html
    .replace(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi, (_, level: string, text: string) => `${'#'.repeat(Number(level))} ${text.trim()}\n\n`)
    .replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '$1\n\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '- $1\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .trim()

export const convertSanitizedHtmlToMarkdown = (html: string): MarkdownHtmlConversion => {
  const sanitized = sanitizeMarkdownHtmlImport(html)
  const loss = [...sanitized.rejected]
  if (/style=/i.test(html)) loss.push('style')
  return Object.freeze({
    markdown: block(sanitized.html),
    loss: Object.freeze([...new Set(loss)]),
  })
}

export const evaluateMarkdownHtmlConversionMutations = (html: string) => {
  const authority = convertSanitizedHtmlToMarkdown(html)
  return Object.freeze({
    authority,
    mutations: Object.freeze([
      Object.freeze({
        kind: 'raw-html-passthrough' as const,
        equivalent: authority.markdown.includes('<script'),
        accepted: false,
      }),
    ]),
  })
}
