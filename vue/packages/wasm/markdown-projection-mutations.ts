import {
  MARKDOWN_EDITOR_PROJECTION_PARSER,
  MARKDOWN_EDITOR_REQUIRED_SYNTAX_KINDS,
  createMarkdownEditorProjection,
  markdownEditorProjectionsEquivalent,
  presentationForSyntaxKind,
  type MarkdownEditorProjectionResult,
  type MarkdownEditorRequiredSyntaxKind,
  type MarkdownEditorSyntaxNode,
} from './markdown-editor-projection'

export type MarkdownProjectionMutationKind =
  | 'html-dom-reverse'
  | 'html-innerhtml-reverse'
  | 'dom-path-reverse'
  | 'second-parser-regex'
  | 'missing-syntax-coverage'

export interface MarkdownProjectionMutationResult {
  readonly kind: MarkdownProjectionMutationKind
  readonly equivalent: boolean
  readonly accepted: boolean
  readonly detail: string
}

export interface MarkdownProjectionMutationReport {
  readonly authority: MarkdownEditorProjectionResult
  readonly mutations: readonly MarkdownProjectionMutationResult[]
}

const visibleTextOf = (kind: string, slice: string) => {
  if (kind === 'heading') {
    return slice.replace(/^#{1,6}\s+/, '').trim()
  }
  if (kind === 'link') {
    const match = /^\[([^\]]*)\]\(/.exec(slice)
    return match?.[1] ?? slice
  }
  if (kind === 'image') {
    const match = /^!\[([^\]]*)\]\(/.exec(slice)
    return match?.[1] ?? slice
  }
  return slice.trim()
}

const cloneAuthority = (
  authority: MarkdownEditorProjectionResult,
  nodes: readonly MarkdownEditorSyntaxNode[],
  kinds: readonly MarkdownEditorRequiredSyntaxKind[] = authority.syntaxCoverage.kinds,
): MarkdownEditorProjectionResult =>
  Object.freeze({
    identity: authority.identity,
    nodes: Object.freeze(nodes),
    diagnostics: authority.diagnostics,
    syntaxCoverage: Object.freeze({
      ...authority.syntaxCoverage,
      kinds: Object.freeze([...kinds]),
    }),
  })

const reverseProjectFromHtml = (
  source: string,
  authority: MarkdownEditorProjectionResult,
): MarkdownEditorProjectionResult => {
  const nodes = authority.nodes.map((node) => {
    const slice = source.slice(node.rawRange.start, node.rawRange.end)
    const visible = visibleTextOf(node.kind, slice)
    const start = visible ? source.indexOf(visible) : node.rawRange.start
    const end = start >= 0 ? start + visible.length : node.rawRange.end
    return Object.freeze({
      ...node,
      rawRange: Object.freeze({ start: Math.max(0, start), end }),
      normalizedRange: Object.freeze({ start: Math.max(0, start), end }),
    })
  })
  return cloneAuthority(authority, nodes)
}

type FakeDomNode = {
  readonly tag: string
  readonly text: string
  readonly children: readonly FakeDomNode[]
}

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

const kindToTag = (kind: string): string => {
  if (kind === 'heading') return 'h1'
  if (kind === 'list' || kind === 'task') return 'li'
  if (kind === 'quote') return 'blockquote'
  if (kind === 'table') return 'td'
  if (kind === 'link') return 'a'
  if (kind === 'image') return 'img'
  if (kind === 'code') return 'code'
  return 'p'
}

const collectDomNodes = (
  node: FakeDomNode,
  tag: string,
  found: FakeDomNode[] = [],
): FakeDomNode[] => {
  if (node.tag === tag) found.push(node)
  for (const child of node.children) collectDomNodes(child, tag, found)
  return found
}

const textOfDom = (node: FakeDomNode): string => {
  if (node.text) return node.text
  return node.children.map((child) => textOfDom(child)).join('')
}

const renderInnerHtml = (source: string): { html: string; root: FakeDomNode } => {
  const normalized = source.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n')
  const children: FakeDomNode[] = []
  const htmlParts = ['<article>']

  for (const line of normalized.split('\n')) {
    const heading = /^(#{1,6})\s+(.*)$/.exec(line)
    if (heading) {
      const depth = heading[1]!.length
      const text = heading[2] ?? ''
      children.push({ tag: `h${depth}`, text, children: [] })
      htmlParts.push(`<h${depth}>${escapeHtml(text)}</h${depth}>`)
      continue
    }
    if (/^[-*+]\s+/.test(line) || /^\d+\.\s+/.test(line)) {
      const text = line.replace(/^([-*+]|\d+\.)\s+/, '')
      const item: FakeDomNode = { tag: 'li', text, children: [] }
      children.push({ tag: 'ul', text: '', children: [item] })
      htmlParts.push(`<ul><li>${escapeHtml(text)}</li></ul>`)
      continue
    }
    if (/^\|/.test(line) && !/^\|[\s:|-]+\|$/.test(line.trim())) {
      const cells = line
        .split('|')
        .slice(1, -1)
        .map((cell) => cell.trim())
      const cellNodes = cells.map((text) => ({
        tag: 'td',
        text,
        children: [] as FakeDomNode[],
      }))
      children.push({
        tag: 'table',
        text: '',
        children: [{ tag: 'tr', text: '', children: cellNodes }],
      })
      htmlParts.push(
        `<table><tr>${cells
          .map((cell) => `<td>${escapeHtml(cell)}</td>`)
          .join('')}</tr></table>`,
      )
      continue
    }
    if (/^>\s?/.test(line)) {
      const text = line.replace(/^>\s?/, '')
      children.push({ tag: 'blockquote', text, children: [] })
      htmlParts.push(`<blockquote>${escapeHtml(text)}</blockquote>`)
      continue
    }
    if (!line.trim()) continue

    const linkNodes: FakeDomNode[] = []
    const htmlLine = line.replace(
      /!?\[([^\]]*)\]\(([^)]*)\)/g,
      (full, label: string, href: string) => {
        if (full.startsWith('!')) {
          linkNodes.push({ tag: 'img', text: label, children: [] })
          return `<img alt="${escapeHtml(label)}" src="${escapeHtml(href)}">`
        }
        linkNodes.push({ tag: 'a', text: label, children: [] })
        return `<a href="${escapeHtml(href)}">${escapeHtml(label)}</a>`
      },
    )
    children.push({
      tag: 'p',
      text: line.replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1'),
      children: linkNodes,
    })
    htmlParts.push(`<p>${htmlLine}</p>`)
  }

  htmlParts.push('</article>')
  return {
    html: htmlParts.join(''),
    root: { tag: 'article', text: '', children },
  }
}

