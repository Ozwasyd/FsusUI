import {
  MARKDOWN_HTML_IMPORT_IMPORTER_VERSION,
  importMarkdownClipboardSnapshot,
  type MarkdownHtmlImportFinding,
  type MarkdownHtmlImportNode,
  type MarkdownHtmlImportSnapshot,
  type MarkdownHtmlImportTask,
  type MarkdownHtmlImportTree,
} from './markdown-html-import'
import { classifyMarkdownUrl } from './markdown-url'

export const MARKDOWN_HTML_CONVERSION_VERSION = 'fsusui-html-md/1'

export const MARKDOWN_HTML_CONVERSION_MAP = Object.freeze({
  p: 'paragraph',
  div: 'flatten-wrapper',
  span: 'flatten-wrapper',
  h1: 'heading-1',
  h2: 'heading-2',
  h3: 'heading-3',
  h4: 'heading-4',
  h5: 'heading-5',
  h6: 'heading-6',
  strong: 'strong',
  b: 'strong',
  em: 'emphasis',
  i: 'emphasis',
  s: 'strike',
  u: 'flatten-underline',
  a: 'link',
  img: 'image-or-attachment',
  ul: 'unordered-list',
  ol: 'ordered-list',
  li: 'list-item',
  blockquote: 'blockquote',
  pre: 'preformatted',
  code: 'code',
  br: 'break',
  hr: 'rule',
  table: 'table',
  thead: 'table-head',
  tbody: 'table-body',
  tr: 'table-row',
  td: 'table-cell',
  th: 'table-cell',
  figure: 'flatten-figure',
  figcaption: 'paragraph',
})

export const MARKDOWN_HTML_CONVERSION_BUDGET = Object.freeze({
  maxNodes: 20_000,
  maxMs: 50,
})

export type MarkdownHtmlLossKind = 'removed' | 'flattened' | 'unsupported'

export interface MarkdownHtmlLoss {
  readonly kind: MarkdownHtmlLossKind
  readonly code: string
  readonly detail?: string
}

export interface MarkdownHtmlAttachmentDescriptor {
  readonly kind: 'image'
  readonly alt: string
  readonly href?: string
}

export interface MarkdownHtmlConversionResult {
  readonly markdown: string
  readonly losses: readonly MarkdownHtmlLoss[]
  readonly attachments: readonly MarkdownHtmlAttachmentDescriptor[]
  readonly mappingVersion: typeof MARKDOWN_HTML_CONVERSION_VERSION
  readonly importerVersion: string
}

const ENTITIES: Readonly<Record<string, string>> = Object.freeze({
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
})

const decodeEntities = (value: string) =>
  value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (whole, body: string) => {
    if (body[0] === '#') {
      const hex = body[1] === 'x' || body[1] === 'X'
      const code = Number.parseInt(hex ? body.slice(2) : body.slice(1), hex ? 16 : 10)
      if (Number.isFinite(code) && code > 31) return String.fromCodePoint(code)
      return ''
    }
    return ENTITIES[body.toLowerCase()] ?? whole
  })

const loss = (kind: MarkdownHtmlLossKind, code: string, detail?: string): MarkdownHtmlLoss =>
  Object.freeze({ kind, code, ...(detail ? { detail } : {}) })

const isSafeUrl = (value: string) => classifyMarkdownUrl(value).startsWith('valid-')

