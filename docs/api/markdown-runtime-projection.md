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

## Native host consumption

The canonical native target is a .NET binding over the same C++ Markdown
runtime that produces the Web WASM module. Its native packaging is not part of
the current release, and the C++ ABI, generated WASM, and Emscripten glue remain
internal implementation details.

Until that binding ships, an Avalonia host uses the sanctioned
`IFsusMarkdownProjectionProducer` bridge. The bridge adapts output already
produced by this canonical runtime; it is not permission to add a C# parser,
regex range reconstruction, WebView, or HTML round trip. Both the interim
bridge and future native binding use the same versioned
`FsusMarkdownProjectionProduction` envelope, so the editor-side consumption
path does not change on upgrade.

The machine authority for contract version, span tiling, semantic vocabulary,
identity tombstones, invalidation, and upgrade behavior is
[`spec/avalonia/markdown-projection-producer-contract.json`](../../spec/avalonia/markdown-projection-producer-contract.json).
Frozen positive and negative cases live in
[`spec/avalonia/markdown-projection-producer-vectors.json`](../../spec/avalonia/markdown-projection-producer-vectors.json).

## Consumer APIs

| Tracking parent | Shipped function                                                                                                       | Reads                                                                |
| --------------- | ---------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| #273 outline    | `createMarkdownOutlineEntries`                                                                                         | heading `syn:` nodes                                                 |
| #274 table      | `createMarkdownTableEntries`                                                                                           | table `syn:` nodes                                                   |
| #277 search     | `searchMarkdownRawSource` / `searchMarkdownStableProjection` / `planMarkdownReplaceCurrent` / `planMarkdownReplaceAll` | raw UTF-16 matches, `syn:` hits, and source replace transactions     |
| #278 technical  | `createMarkdownTechnicalEntries`                                                                                       | `code`, `latex`, `mermaid`                                           |
| #279 properties | `createMarkdownPropertyEntries`                                                                                        | `link`, `image`                                                      |
| #290 embed      | `parseMarkdownEmbedLine` / `collectMarkdownEmbedNodes` / `resolveMarkdownEmbedPresentation` / `evaluateMarkdownEmbedAcceptance` | `embed` projection nodes and the controlled presentation contract |
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
Supplemental hidden, nested, atomic, or virtual anchors bind to a stable
projection node through `projectionId`; an anchor range outside that projection
fails closed. Visual selections round-trip only when the document id and epoch,
current anchor id, anchor-local offset, raw source offset, and direction agree.
An old epoch, deleted anchor, DOM path, or naked offset is not accepted as a
visual anchor.

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
source bytes match. Document ids may contain separators, including
`document:N` or multiple colons. Direct and revived Worker projections use the
same canonical resolver without changing the `syn:<document>:<epoch>:<kind>:<ordinal>`
encoding; consumers must not split or rewrite these opaque ids.

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

## Embed presentation contract

`resolveMarkdownEmbedPresentation` maps a provider or budget outcome to a
frozen presentation. `mode` (`article` | `heading` | `block`) is a semantic
label only and never a visual variant; the layout stays single-column with no
nested scroll. Resolved content is inert text routed through the unique
Markdown runtime (`renderVia: "markdown-runtime"`), never HTML
(`html: null`), never a second editor, and never an iframe surface. Provider
output never expands the host source: the source contract stays the exact
directive.

The accessibility contract exposes target mode, status, and the
`enter-source` open-source operation with `tabStop: false`. Stale, forbidden,
missing, and cycle/depth/size/time failures map to actionable states with
retry; `unsupported` states keep only open-source.

`evaluateMarkdownEmbedEditorAcceptance` composes the editor surface, the
shared #335 atomic primitive (caret, copy, delete, undo, focus return), and
the shared #336 `embed-result` height trigger into one versioned report.
`evaluateMarkdownEmbedAcceptance` is the #391 aggregate: grammar, budgets
(direct/indirect cycle, depth, size, time), the security corpus, provider
cache/identity lifecycle, 1000-node scale, and the mutation fixture set.

## Acceptance gate

`evaluateMarkdownProjectionAcceptance` composes those APIs and rejects stale
commits, document switches, deleted anchors, and DOM-path, HTML-offset,
naked-offset, nearby-reveal, identity, and bidi mutations.

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
- claiming a consumer parser as the canonical native projection runtime
