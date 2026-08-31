export const MARKDOWN_HTML_IMPORT_SCHEMA_VERSION = 1
export const MARKDOWN_HTML_IMPORT_IMPORTER_VERSION = 'fsusui-html-import/1'

export const MARKDOWN_HTML_IMPORT_BUDGET = Object.freeze({
  maxBytes: 10_000_000,
  maxNodes: 20_000,
  maxDepth: 24,
  maxAttributes: 32,
  maxTableCells: 10_000,
  maxImages: 1_000,
  maxMs: 50,
})

export interface MarkdownHtmlImportBudget {
  readonly maxBytes: number
  readonly maxNodes: number
  readonly maxDepth: number
  readonly maxAttributes: number
  readonly maxTableCells: number
  readonly maxImages: number
  readonly maxMs: number
}

export interface MarkdownHtmlImportSnapshot {
  readonly html?: string
  readonly plain?: string
  readonly markdown?: string
  readonly sourceApplication?: string
  readonly explicit: boolean
}

export type MarkdownHtmlImportFindingKind =
  | 'removed'
  | 'blocked'
  | 'unsupported'

export interface MarkdownHtmlImportFinding {
  readonly kind: MarkdownHtmlImportFindingKind
  readonly code: string
  readonly detail?: string
}

export type MarkdownHtmlImportNode =
  | {
      readonly type: 'element'
      readonly tag: string
      readonly attrs: Readonly<Record<string, string>>
      readonly children: readonly MarkdownHtmlImportNode[]
    }
  | { readonly type: 'text'; readonly value: string }

export interface MarkdownHtmlImportTree {
  readonly schemaVersion: number
  readonly importerVersion: string
  readonly nodes: readonly MarkdownHtmlImportNode[]
}

export type MarkdownHtmlImportReject =
  | 'not-explicit'
  | 'budget-bytes'
  | 'budget-nodes'
  | 'budget-depth'
  | 'budget-table-cells'
  | 'budget-images'
  | 'budget-time'
  | 'cancelled'
  | 'empty'

export interface MarkdownHtmlImportStats {
  readonly bytes: number
  readonly nodes: number
  readonly depth: number
  readonly attributes: number
  readonly tableCells: number
  readonly images: number
  readonly ms: number
}

export type MarkdownHtmlImportOutcome =
  | {
      readonly ok: true
      readonly tree: MarkdownHtmlImportTree
      readonly findings: readonly MarkdownHtmlImportFinding[]
      readonly stats: MarkdownHtmlImportStats
    }
  | {
      readonly ok: false
      readonly code: MarkdownHtmlImportReject
      readonly findings: readonly MarkdownHtmlImportFinding[]
      readonly stats: MarkdownHtmlImportStats
      readonly tree?: MarkdownHtmlImportTree
    }

export interface MarkdownHtmlImportTask {
  cancelled: boolean
}

const FORBIDDEN_TAGS = new Set([
  'script',
  'style',
  'iframe',
  'object',
  'embed',
  'link',
  'meta',
  'base',
  'form',
  'input',
  'button',
  'textarea',
  'select',
  'option',
  'svg',
  'math',
  'frame',
  'frameset',
  'applet',
  'video',
  'audio',
  'source',
  'track',
  'canvas',
])

const VOID_TAGS = new Set(['br', 'img', 'hr', 'wbr', 'col', 'area', 'param'])

const ALLOWED_TAGS = new Set([
  'p',
  'div',
  'span',
  'br',
  'hr',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'blockquote',
  'pre',
  'code',
  'ul',
  'ol',
  'li',
  'table',
  'thead',
  'tbody',
  'tr',
  'td',
  'th',
  'a',
  'strong',
  'em',
  'b',
  'i',
  'u',
  's',
  'img',
  'figure',
  'figcaption',
])

const ALLOWED_ATTR = new Set([
  'href',
  'src',
  'alt',
  'title',
  'colspan',
  'rowspan',
  'start',
])

const isControlChar = (code: number) =>
  code <= 8 ||
  code === 11 ||
  code === 12 ||
  (code >= 14 && code <= 31) ||
  code === 127

const DANGEROUS_SCHEME =
  /^(?:javascript|vbscript|data:text\/html|data:image\/svg)/i

