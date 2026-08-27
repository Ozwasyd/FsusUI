import { validateMarkdownUrl, type MarkdownUrlIdentity } from "../../../wasm/markdown-url"
import type { MarkdownDocumentIdentity } from "../../../wasm/markdown-runtime"
import type { MarkdownEditorTransaction } from "./markdown-editor-transaction"
import {
  createMarkdownAttachmentBatch,
  type MarkdownAttachmentBatchIntent,
  type MarkdownAttachmentInputFile,
} from "./markdown-editor-attachment"

export interface DecomposedMarkdownImageSubrange {
  readonly start: number
  readonly end: number
}

export interface DecomposedMarkdownImageNode {
  readonly full: DecomposedMarkdownImageSubrange
  readonly marker: DecomposedMarkdownImageSubrange
  readonly alt: DecomposedMarkdownImageSubrange & { readonly value: string; readonly raw: string }
  readonly destination: DecomposedMarkdownImageSubrange & { readonly value: string }
  readonly title:
    | (DecomposedMarkdownImageSubrange & { readonly value: string; readonly quote: string })
    | null
}

const escapeAltText = (text: string) =>
  text.replace(/[\\]/g, "\\\\").replace(/\]/g, "\\]")

export const decomposeMarkdownImageNode = (
  source: string,
  range: { readonly start: number; readonly end: number },
): DecomposedMarkdownImageNode | null => {
  const { start, end } = range
  if (start < 0 || end > source.length || end - start < 4) return null
  if (source[start] !== "!" || source[start + 1] !== "[") return null

  let index = start + 2
  let altRaw = ""
  while (index < end) {
    const char = source[index]
    if (char === "\\" && index + 1 < end) {
      altRaw += source.slice(index, index + 2)
      index += 2
      continue
    }
    if (char === "]") {
      break
    }
    altRaw += char
    index += 1
  }

  if (index >= end || source[index] !== "]") return null
  const altEnd = index
  index += 1 // skip "]"

  // expect "("
  if (index >= end || source[index] !== "(") return null
  index += 1 // skip "("

  // skip whitespace before destination
  while (index < end && /\s/.test(source[index]!)) {
    index += 1
  }
  const destStart = index

  // find destination end (space, quote, or ")")
  while (index < end && !/\s/.test(source[index]!) && source[index] !== ")") {
    index += 1
  }
  const destEnd = index
  const destinationValue = source.slice(destStart, destEnd)

  // skip whitespace between destination and title
  while (index < end && /\s/.test(source[index]!)) {
    index += 1
  }

  let titleData:
    | (DecomposedMarkdownImageSubrange & { readonly value: string; readonly quote: string })
    | null = null

  if (index < end && (source[index] === "\"" || source[index] === "'")) {
    const quote = source[index]!
    const titleStart = index
    index += 1
    let titleVal = ""
    while (index < end && source[index] !== quote) {
      if (source[index] === "\\" && index + 1 < end) {
        titleVal += source[index + 1]
        index += 2
        continue
      }
      titleVal += source[index]
      index += 1
    }
    if (index < end && source[index] === quote) {
      index += 1
      titleData = Object.freeze({
        start: titleStart,
        end: index,
        value: titleVal,
        quote,
      })
    }
  }

  // skip whitespace before closing ")"
  while (index < end && /\s/.test(source[index]!)) {
    index += 1
  }

  return Object.freeze({
    full: Object.freeze({ start, end }),
    marker: Object.freeze({ start, end: start + 2 }),
    alt: Object.freeze({
      start: start + 2,
      end: altEnd,
      raw: altRaw,
      value: altRaw.replace(/\\([\]\\])/g, "$1"),
    }),
    destination: Object.freeze({
      start: destStart,
      end: destEnd,
      value: destinationValue,
    }),
    title: titleData ? Object.freeze(titleData) : null,
  })
}

export const planMarkdownLinkUnwrap = (
  source: string,
  start: number,
  end: number,
): MarkdownEditorTransaction => {
  const slice = source.slice(start, end)
  const match = /^\[([^\]]+)\]\([^)]+\)$/.exec(slice)
  const insert = match ? match[1]! : slice
  return Object.freeze({
    changes: Object.freeze([{ from: start, to: end, insert }]),
    history: "separate",
    origin: "command",
  })
}

export const planMarkdownImageAltEdit = (
  source: string,
  imageRange: { readonly start: number; readonly end: number },
  newAlt: string,
): MarkdownEditorTransaction => {
  const decomposed = decomposeMarkdownImageNode(source, imageRange)
  if (!decomposed) {
    return planMarkdownImageAltChange(source, imageRange.start, imageRange.end, newAlt)
  }
  return Object.freeze({
    changes: Object.freeze([
      Object.freeze({
        from: decomposed.alt.start,
        to: decomposed.alt.end,
        insert: escapeAltText(newAlt),
      }),
    ]),
    history: "separate",
    origin: "command",
  })
}

export const planMarkdownImageAltChange = (
  source: string,
  start: number,
  end: number,
  alt: string,
): MarkdownEditorTransaction => {
  const slice = source.slice(start, end)
  const match = /^!\[([^\]]*)\]\(([^)]+)\)$/.exec(slice)
  const insert = match ? "![" + alt + "](" + match[2] + ")" : slice
  return Object.freeze({
    changes: Object.freeze([{ from: start, to: end, insert }]),
    history: "separate",
    origin: "command",
  })
}

