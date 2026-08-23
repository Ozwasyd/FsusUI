const FORBIDDEN_TAGS = new Set([
  'script',
  'iframe',
  'object',
  'embed',
  'link',
  'meta',
  'base',
  'form',
])

const FORBIDDEN_ATTR = /^(on|xmlns|xlink:href$)/i

export interface MarkdownHtmlImportResult {
  readonly html: string
  readonly rejected: readonly string[]
}

const stripTags = (html: string, rejected: string[]) =>
  html.replace(/<\/?([a-z][\w:-]*)\b[^>]*>/gi, (match, tag: string) => {
    if (FORBIDDEN_TAGS.has(tag.toLowerCase())) {
      rejected.push(tag.toLowerCase())
      return ''
    }
    return match.replace(/\s([a-z_:][\w:.-]*)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, (attr, name: string, value: string) => {
      const raw = value.replace(/^['"]|['"]$/g, '')
      if (FORBIDDEN_ATTR.test(name) || /javascript:/i.test(raw) || /data:text\/html/i.test(raw)) {
        rejected.push(name)
        return ''
      }
      return attr
    })
  })

export const sanitizeMarkdownHtmlImport = (html: string): MarkdownHtmlImportResult => {
  const rejected: string[] = []
  const withoutComments = html.replace(/<!--[\s\S]*?-->/g, '')
  const htmlWithoutDoctype = withoutComments.replace(/<!doctype[^>]*>/gi, '')
  return Object.freeze({
    html: stripTags(htmlWithoutDoctype, rejected),
    rejected: Object.freeze(rejected),
  })
}

export type MarkdownHtmlImportMutationKind =
  | 'script-exec'
  | 'javascript-url'
  | 'isolated-parse-skip'

export const evaluateMarkdownHtmlImportMutations = (html: string) => {
  const authority = sanitizeMarkdownHtmlImport(html)
  return Object.freeze({
    authority,
    mutations: Object.freeze([
      Object.freeze({
        kind: 'script-exec' as const,
        equivalent: /<script/i.test(authority.html),
        accepted: false,
      }),
      Object.freeze({
        kind: 'javascript-url' as const,
        equivalent: /javascript:/i.test(authority.html),
        accepted: false,
      }),
      Object.freeze({
        kind: 'isolated-parse-skip' as const,
        equivalent: html === authority.html,
        accepted: false,
      }),
    ]),
  })
}