const reverseProjectFromInnerHtml = (
  source: string,
  authority: MarkdownEditorProjectionResult,
): MarkdownEditorProjectionResult => {
  const { html } = renderInnerHtml(source)
  const nodes = authority.nodes.map((node) => {
    const slice = source.slice(node.rawRange.start, node.rawRange.end)
    const visible = visibleTextOf(node.kind, slice)
    const needle = visible ? escapeHtml(visible) : ''
    const htmlIndex = needle ? html.indexOf(needle) : -1
    const start = htmlIndex >= 0 ? htmlIndex : 0
    const end = start + (visible ? visible.length : 0)
    return Object.freeze({
      ...node,
      rawRange: Object.freeze({ start, end }),
      normalizedRange: Object.freeze({ start, end }),
      parentRawRange: null,
      parentNormalizedRange: null,
      childRawRanges: Object.freeze([]),
      childNormalizedRanges: Object.freeze([]),
    })
  })
  return cloneAuthority(authority, nodes)
}

const reverseProjectFromDomPath = (
  source: string,
  authority: MarkdownEditorProjectionResult,
): MarkdownEditorProjectionResult => {
  const { root } = renderInnerHtml(source)
  const used = new Map<string, number>()
  const nodes = authority.nodes.map((node) => {
    const tag = kindToTag(node.kind)
    const matches = collectDomNodes(root, tag)
    const ordinal = used.get(tag) ?? 0
    used.set(tag, ordinal + 1)
    const element = matches[ordinal] ?? matches[0]
    const visible =
      element && textOfDom(element)
        ? textOfDom(element)
        : visibleTextOf(
            node.kind,
            source.slice(node.rawRange.start, node.rawRange.end),
          )
    const start = visible ? source.indexOf(visible) : node.rawRange.start
    const end = start >= 0 ? start + visible.length : node.rawRange.end
    const parentText = element ? textOfDom(root) : ''
    const parentStart = parentText ? source.indexOf(parentText) : -1
    const childRanges = (element?.children ?? []).map((child) => {
      const text = textOfDom(child)
      const childStart = text ? source.indexOf(text) : start
      return Object.freeze({
        start: Math.max(0, childStart),
        end: Math.max(0, childStart) + text.length,
      })
    })
    return Object.freeze({
      ...node,
      rawRange: Object.freeze({
        start: Math.max(0, start),
        end: Math.max(0, end),
      }),
      normalizedRange: Object.freeze({
        start: Math.max(0, start),
        end: Math.max(0, end),
      }),
      parentRawRange:
        parentStart >= 0
          ? Object.freeze({
              start: parentStart,
              end: parentStart + parentText.length,
            })
          : null,
      parentNormalizedRange:
        parentStart >= 0
          ? Object.freeze({
              start: parentStart,
              end: parentStart + parentText.length,
            })
          : null,
      childRawRanges: Object.freeze(childRanges),
      childNormalizedRanges: Object.freeze(childRanges),
    })
  })
  return cloneAuthority(authority, nodes)
}