const decodeUrlCharacterReferences = (value: string) =>
  value.replace(
    /&(#x?[0-9a-f]+|colon|tab|newline);/gi,
    (whole, body: string) => {
      const normalized = body.toLowerCase()
      if (normalized === 'colon') return ':'
      if (normalized === 'tab') return '\t'
      if (normalized === 'newline') return '\n'
      const hex = normalized.startsWith('#x')
      const digits = normalized.slice(hex ? 2 : 1)
      const code = Number.parseInt(digits, hex ? 16 : 10)
      return Number.isFinite(code) ? String.fromCodePoint(code) : whole
    },
  )

type OpenElement = {
  tag: string
  attrs: Record<string, string>
  children: MarkdownHtmlImportNode[]
}

const finding = (
  kind: MarkdownHtmlImportFindingKind,
  code: string,
  detail?: string,
): MarkdownHtmlImportFinding =>
  Object.freeze({ kind, code, ...(detail ? { detail } : {}) })

const stripControl = (value: string, findings: MarkdownHtmlImportFinding[]) => {
  let cleaned = ''
  let removed = false
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index)
    if (isControlChar(code)) {
      removed = true
      continue
    }
    cleaned += value[index]
  }
  if (!removed) return value
  findings.push(finding('removed', 'control-character'))
  return cleaned
}

