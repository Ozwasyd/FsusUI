# Markdown runtime projection consumers

`@ozwasyd/element-plus/markdown-runtime` is the only authority for editor
projection, coordinates, identity, invalidation, and anchors. Outline, table,
search, technical, and property surfaces consume these APIs. They must not
parse Markdown again, walk the DOM, search rendered HTML, or invent private
ids.

This document is the consumer-facing contract for tracking parents #273,
#274, #277, #278, and #279. It does not implement their UI children.

## Package export

| Import | Stability |
| --- | --- |
| `@ozwasyd/element-plus/markdown-runtime` | Experimental public API |

WASM internals under `@ozwasyd/element-plus/es/wasm/*` stay unsupported.

## Consumer APIs

| Tracking parent | Shipped function | Reads |
| --- | --- | --- |
| #273 outline | `createMarkdownOutlineEntries` | heading `syn:` nodes |
| #274 table | `createMarkdownTableEntries` | table `syn:` nodes |
| #277 search | `searchMarkdownRawSource` / `searchMarkdownStableProjection` | raw UTF-16 matches and `syn:` hits |
| #278 technical | `createMarkdownTechnicalEntries` | `code`, `latex`, `mermaid` |
| #279 properties | `createMarkdownPropertyEntries` | `link`, `image` |
| #290 embed | `parseMarkdownEmbedLine` / `collectMarkdownEmbedNodes` | `embed` projection nodes |
| #314 caption | `parseMarkdownCaptionLine` / `collectMarkdownCaptionNodes` | `caption` projection nodes |
| #289 anchor | `parseMarkdownAnchorMarker` / `collectMarkdownAnchorNodes` | `anchor` projection nodes |

All entries reuse `stabilizeMarkdownEditorProjection` identities.
`resolveMarkdownConsumerIdentity` reports `current`, `deleted`, or `invalid`.
A deleted heading, table, fence, link, or image must not be retargeted.

## Shared inputs

1. Build a projection with `createMarkdownEditorProjection(rawSource)`.
2. Stabilize it with `stabilizeMarkdownEditorProjection(projection, documentIdentity)`.
3. Map carets with `createMarkdownSourceCoordinateMap(rawSource)`.
4. Map visual/pointer hits with `createMarkdownAnchorMap`.
5. Plan incremental work with `planMarkdownProjectionInvalidation`.

Raw JavaScript UTF-16 offsets are the only edit/selection coordinates.

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
- using a normalized LF offset on a CRLF raw string
- committing a stale Worker result or a deleted anchor