const reverseProjectFromRegex = (
  source: string,
  authority: MarkdownEditorProjectionResult,
): MarkdownEditorProjectionResult => {
  const nodes: MarkdownEditorSyntaxNode[] = []
  const heading = /^#{1,6} .+$/gm
  for (const match of source.matchAll(heading)) {
    const start = match.index ?? 0
    nodes.push(
      Object.freeze({
        kind: 'heading',
        presentation: presentationForSyntaxKind('heading'),
        rawRange: Object.freeze({ start, end: start + match[0].length }),
        normalizedRange: Object.freeze({ start, end: start + match[0].length }),
        parentRawRange: null,
        parentNormalizedRange: null,
        childRawRanges: Object.freeze([]),
        childNormalizedRanges: Object.freeze([]),
      }),
    )
  }
  const link = /!?\[([^\]]*)\]\(([^)]*)\)/g
  for (const match of source.matchAll(link)) {
    const start = match.index ?? 0
    const kind = match[0].startsWith('!') ? 'image' : 'link'
    nodes.push(
      Object.freeze({
        kind,
        presentation: presentationForSyntaxKind(kind),
        rawRange: Object.freeze({ start, end: start + match[0].length }),
        normalizedRange: Object.freeze({ start, end: start + match[0].length }),
        parentRawRange: null,
        parentNormalizedRange: null,
        childRawRanges: Object.freeze([]),
        childNormalizedRanges: Object.freeze([]),
      }),
    )
  }
  return cloneAuthority(authority, nodes)
}

const stripCoverageKind = (
  authority: MarkdownEditorProjectionResult,
  kind: MarkdownEditorRequiredSyntaxKind,
): MarkdownEditorProjectionResult =>
  cloneAuthority(
    authority,
    authority.nodes,
    authority.syntaxCoverage.kinds.filter((item) => item !== kind),
  )

export const markdownProjectionHasCompleteCoverage = (
  projection: MarkdownEditorProjectionResult,
): boolean => {
  if (projection.syntaxCoverage.parser !== MARKDOWN_EDITOR_PROJECTION_PARSER) {
    return false
  }
  const kinds = new Set(projection.syntaxCoverage.kinds)
  if (
    !MARKDOWN_EDITOR_REQUIRED_SYNTAX_KINDS.every((kind) => kinds.has(kind))
  ) {
    return false
  }
  return projection.nodes.every((node) => {
    try {
      return presentationForSyntaxKind(node.kind) === node.presentation
    } catch {
      return false
    }
  })
}

export const evaluateMarkdownProjectionMutations = (
  source: string,
): MarkdownProjectionMutationReport => {
  const authority = createMarkdownEditorProjection(source)
  const htmlReverse = reverseProjectFromHtml(source, authority)
  const innerHtmlReverse = reverseProjectFromInnerHtml(source, authority)
  const domPathReverse = reverseProjectFromDomPath(source, authority)
  const regexReverse = reverseProjectFromRegex(source, authority)
  const missingCoverage = stripCoverageKind(authority, 'malformed')
  const htmlEquivalent = markdownEditorProjectionsEquivalent(
    authority,
    htmlReverse,
  )
  const innerHtmlEquivalent = markdownEditorProjectionsEquivalent(
    authority,
    innerHtmlReverse,
  )
  const domPathEquivalent = markdownEditorProjectionsEquivalent(
    authority,
    domPathReverse,
  )
  const regexEquivalent = markdownEditorProjectionsEquivalent(
    authority,
    regexReverse,
  )
  const coverageEquivalent = markdownEditorProjectionsEquivalent(
    authority,
    missingCoverage,
  )

  return Object.freeze({
    authority,
    mutations: Object.freeze([
      Object.freeze({
        kind: 'html-dom-reverse' as const,
        equivalent: htmlEquivalent,
        accepted:
          htmlEquivalent && markdownProjectionHasCompleteCoverage(htmlReverse),
        detail: 'html-indexOf visible text is not the sole parser',
      }),
      Object.freeze({
        kind: 'html-innerhtml-reverse' as const,
        equivalent: innerHtmlEquivalent,
        accepted:
          innerHtmlEquivalent &&
          markdownProjectionHasCompleteCoverage(innerHtmlReverse),
        detail: 'innerHTML text offsets are not raw source ranges',
      }),
      Object.freeze({
        kind: 'dom-path-reverse' as const,
        equivalent: domPathEquivalent,
        accepted:
          domPathEquivalent &&
          markdownProjectionHasCompleteCoverage(domPathReverse),
        detail: 'DOM path and rendered text are not the sole parser',
      }),
      Object.freeze({
        kind: 'second-parser-regex' as const,
        equivalent: regexEquivalent,
        accepted:
          regexEquivalent && markdownProjectionHasCompleteCoverage(regexReverse),
        detail: 'regex scan is a second parser',
      }),
      Object.freeze({
        kind: 'missing-syntax-coverage' as const,
        equivalent: coverageEquivalent,
        accepted: markdownProjectionHasCompleteCoverage(missingCoverage),
        detail: 'required syntax kinds must stay registered',
      }),
    ]),
  })
}