const escapeMd = (value: string) => value.replace(/([\\`*_[\]#])/g, '\\$1')

type Context = {
  losses: MarkdownHtmlLoss[]
  attachments: MarkdownHtmlAttachmentDescriptor[]
  nodes: number
  started: number
  now: () => number
  budget: { readonly maxNodes: number; readonly maxMs: number }
  task?: MarkdownHtmlImportTask
  listKind?: 'ul' | 'ol'
  listIndex: number
  quote: number
  pre: boolean
}

const timedOut = (ctx: Context) => (ctx.now() - ctx.started) > ctx.budget.maxMs

const convertChildren = (nodes: readonly MarkdownHtmlImportNode[], ctx: Context, sep = ''): string => {
  const parts: string[] = []
  for (const node of nodes) {
    const piece = convertNode(node, ctx)
    if (piece) parts.push(piece)
  }
  return parts.join(sep)
}

const inline = (nodes: readonly MarkdownHtmlImportNode[], ctx: Context): string =>
  nodes
    .map((node) => {
      if (node.type === 'element' && (node.tag === 'p' || node.tag === 'div' || node.tag === 'span')) {
        return inline(node.children, ctx)
      }
      return convertNode(node, ctx)
    })
    .join('')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')

const prefixLines = (text: string, prefix: string) =>
  text
    .split('\n')
    .map((line) => (line.length ? `${prefix}${line}` : prefix.trimEnd()))
    .join('\n')

const convertNode = (node: MarkdownHtmlImportNode, ctx: Context): string => {
  if (ctx.task?.cancelled) return ''
  if (timedOut(ctx) || ctx.nodes > ctx.budget.maxNodes) return ''
  ctx.nodes += 1
  if (node.type === 'text') {
    const decoded = decodeEntities(node.value)
    return ctx.pre ? decoded : escapeMd(decoded.replace(/\s+/g, ' '))
  }
  const mapped = MARKDOWN_HTML_CONVERSION_MAP[node.tag as keyof typeof MARKDOWN_HTML_CONVERSION_MAP]
  if (!mapped) {
    ctx.losses.push(loss('unsupported', `tag:${node.tag}`))
    return inline(node.children, ctx)
  }
  switch (node.tag) {
    case 'br':
      return '\n'
    case 'hr':
      return '\n\n---\n\n'
    case 'p':
    case 'figcaption':
      return `${inline(node.children, ctx).trim()}\n\n`
    case 'div':
    case 'span':
    case 'figure':
      ctx.losses.push(loss('flattened', `wrapper:${node.tag}`))
      return node.tag === 'span' ? inline(node.children, ctx) : `${convertChildren(node.children, ctx)}\n`
    case 'u':
      ctx.losses.push(loss('flattened', 'underline'))
      return inline(node.children, ctx)
    case 'h1':
    case 'h2':
    case 'h3':
    case 'h4':
    case 'h5':
    case 'h6':
      return `${'#'.repeat(Number(node.tag[1]))} ${inline(node.children, ctx).trim()}\n\n`
    case 'strong':
    case 'b':
      return `**${inline(node.children, ctx).trim()}**`
    case 'em':
    case 'i':
      return `*${inline(node.children, ctx).trim()}*`
    case 's':
      return `~~${inline(node.children, ctx).trim()}~~`
    case 'code':
      if (ctx.pre) return inline(node.children, ctx)
      return `\`${inline(node.children, ctx).replace(/`/g, '')}\``
    case 'pre': {
      ctx.pre = true
      const body = convertChildren(node.children, ctx).replace(/\n$/, '')
      ctx.pre = false
      return `\`\`\`\n${body}\n\`\`\`\n\n`
    }
    case 'blockquote': {
      ctx.quote += 1
      const inner = convertChildren(node.children, ctx).trim()
      ctx.quote -= 1
      return `${prefixLines(inner, '> ')}\n\n`
    }
    case 'a': {
      const href = node.attrs.href ?? ''
      const text = inline(node.children, ctx).trim() || href
      if (!href) {
        ctx.losses.push(loss('flattened', 'link-missing-href'))
        return text
      }
      if (!isSafeUrl(href)) {
        ctx.losses.push(loss('removed', 'unsafe-url', href.slice(0, 80)))
        return text
      }
      return `[${text}](${href})`
    }
    case 'img': {
      const alt = node.attrs.alt ?? ''
      const src = node.attrs.src ?? ''
      if (!src || src.startsWith('data:') || src.startsWith('blob:')) {
        ctx.losses.push(loss('removed', 'image-data-url'))
        ctx.attachments.push(Object.freeze({ kind: 'image', alt }))
        return alt
      }
      if (!isSafeUrl(src)) {
        ctx.losses.push(loss('removed', 'unsafe-url', src.slice(0, 80)))
        ctx.attachments.push(Object.freeze({ kind: 'image', alt }))
        return alt
      }
      ctx.attachments.push(Object.freeze({ kind: 'image', alt, href: src }))
      return `![${alt}](${src})`
    }
    case 'ul':
    case 'ol': {
      const previous = ctx.listKind
      const previousIndex = ctx.listIndex
      ctx.listKind = node.tag
      ctx.listIndex = node.tag === 'ol' ? Number(node.attrs.start ?? '1') || 1 : 0
      const body = convertChildren(node.children, ctx).replace(/\n+$/, '')
      ctx.listKind = previous
      ctx.listIndex = previousIndex
      return `${body}\n\n`
    }
    case 'li': {
      const indent = ctx.quote > 0 ? '' : ''
      void indent
      const marker = ctx.listKind === 'ol' ? `${ctx.listIndex}.` : '-'
      if (ctx.listKind === 'ol') ctx.listIndex += 1
      const text = inline(node.children, ctx).trim()
      const task = /^(\[[ xX]\]|☐|☑)\s+/.test(text) ? text : text
      return `${marker} ${task}\n`
    }
    case 'table': {
      const rows = collectRows(node, ctx)
      if (rows.length === 0) {
        ctx.losses.push(loss('flattened', 'empty-table'))
        return ''
      }
      const width = Math.max(...rows.map((row) => row.length))
      const padded = rows.map((row) => {
        const next = [...row]
        while (next.length < width) next.push('')
        return next
      })
      const header = padded[0]!
      const align = `| ${header.map(() => '---').join(' | ')} |`
      const lines = [
        `| ${header.join(' | ')} |`,
        align,
        ...padded.slice(1).map((row) => `| ${row.join(' | ')} |`),
      ]
      return `${lines.join('\n')}\n\n`
    }
    case 'thead':
    case 'tbody':
    case 'tr':
    case 'td':
    case 'th':
      return convertChildren(node.children, ctx)
    default:
      ctx.losses.push(loss('unsupported', `tag:${node.tag}`))
      return inline(node.children, ctx)
  }
}

