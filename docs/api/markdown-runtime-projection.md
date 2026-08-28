# Markdown runtime projection consumers

`@ozwasyd/element-plus/markdown-runtime` is the only authority for editor
projection, coordinates, identity, invalidation, and anchors. Outline, table,
search, technical, and property surfaces consume these APIs. They must not
parse Markdown again, walk the DOM, search rendered HTML, or invent private
ids.

This document is the consumer-facing contract for tracking parents #273,
#274, #277, #278, and #279. It does not implement their UI children.

## Package export

| Import                                   | Stability               |
| ---------------------------------------- | ----------------------- |
| `@ozwasyd/element-plus/markdown-runtime` | Experimental public API |

WASM internals under `@ozwasyd/element-plus/es/wasm/*` stay unsupported.

## Consumer APIs

| Tracking parent | Shipped function                                                                                                       | Reads                                                                |
| --------------- | ---------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| #273 outline    | `createMarkdownOutlineEntries`                                                                                         | heading `syn:` nodes                                                 |
| #274 table      | `createMarkdownTableEntries`                                                                                           | table `syn:` nodes                                                   |
| #277 search     | `searchMarkdownRawSource` / `searchMarkdownStableProjection` / `planMarkdownReplaceCurrent` / `planMarkdownReplaceAll` | raw UTF-16 matches, `syn:` hits, and source replace transactions     |
| #278 technical  | `createMarkdownTechnicalEntries`                                                                                       | `code`, `latex`, `mermaid`                                           |
| #279 properties | `createMarkdownPropertyEntries`                                                                                        | `link`, `image`                                                      |
| #290 embed      | `parseMarkdownEmbedLine` / `collectMarkdownEmbedNodes`                                                                 | `embed` projection nodes                                             |
| #314 caption    | `parseMarkdownCaptionLine` / `collectMarkdownCaptionNodes` / `renderMarkdownCaptionFigure`                             | `caption` projection nodes and safe `figure`/`figcaption`            |
| #289 anchor     | `parseMarkdownAnchorMarker` / `collectMarkdownAnchorNodes`                                                             | `anchor` projection nodes                                            |
| #291 import     | `importMarkdownClipboardSnapshot` / `convertMarkdownHtmlImportSnapshot`                                                | explicit clipboard snapshot → import tree → Markdown and loss report |

All entries reuse `stabilizeMarkdownEditorProjection` identities.
`resolveMarkdownConsumerIdentity` reports `current`, `deleted`, or `invalid`.
A deleted heading, table, fence, link, or image must not be retargeted.

## Shared inputs

1. Build a projection with `createMarkdownEditorProjection(rawSource)`.
2. Stabilize it with
   `stabilizeMarkdownEditorProjection(projection, documentIdentity, previous, change)`.
3. Map carets with `createMarkdownSourceCoordinateMap(rawSource)`.
4. Map visual/pointer hits with `createMarkdownAnchorMap`.
5. Plan incremental work with `planMarkdownProjectionInvalidation`.

Raw JavaScript UTF-16 offsets are the only edit/selection coordinates.

## Projection node contract

`MarkdownEditorSyntaxNode` is a read-only projection of the unique Markdown
parser output. It does not expose the parser AST and is never a second content
model. Each node provides:

- `blockIdentity`, which is unique and deterministic inside one
  parser/source/version projection. Cross-revision identity is owned by
  `stabilizeMarkdownEditorProjection`.
- whole-node `rawRange` / `normalizedRange`;
- parser-owned `rawContentRanges` / `normalizedContentRanges`;
- parser-owned `rawMarkerRanges` / `normalizedMarkerRanges`;
- parent and child ranges;
- `status`, `diagnosticCode`, and a presentation classification.

Malformed and unclosed structures use `status: "malformed"`,
`presentation: "unsupported-error"`, and an exact diagnostic range. They are
not silently reclassified as a valid fence, math block, Mermaid block, or
explicit paragraph.

The syntax collector publishes its supported kinds. Projection creation fails
closed if that parser-owned set and the presentation registry drift in either
direction.

## Worker equivalence

The dedicated Worker returns the complete `MarkdownEditorProjectionResult`, not
only node ids or rendered output. Main-thread and Worker results are compared
on parser/source/version identity, block identity, source/content/marker
ranges, parent/child ranges, diagnostics, presentation, and syntax coverage.

## Stable identity lifecycle

Syntax ids are opaque and scoped to both the document id and document epoch. A
new document or epoch never reuses an earlier document's ids, even when the
source bytes match.

- Creation allocates a monotonically increasing ordinal for the syntax kind.
  Deleted ordinals remain consumed for the rest of the document epoch.
- An unchanged node before or after the supplied raw-source `change` keeps its
  id by exact remapped range. This disambiguates deleting one of two identical
  adjacent nodes.
- An exact syntax slice keeps its id when it moves. On split, the first matching
  slice keeps the original id and other slices receive new ids. On merge, the
  left node keeps its id and the other merged ids become deleted.
- Editing a node in place keeps its id when its syntax kind and raw range stay
  the same; this does not allocate or recycle an ordinal.
- Wrap and unwrap keep the enclosed node id when the supported wrapper changes
  its syntax kind without changing its payload.
- A deleted id resolves as `deleted` and is never assigned to a later node in
  the same epoch. An id from another document resolves as `invalid`.

Callers must pass the previous stable projection on every revision. They must
also pass the source transaction as `change` when repeated equal syntax makes
position alone ambiguous. Identity state contains allocator metadata only; it
does not persist source or parser nodes as a second content model.

## Acceptance gate

`evaluateMarkdownProjectionAcceptance` composes those APIs and rejects stale
commits, document switches, deleted anchors, and HTML/identity/bidi mutations.

`recordMarkdownProjectionAcceptanceScale` measures a fixture with at least
100000 characters, 3000 blocks, and 10000 headings. The record is versioned by
`MARKDOWN_PROJECTION_ACCEPTANCE_VERSION` and includes parser/projector
duration, task id, invalidated ranges, retained identities, and heap deltas.

## Forbidden consumer strategies

- regex or second Markdown parser
- DOM query, `innerHTML`, or rendered-text `indexOf`
- title hashes, `match:N`, or `kind:offset` ids
- replacing every id after an ordinary edit or reusing ids across documents
- using a normalized LF offset on a CRLF raw string
- committing a stale Worker result or a deleted anchor