const isSafeUrl = (value: string) => {
  const trimmed = decodeUrlCharacterReferences(value).trim()
  const schemeProbe = [...trimmed]
    .filter((char) => {
      const code = char.charCodeAt(0)
      return code > 32 && code !== 127
    })
    .join('')
  if (trimmed.length === 0) return false
  if (DANGEROUS_SCHEME.test(schemeProbe)) return false
  if (
    /^[a-z][a-z0-9+.-]*:/i.test(schemeProbe) &&
    !/^(https?:|mailto:)/i.test(schemeProbe)
  ) {
    return false
  }
  return !/url\s*\(/i.test(trimmed)
}

const parseAttrs = (
  raw: string,
  findings: MarkdownHtmlImportFinding[],
  budget: MarkdownHtmlImportBudget,
  stats: { attributes: number },
) => {
  const attrs: Record<string, string> = {}
  const attrRe =
    /([a-z_:][\w:.-]*)(?:\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+)))?/gi
  let match: RegExpExecArray | null
  let seen = 0
  while ((match = attrRe.exec(raw))) {
    stats.attributes += 1
    seen += 1
    if (seen > budget.maxAttributes) {
      findings.push(finding('blocked', 'budget-attributes'))
      break
    }
    const name = match[1]!.toLowerCase()
    const rawValue = stripControl(
      match[3] ?? match[4] ?? match[5] ?? '',
      findings,
    )
    const value =
      name === 'href' || name === 'src'
        ? decodeUrlCharacterReferences(rawValue)
        : rawValue
    if (
      name === 'srcdoc' ||
      name.startsWith('on') ||
      name === 'xmlns' ||
      name === 'xlink:href'
    ) {
      findings.push(finding('blocked', `attr:${name}`))
      continue
    }
    if (name === 'style') {
      findings.push(
        /url\s*\(/i.test(value) || /expression\s*\(/i.test(value)
          ? finding('blocked', 'css-url')
          : finding('removed', 'attr:style'),
      )
      continue
    }
    if (/url\s*\(/i.test(value) || /expression\s*\(/i.test(value)) {
      findings.push(finding('blocked', 'css-url'))
      continue
    }
    if (!ALLOWED_ATTR.has(name)) {
      findings.push(finding('removed', `attr:${name}`))
      continue
    }
    if ((name === 'href' || name === 'src') && !isSafeUrl(value)) {
      findings.push(finding('blocked', 'dangerous-scheme', value.slice(0, 80)))
      continue
    }
    attrs[name] = value
  }
  return attrs
}

const skipUntil = (html: string, from: number, endTag: string) => {
  const close = new RegExp(`</${endTag}\\s*>`, 'i')
  const match = close.exec(html.slice(from))
  return match ? from + match.index + match[0].length : html.length
}

const utf8Bytes = (value: string | undefined) =>
  value ? new TextEncoder().encode(value).byteLength : 0

const serializeNode = (node: MarkdownHtmlImportNode): string => {
  if (node.type === 'text') {
    return node.value.replace(
      /[&<>"']/g,
      (char) =>
        ({
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#39;',
        })[char] ?? char,
    )
  }
  const attrs = Object.entries(node.attrs)
    .map(([name, value]) => ` ${name}="${value.replace(/"/g, '&quot;')}"`)
    .join('')
  if (VOID_TAGS.has(node.tag) && node.children.length === 0) {
    return `<${node.tag}${attrs}>`
  }
  return `<${node.tag}${attrs}>${node.children.map(serializeNode).join('')}</${node.tag}>`
}

export const importMarkdownClipboardSnapshot = (
  snapshot: MarkdownHtmlImportSnapshot,
  options: {
    readonly budget?: MarkdownHtmlImportBudget
    readonly task?: MarkdownHtmlImportTask
    readonly now?: () => number
    readonly signal?: { readonly aborted: boolean }
  } = {},
): MarkdownHtmlImportOutcome => {
  const budget = options.budget ?? MARKDOWN_HTML_IMPORT_BUDGET
  const started = (options.now ?? Date.now)()
  const stats = (): MarkdownHtmlImportStats =>
    Object.freeze({
      bytes,
      nodes,
      depth: maxDepth,
      attributes,
      tableCells,
      images,
      ms: (options.now ?? Date.now)() - started,
    })
  const fail = (
    code: MarkdownHtmlImportReject,
    extra: MarkdownHtmlImportFinding[] = [],
  ): MarkdownHtmlImportOutcome =>
    Object.freeze({
      ok: false,
      code,
      findings: Object.freeze([...findings, ...extra]),
      stats: stats(),
    })

  const findings: MarkdownHtmlImportFinding[] = []
  let nodes = 0
  let maxDepth = 1
  let attributes = 0
  let tableCells = 0
  let images = 0
  const html = snapshot.html ?? ''
  const bytes =
    utf8Bytes(snapshot.html) +
    utf8Bytes(snapshot.plain) +
    utf8Bytes(snapshot.markdown)

  if (!snapshot.explicit)
    return fail('not-explicit', [finding('blocked', 'auto-rich-paste')])
  if (options.task?.cancelled || options.signal?.aborted)
    return fail('cancelled')
  if (bytes > budget.maxBytes) return fail('budget-bytes')
  if (html.length === 0 && !snapshot.plain && !snapshot.markdown)
    return fail('empty')

  const root: OpenElement = { tag: '#root', attrs: {}, children: [] }
  const stack: OpenElement[] = [root]
  let index = 0
  const source = html.replace(/<!--[\s\S]*?-->/g, '')

  while (index < source.length) {
    if (options.task?.cancelled || options.signal?.aborted)
      return fail('cancelled')
    const elapsed = (options.now ?? Date.now)() - started
    if (elapsed > budget.maxMs) return fail('budget-time')
    if (source.startsWith('<!', index) || source.startsWith('<?', index)) {
      const end = source.indexOf('>', index)
      index = end === -1 ? source.length : end + 1
      findings.push(finding('removed', 'declaration'))
      continue
    }

    if (source[index] !== '<') {
      const next = source.indexOf('<', index)
      const raw = source.slice(index, next === -1 ? source.length : next)
      index = next === -1 ? source.length : next
      const value = stripControl(raw, findings)
      if (value.length > 0) {
        nodes += 1
        if (nodes > budget.maxNodes) return fail('budget-nodes')
        stack[stack.length - 1]!.children.push({ type: 'text', value })
      }
      continue
    }

    const close = source.startsWith('</', index)
    const tagMatch = close
      ? /^<\/([a-z][\w:-]*)\s*>/i.exec(source.slice(index))
      : /^<([a-z][\w:-]*)\b([^>]*?)(\/?)>/i.exec(source.slice(index))
    if (!tagMatch) {
      nodes += 1
      if (nodes > budget.maxNodes) return fail('budget-nodes')
      stack[stack.length - 1]!.children.push({ type: 'text', value: '<' })
      index += 1
      continue
    }

    const tag = tagMatch[1]!.toLowerCase()
    index += tagMatch[0].length

    if (close) {
      for (let depth = stack.length - 1; depth > 0; depth -= 1) {
        if (stack[depth]!.tag === tag) {
          stack.length = depth
          break
        }
      }
      continue
    }

    if (FORBIDDEN_TAGS.has(tag)) {
      findings.push(finding('blocked', `tag:${tag}`))
      if (!VOID_TAGS.has(tag) && tagMatch[3] !== '/') {
        index = skipUntil(source, index, tag)
      }
      continue
    }

    if (tag === 'td' || tag === 'th') {
      tableCells += 1
      if (tableCells > budget.maxTableCells) return fail('budget-table-cells')
    }
    if (tag === 'img') {
      images += 1
      if (images > budget.maxImages) return fail('budget-images')
    }

    const depth = stack.length
    if (depth > budget.maxDepth) return fail('budget-depth')
    maxDepth = Math.max(maxDepth, depth)
    nodes += 1
    if (nodes > budget.maxNodes) return fail('budget-nodes')

    const attrStats = { attributes }
    const attrs = parseAttrs(tagMatch[2] ?? '', findings, budget, attrStats)
    attributes = attrStats.attributes
    if (!ALLOWED_TAGS.has(tag)) {
      findings.push(finding('unsupported', `tag:${tag}`))
      continue
    }

    const element: OpenElement = { tag, attrs, children: [] }
    const node: MarkdownHtmlImportNode = {
      type: 'element',
      tag,
      attrs: Object.freeze({ ...attrs }),
      children: element.children,
    }
    stack[stack.length - 1]!.children.push(node)
    if (!VOID_TAGS.has(tag) && tagMatch[3] !== '/') {
      stack.push(element)
    }
  }

  if (snapshot.plain && root.children.length === 0) {
    nodes += 1
    if (nodes > budget.maxNodes) return fail('budget-nodes')
    root.children.push({
      type: 'text',
      value: stripControl(snapshot.plain, findings),
    })
  }

  return Object.freeze({
    ok: true,
    tree: Object.freeze({
      schemaVersion: MARKDOWN_HTML_IMPORT_SCHEMA_VERSION,
      importerVersion: MARKDOWN_HTML_IMPORT_IMPORTER_VERSION,
      nodes: Object.freeze(root.children.slice()),
    }),
    findings: Object.freeze(findings),
    stats: stats(),
  })
}

export interface MarkdownHtmlImportResult {
  readonly html: string
  readonly rejected: readonly string[]
  readonly tree?: MarkdownHtmlImportTree
  readonly findings?: readonly MarkdownHtmlImportFinding[]
}

export const sanitizeMarkdownHtmlImport = (
  html: string,
): MarkdownHtmlImportResult => {
  const outcome = importMarkdownClipboardSnapshot({ html, explicit: true })
  if (outcome.ok === false) {
    return Object.freeze({
      html: '',
      rejected: Object.freeze([outcome.code]),
      findings: outcome.findings,
    })
  }
  return Object.freeze({
    html: outcome.tree.nodes.map(serializeNode).join(''),
    rejected: Object.freeze(
      outcome.findings.map((item) => item.code.replace(/^(?:tag|attr):/, '')),
    ),
    tree: outcome.tree,
    findings: outcome.findings,
  })
}

export type MarkdownHtmlImportMutationKind =
  | 'live-dom-insertion'
  | 'network-load'
  | 'script-execution'
  | 'auto-rich-paste'
  | 'external-service'

export const evaluateMarkdownHtmlImportMutations = (html: string) => {
  const authority = importMarkdownClipboardSnapshot({ html, explicit: true })
  const implicit = importMarkdownClipboardSnapshot({ html, explicit: false })
  const serialized = authority.ok
    ? authority.tree.nodes.map(serializeNode).join('')
    : ''
  return Object.freeze({
    authority,
    mutations: Object.freeze([
      Object.freeze({
        kind: 'live-dom-insertion' as const,
        equivalent:
          typeof document !== 'undefined' && serialized.includes('innerHTML'),
        accepted: false,
      }),
      Object.freeze({
        kind: 'network-load' as const,
        equivalent:
          /https?:\/\//i.test(serialized) &&
          /<(script|iframe|link|img)/i.test(serialized) &&
          Boolean((authority as { fetched?: boolean }).fetched),
        accepted: false,
      }),
      Object.freeze({
        kind: 'script-execution' as const,
        equivalent: /<script/i.test(serialized),
        accepted: false,
      }),
      Object.freeze({
        kind: 'auto-rich-paste' as const,
        equivalent: implicit.ok,
        accepted: false,
      }),
      Object.freeze({
        kind: 'external-service' as const,
        equivalent: false,
        accepted: false,
      }),
    ]),
  })
}
