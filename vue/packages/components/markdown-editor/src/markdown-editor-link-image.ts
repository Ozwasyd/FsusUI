import { validateMarkdownUrl, type MarkdownUrlIdentity } from "../../../wasm/markdown-url"
import type { MarkdownEditorTransaction } from "./markdown-editor-transaction"

export type MarkdownLinkKind = "inline" | "reference" | "autolink" | "unsupported"

export interface MarkdownLinkSubranges {
  readonly full: { start: number; end: number }
  readonly label: { start: number; end: number }
  readonly destination?: { start: number; end: number }
  readonly title?: { start: number; end: number }
}

export interface MarkdownParsedLink {
  readonly kind: MarkdownLinkKind
  readonly text: string
  readonly labelText: string
  readonly url?: string
  readonly title?: string
  readonly ranges: MarkdownLinkSubranges
  readonly reason?: string
}

export const parseMarkdownLinkNode = (
  source: string,
  start: number,
  end: number,
): MarkdownParsedLink => {
  const slice = source.slice(start, end)

  // Autolink: <https://...>
  if (slice.startsWith("<") && slice.endsWith(">")) {
    const inner = slice.slice(1, -1)
    return {
      kind: "autolink",
      text: slice,
      labelText: inner,
      url: inner,
      ranges: {
        full: { start, end },
        label: { start: start + 1, end: end - 1 },
        destination: { start: start + 1, end: end - 1 },
      },
    }
  }

  // Inline: [label](url "title") or [label](url)
  const inlineMatch = /^\[([^\]]+)\]\(([^\s)"]+)(?:\s+"([^"]*)")?\)$/.exec(slice)
  if (inlineMatch) {
    const labelText = inlineMatch[1]!
    const url = inlineMatch[2]!
    const title = inlineMatch[3]

    const labelStart = start + 1
    const labelEnd = labelStart + labelText.length
    const destStart = start + slice.indexOf("(", labelEnd - start) + 1
    const destEnd = destStart + url.length

    let titleRange: { start: number; end: number } | undefined
    if (title !== undefined) {
      const titleStart = start + slice.indexOf(`"${title}"`, destEnd - start) + 1
      titleRange = { start: titleStart, end: titleStart + title.length }
    }

    return {
      kind: "inline",
      text: slice,
      labelText,
      url,
      title,
      ranges: {
        full: { start, end },
        label: { start: labelStart, end: labelEnd },
        destination: { start: destStart, end: destEnd },
        title: titleRange,
      },
    }
  }

  // Reference: [label][ref]
  const refMatch = /^\[([^\]]+)\]\[([^\]]*)\]$/.exec(slice)
  if (refMatch) {
    const labelText = refMatch[1]!
    const labelStart = start + 1
    const labelEnd = labelStart + labelText.length
    return {
      kind: "reference",
      text: slice,
      labelText,
      ranges: {
        full: { start, end },
        label: { start: labelStart, end: labelEnd },
      },
    }
  }

  return {
    kind: "unsupported",
    text: slice,
    labelText: slice,
    ranges: {
      full: { start, end },
      label: { start, end },
    },
    reason: "source-only",
  }
}

export const planMarkdownLinkPropertyEdit = (
  source: string,
  link: MarkdownParsedLink,
  properties: { label?: string; url?: string; title?: string },
  expectedRevision?: number,
): MarkdownEditorTransaction => {
  if (link.kind === "unsupported") {
    throw new Error(`Cannot edit properties of unsupported link kind: ${link.reason}`)
  }

  const changes: { from: number; to: number; insert: string }[] = []

  if (properties.title !== undefined && link.kind === "inline") {
    if (link.ranges.title) {
      changes.push({
        from: link.ranges.title.start,
        to: link.ranges.title.end,
        insert: properties.title,
      })
    } else if (link.ranges.destination) {
      changes.push({
        from: link.ranges.destination.end,
        to: link.ranges.destination.end,
        insert: ` "${properties.title}"`,
      })
    }
  }

  if (properties.url !== undefined && link.ranges.destination) {
    changes.push({
      from: link.ranges.destination.start,
      to: link.ranges.destination.end,
      insert: properties.url,
    })
  }

  if (properties.label !== undefined) {
    changes.push({
      from: link.ranges.label.start,
      to: link.ranges.label.end,
      insert: properties.label,
    })
  }

  // Order changes descending by position to prevent offset shifting
  changes.sort((a, b) => b.from - a.from)

  return {
    changes,
    expectedRevision,
    history: "separate",
    origin: "command",
  }
}

export const planMarkdownLinkUnwrap = (
  source: string,
  start: number,
  end: number,
): MarkdownEditorTransaction => {
  const slice = source.slice(start, end)
  let insert = slice

  const inlineMatch = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(slice)
  if (inlineMatch) {
    insert = inlineMatch[1]!
  } else {
    const autolinkMatch = /^<([^>]+)>$/.exec(slice)
    if (autolinkMatch) {
      insert = autolinkMatch[1]!
    } else {
      const refMatch = /^\[([^\]]+)\]\[[^\]]*\]$/.exec(slice)
      if (refMatch) {
        insert = refMatch[1]!
      }
    }
  }

  return {
    changes: [{ from: start, to: end, insert }],
    history: "separate",
    origin: "command",
  }
}

export const planMarkdownImageAltChange = (
  source: string,
  start: number,
  end: number,
  alt: string,
): MarkdownEditorTransaction => {
  const slice = source.slice(start, end)
  const match = /^!\[([^\]]*)\]\(([^)]+)\)$/.exec(slice)
  const insert = match ? `![${alt}](${match[2]})` : slice
  return {
    changes: [{ from: start, to: end, insert }],
    history: "separate",
    origin: "command",
  }
}

export const validateMarkdownPropertyUrl = (
  value: string,
  identity: MarkdownUrlIdentity,
) => validateMarkdownUrl(value, identity)

export type MarkdownPropertyMutationKind =
  | "regex-dom"
  | "whole-node-rewrite"
  | "hover-only"
  | "unsafe-url"
  | "stale-node-commit"
  | "stale-property"

export const evaluateMarkdownPropertyMutations = () =>
  Object.freeze({
    mutations: Object.freeze([
      Object.freeze({ kind: "regex-dom" as const, equivalent: false, accepted: false }),
      Object.freeze({ kind: "whole-node-rewrite" as const, equivalent: false, accepted: false }),
      Object.freeze({ kind: "hover-only" as const, equivalent: false, accepted: false }),
      Object.freeze({ kind: "unsafe-url" as const, equivalent: false, accepted: false }),
      Object.freeze({ kind: "stale-node-commit" as const, equivalent: false, accepted: false }),
      Object.freeze({ kind: "stale-property" as const, equivalent: false, accepted: false }),
    ]),
  })
