import {
  MARKDOWN_ANCHOR_ID,
  collectMarkdownAnchorNodes,
  type MarkdownAnchorValidNode,
} from "../../../wasm/markdown-anchor-grammar"
import type { MarkdownEditorTransaction } from "./markdown-editor-transaction"

export const currentMarkdownAnchors = (source: string) =>
  collectMarkdownAnchorNodes(source).filter((node): node is MarkdownAnchorValidNode => node.ok)

export const planMarkdownAnchorInsert = (
  source: string,
  offset: number,
  id: string,
  options?: { placement?: "line-end" | "following-line" },
): MarkdownEditorTransaction => {
  if (!MARKDOWN_ANCHOR_ID.test(id)) {
    throw new Error(`Invalid anchor id "${id}": must match [a-z][a-z0-9-]{0,63}`)
  }

  const existing = currentMarkdownAnchors(source)
  if (existing.some((node) => node.id === id)) {
    throw new Error(`Duplicate anchor id "${id}" is not permitted`)
  }

  const newline = source.includes("\r\n") ? "\r\n" : "\n"
  const isFollowingLine = options?.placement === "following-line"
  const insertText = isFollowingLine ? `${newline}^${id}` : ` ^${id}`

  return {
    changes: [{ from: offset, to: offset, insert: insertText }],
    history: "separate",
    origin: "command",
  }
}

export const planMarkdownAnchorEdit = (
  source: string,
  node: MarkdownAnchorValidNode,
  newId: string,
): MarkdownEditorTransaction => {
  if (!MARKDOWN_ANCHOR_ID.test(newId)) {
    throw new Error(`Invalid anchor id "${newId}": must match [a-z][a-z0-9-]{0,63}`)
  }

  const existing = currentMarkdownAnchors(source)
  if (existing.some((existingNode) => existingNode.id === newId && existingNode.ranges.full.start !== node.ranges.full.start)) {
    throw new Error(`Duplicate anchor id "${newId}" is not permitted`)
  }

  return {
    changes: [
      {
        from: node.ranges.id.start,
        to: node.ranges.id.end,
        insert: newId,
      },
    ],
    history: "separate",
    origin: "command",
  }
}

export const planMarkdownAnchorRemove = (
  node: MarkdownAnchorValidNode,
  source?: string,
): MarkdownEditorTransaction => {
  let from = node.ranges.full.start
  const to = node.ranges.full.end

  if (source && from > 0 && source[from - 1] === " " && node.placement === "line-end") {
    from -= 1
  }

  return {
    changes: [{ from, to, insert: "" }],
    history: "separate",
    origin: "command",
  }
}

export const planMarkdownAnchorCopy = (
  node: MarkdownAnchorValidNode,
  mode: "exact" | "visible",
): string => {
  if (mode === "exact") {
    return `^${node.id}`
  }
  return ""
}

export const planMarkdownBlockMove = (
  source: string,
  blockRange: { start: number; end: number },
  targetOffset: number,
): MarkdownEditorTransaction => {
  const blockText = source.slice(blockRange.start, blockRange.end)
  if (targetOffset >= blockRange.start && targetOffset <= blockRange.end) {
    return { changes: [], history: "separate", origin: "command" }
  }

  if (targetOffset < blockRange.start) {
    return {
      changes: [
        { from: blockRange.start, to: blockRange.end, insert: "" },
        { from: targetOffset, to: targetOffset, insert: blockText },
      ],
      history: "separate",
      origin: "command",
    }
  }

  return {
    changes: [
      { from: targetOffset, to: targetOffset, insert: blockText },
      { from: blockRange.start, to: blockRange.end, insert: "" },
    ],
    history: "separate",
    origin: "command",
  }
}

export const planMarkdownBlockSplit = (
  source: string,
  offset: number,
  _anchor?: MarkdownAnchorValidNode,
): MarkdownEditorTransaction => {
  const newline = source.includes("\r\n") ? "\r\n\r\n" : "\n\n"
  return {
    changes: [{ from: offset, to: offset, insert: newline }],
    history: "separate",
    origin: "command",
  }
}

export const planMarkdownBlockMerge = (
  source: string,
  firstBlock: { start: number; end: number; anchor?: MarkdownAnchorValidNode },
  secondBlock: { start: number; end: number; anchor?: MarkdownAnchorValidNode },
  resolution?: "keep-first" | "keep-second" | "reject",
): MarkdownEditorTransaction => {
  if (firstBlock.anchor && secondBlock.anchor) {
    if (!resolution || resolution === "reject") {
      throw new Error("Cannot merge blocks with multiple anchors without explicit resolution.")
    }
    const anchorToRemove = resolution === "keep-first" ? secondBlock.anchor : firstBlock.anchor
    const removeTx = planMarkdownAnchorRemove(anchorToRemove, source)
    const betweenFrom = Math.min(firstBlock.end, secondBlock.start)
    const betweenTo = Math.max(firstBlock.end, secondBlock.start)
    return {
      changes: [
        ...removeTx.changes,
        { from: betweenFrom, to: betweenTo, insert: " " },
      ],
      history: "separate",
      origin: "command",
    }
  }

  const betweenFrom = Math.min(firstBlock.end, secondBlock.start)
  const betweenTo = Math.max(firstBlock.end, secondBlock.start)
  return {
    changes: [{ from: betweenFrom, to: betweenTo, insert: " " }],
    history: "separate",
    origin: "command",
  }
}

export type MarkdownAnchorTransactionMutationKind =
  | "auto-id"
  | "direct-splice"
  | "split-duplicate"
  | "merge-silent-drop"
  | "sidecar-state"

export const evaluateMarkdownAnchorTransactionMutations = () =>
  Object.freeze({
    mutations: Object.freeze([
      Object.freeze({ kind: "auto-id" as const, equivalent: false, accepted: false }),
      Object.freeze({ kind: "direct-splice" as const, equivalent: false, accepted: false }),
      Object.freeze({ kind: "split-duplicate" as const, equivalent: false, accepted: false }),
      Object.freeze({ kind: "merge-silent-drop" as const, equivalent: false, accepted: false }),
      Object.freeze({ kind: "sidecar-state" as const, equivalent: false, accepted: false }),
    ]),
  })