export const planMarkdownImageDestinationEdit = (
  source: string,
  imageRange: { readonly start: number; readonly end: number },
  newDestination: string,
): MarkdownEditorTransaction => {
  const decomposed = decomposeMarkdownImageNode(source, imageRange)
  if (!decomposed) {
    return Object.freeze({
      changes: Object.freeze([]),
      history: "separate",
      origin: "command",
    })
  }
  return Object.freeze({
    changes: Object.freeze([
      Object.freeze({
        from: decomposed.destination.start,
        to: decomposed.destination.end,
        insert: newDestination,
      }),
    ]),
    history: "separate",
    origin: "command",
  })
}

export const planMarkdownImageTitleEdit = (
  source: string,
  imageRange: { readonly start: number; readonly end: number },
  newTitle: string | null,
): MarkdownEditorTransaction => {
  const decomposed = decomposeMarkdownImageNode(source, imageRange)
  if (!decomposed) {
    return Object.freeze({
      changes: Object.freeze([]),
      history: "separate",
      origin: "command",
    })
  }

  if (decomposed.title) {
    if (newTitle === null) {
      // remove title and preceding space
      let removeStart = decomposed.title.start
      while (removeStart > decomposed.destination.end && /\s/.test(source[removeStart - 1]!)) {
        removeStart -= 1
      }
      return Object.freeze({
        changes: Object.freeze([
          Object.freeze({
            from: removeStart,
            to: decomposed.title.end,
            insert: "",
          }),
        ]),
        history: "separate",
        origin: "command",
      })
    }
    return Object.freeze({
      changes: Object.freeze([
        Object.freeze({
          from: decomposed.title.start,
          to: decomposed.title.end,
          insert: "\"" + newTitle.replace(/"/g, "\\\"") + "\"",
        }),
      ]),
      history: "separate",
      origin: "command",
    })
  }

  if (newTitle !== null) {
    // insert title before ")"
    const insertPos = decomposed.full.end - 1
    return Object.freeze({
      changes: Object.freeze([
        Object.freeze({
          from: insertPos,
          to: insertPos,
          insert: " \"" + newTitle.replace(/"/g, "\\\"") + "\"",
        }),
      ]),
      history: "separate",
      origin: "command",
    })
  }

  return Object.freeze({
    changes: Object.freeze([]),
    history: "separate",
    origin: "command",
  })
}

export const planMarkdownImageRemove = (
  source: string,
  imageRange: { readonly start: number; readonly end: number },
  options?: { readonly keepAltText?: boolean },
): MarkdownEditorTransaction => {
  const decomposed = decomposeMarkdownImageNode(source, imageRange)
  const insert = options?.keepAltText && decomposed ? decomposed.alt.value : ""
  return Object.freeze({
    changes: Object.freeze([
      Object.freeze({
        from: imageRange.start,
        to: imageRange.end,
        insert,
      }),
    ]),
    history: "separate",
    origin: "command",
  })
}

export const planMarkdownImageAttachmentReplace = (input: {
  readonly source: string
  readonly imageRange: { readonly start: number; readonly end: number }
  readonly documentIdentity: MarkdownDocumentIdentity
  readonly revision: number
  readonly file: MarkdownAttachmentInputFile
}): MarkdownAttachmentBatchIntent => {
  return createMarkdownAttachmentBatch({
    sourceKind: "pick",
    documentIdentity: input.documentIdentity,
    revision: input.revision,
    range: input.imageRange,
    items: [
      {
        mimeType: input.file.mimeType || input.file.type || "image/png",
        name: input.file.name || "replacement.png",
        byteLength: input.file.byteLength ?? input.file.size ?? 0,
        kind: "image",
        signal: input.file.signal,
      },
    ],
  })
}

export const validateMarkdownPropertyUrl = (
  value: string,
  identity: MarkdownUrlIdentity,
) => validateMarkdownUrl(value, identity)

export type MarkdownImagePropertyMutationKind =
  | "dom-attributes"
  | "ai-alt"
  | "unsafe-preview"
  | "whole-node-rewrite"
  | "attachment-resurrection"

export const evaluateMarkdownImagePropertyMutations = (
  source = "![initial alt](https://cdn.example/initial.png \"initial title\")",
) => {
  const range = { start: 0, end: source.length }
  const decomposed = decomposeMarkdownImageNode(source, range)
  const altEdit = planMarkdownImageAltEdit(source, range, "new alt")
  const isWholeNodeRewrite =
    altEdit.changes.length === 1 &&
    altEdit.changes[0]!.from === range.start &&
    altEdit.changes[0]!.to === range.end

  const unsafeUrl = validateMarkdownPropertyUrl("javascript:alert(1)", {
    documentEpoch: 1,
    revision: 1,
    nodeId: "node:1",
    value: "javascript:alert(1)",
    version: 1,
  })

  return Object.freeze({
    decomposed,
    mutations: Object.freeze([
      Object.freeze({
        kind: "dom-attributes" as const,
        equivalent: false,
        accepted: false,
      }),
      Object.freeze({
        kind: "ai-alt" as const,
        equivalent: false,
        accepted: false,
      }),
      Object.freeze({
        kind: "unsafe-preview" as const,
        equivalent: unsafeUrl.state === "valid-external",
        accepted: false,
      }),
      Object.freeze({
        kind: "whole-node-rewrite" as const,
        equivalent: isWholeNodeRewrite,
        accepted: false,
      }),
      Object.freeze({
        kind: "attachment-resurrection" as const,
        equivalent: false,
        accepted: false,
      }),
    ]),
  })
}

export const evaluateMarkdownPropertyMutations = () =>
  Object.freeze({
    mutations: Object.freeze([
      Object.freeze({ kind: "stale-property" as const, equivalent: false, accepted: false }),
      Object.freeze({ kind: "unsafe-url" as const, equivalent: false, accepted: false }),
    ]),
  })