const collectRows = (table: MarkdownHtmlImportNode, ctx: Context): string[][] => {
  if (table.type !== 'element') return []
  const rows: string[][] = []
  const visit = (node: MarkdownHtmlImportNode) => {
    if (node.type !== 'element') return
    if (node.tag === 'tr') {
      rows.push(
        node.children
          .filter((child): child is Extract<MarkdownHtmlImportNode, { type: 'element' }> =>
            child.type === 'element' && (child.tag === 'td' || child.tag === 'th'),
          )
          .map((cell) => inline(cell.children, ctx).trim()),
      )
      return
    }
    node.children.forEach(visit)
  }
  table.children.forEach(visit)
  return rows
}

const fromFindings = (findings: readonly MarkdownHtmlImportFinding[]): MarkdownHtmlLoss[] =>
  findings.map((item) => {
    const code = item.code === 'dangerous-scheme' ? 'unsafe-url' : item.code
    if (item.kind === 'unsupported') return loss('unsupported', code, item.detail)
    return loss('removed', code, item.detail)
  })

export const convertMarkdownHtmlImportTree = (
  tree: MarkdownHtmlImportTree,
  options: {
    readonly findings?: readonly MarkdownHtmlImportFinding[]
    readonly budget?: { readonly maxNodes: number; readonly maxMs: number }
    readonly task?: MarkdownHtmlImportTask
    readonly now?: () => number
  } = {},
): MarkdownHtmlConversionResult => {
  const ctx: Context = {
    losses: fromFindings(options.findings ?? []),
    attachments: [],
    nodes: 0,
    started: (options.now ?? Date.now)(),
    now: options.now ?? Date.now,
    budget: options.budget ?? MARKDOWN_HTML_CONVERSION_BUDGET,
    task: options.task,
    listIndex: 0,
    quote: 0,
    pre: false,
  }
  const markdown = convertChildren(tree.nodes, ctx)
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  if (ctx.task?.cancelled) {
    ctx.losses.push(loss('removed', 'cancelled'))
  } else if (timedOut(ctx)) {
    ctx.losses.push(loss('removed', 'budget-time'))
  }
  return Object.freeze({
    markdown: markdown.length ? `${markdown}\n` : '',
    losses: Object.freeze(ctx.losses.slice()),
    attachments: Object.freeze(ctx.attachments.slice()),
    mappingVersion: MARKDOWN_HTML_CONVERSION_VERSION,
    importerVersion: tree.importerVersion || MARKDOWN_HTML_IMPORT_IMPORTER_VERSION,
  })
}

export const convertMarkdownHtmlImportSnapshot = (
  snapshot: MarkdownHtmlImportSnapshot,
  options: {
    readonly task?: MarkdownHtmlImportTask
    readonly now?: () => number
  } = {},
): MarkdownHtmlConversionResult => {
  const imported = importMarkdownClipboardSnapshot(snapshot, options)
  if (!imported.ok || !imported.tree) {
    return Object.freeze({
      markdown: snapshot.plain ? `${snapshot.plain.trim()}\n` : '',
      losses: Object.freeze([loss('removed', imported.ok ? 'empty' : imported.code)]),
      attachments: Object.freeze([]),
      mappingVersion: MARKDOWN_HTML_CONVERSION_VERSION,
      importerVersion: MARKDOWN_HTML_IMPORT_IMPORTER_VERSION,
    })
  }
  return convertMarkdownHtmlImportTree(imported.tree, {
    findings: imported.findings,
    task: options.task,
    now: options.now,
  })
}

export type MarkdownHtmlConversionMutationKind =
  | 'silent-loss'
  | 'unsafe-url'
  | 'html-output'
  | 'remote-conversion'
  | 'consumer-converter'

export const evaluateMarkdownHtmlConversionMutations = (html: string) => {
  const authority = convertMarkdownHtmlImportSnapshot({ html, explicit: true })
  const math = convertMarkdownHtmlImportSnapshot({
    html: `${html}<math>x</math>`,
    explicit: true,
  })
  const unsafe = convertMarkdownHtmlImportSnapshot({
    html: '<a href="javascript:alert(1)">x</a><img src="data:image/png;base64,aaaa">',
    explicit: true,
  })
  return Object.freeze({
    authority,
    mutations: Object.freeze([
      Object.freeze({
        kind: 'silent-loss' as const,
        equivalent:
          math.markdown === authority.markdown &&
          !math.losses.some((item) => item.code.includes('math') || item.code.includes('tag:math')),
        accepted: false,
      }),
      Object.freeze({
        kind: 'unsafe-url' as const,
        equivalent: /javascript:|data:image/i.test(authority.markdown + unsafe.markdown),
        accepted: false,
      }),
      Object.freeze({
        kind: 'html-output' as const,
        equivalent: /<[a-z][\s\S]*>/i.test(authority.markdown),
        accepted: false,
      }),
      Object.freeze({
        kind: 'remote-conversion' as const,
        equivalent: false,
        accepted: false,
      }),
      Object.freeze({
        kind: 'consumer-converter' as const,
        equivalent: false,
        accepted: false,
      }),
    ]),
  })
}
