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

| Tracking parent | Shipped function                                                                                                                | Reads                                                                |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| #273 outline    | `createMarkdownOutlineEntries`                                                                                                  | heading `syn:` nodes                                                 |
| #274 table      | `createMarkdownTableEntries`                                                                                                    | table `syn:` nodes                                                   |
| #277 search     | `searchMarkdownRawSource` / `searchMarkdownStableProjection` / `planMarkdownReplaceCurrent` / `planMarkdownReplaceAll`          | raw UTF-16 matches, `syn:` hits, and source replace transactions     |
| #278 technical  | `createMarkdownTechnicalEntries`                                                                                                | `code`, `latex`, `mermaid`                                           |
| #279 properties | `createMarkdownPropertyEntries`                                                                                                 | `link`, `image`                                                      |
| #290 embed      | `parseMarkdownEmbedLine` / `collectMarkdownEmbedNodes` / `resolveMarkdownEmbedPresentation` / `evaluateMarkdownEmbedAcceptance` | `embed` projection nodes and the controlled presentation contract    |
| #314 caption    | `parseMarkdownCaptionLine` / `collectMarkdownCaptionNodes` / `renderMarkdownCaptionFigure`                                      | `caption` projection nodes and safe `figure`/`figcaption`            |
| #289 anchor     | `parseMarkdownAnchorMarker` / `collectMarkdownAnchorNodes`                                                                      | `anchor` projection nodes                                            |
| #291 import     | `importMarkdownClipboardSnapshot` / `convertMarkdownHtmlImportSnapshot`                                                         | explicit clipboard snapshot → import tree → Markdown and loss report |

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
nested scroll. Verified content is controlled Markdown routed through the unique Markdown
runtime, never provider HTML (`html: null`), a second editor, or an iframe.
`renderVia: "markdown-runtime"` identifies the destination; it is not evidence
that a metadata-only result has been rendered. Provider
output never expands the host source: the source contract stays the exact
directive.

### Controlled projection transport

The public `/markdown-runtime` entry exports:

```text
createMarkdownEmbedProjectionRequest(input): Promise<MarkdownEmbedRequest>
prepareMarkdownEmbedResult(request, result, authority): Promise<MarkdownEmbedResult>
commitMarkdownEmbedResult(request, result): MarkdownEmbedResult
cancelMarkdownEmbedRequest(requestOrRequestId): void
resolveMarkdownEmbedPresentation(input, mode): MarkdownEmbedPresentation
```

`createMarkdownEmbedProjectionRequest` freezes the host document id/epoch,
source revision, node, target token, mode and provider version. It computes a
SHA-256 request digest using the platform Web Crypto implementation, or
preserves a caller-supplied digest from its already-verified request. This UI
digest is a correlation envelope; it does not verify Blog's actor, permission,
provider result digest, accepted receipt, or dependency receipt. The consumer
still owns those authorities. Legacy `createMarkdownEmbedRequest` and plain
`title`/`excerpt` metadata remain supported.

A projected result carries `requestDigest`, `targetVersion` and `projection`.
`MarkdownEmbedTargetVersion` contains opaque `targetIdentity`,
`resolvedRevision`, `targetVersionIdentity`, `projectionIdentity` and
`projectionDigest` strings. The target revision is independent of the host's
`revision`. Preserve a consumer's exact revision without numeric precision
loss; the library never infers a revision or decodes a target identity.

`MarkdownEmbedProjection` supports controlled Markdown bytes (`kind:
'markdown'`, `source`) or a local Markdown reference (`kind:
'markdown-reference'`). Both carry `projectionIdentity` and `contentDigest`.
A reference alone has no renderable content. `MarkdownEmbedProjectionAuthority`
requires `readTargetVersion(request)` from the consumer's current authorized
facts, and a reference also needs `resolveMarkdown(reference, request)` to
materialize already-authorized Markdown. No library network or product API
fetch occurs. Renderer-specific projection kinds that cannot materialize
Markdown remain explicitly unsupported.

Preparation verifies the request binding, exact current target coordinate,
projection identity, and SHA-256 of the actual UTF-8 bytes. It rechecks
currentness after asynchronous materialization and hashing. A supplied digest,
cloned result, arbitrary HTML/component/DOM field, unknown result status,
unavailable resolver, or mismatched bytes cannot authorize content. Successful
preparation freezes the payload and gives it a private, garbage-collectable
receipt; synchronous commit and presentation check that receipt and the current
authority again. Cancellation, document/epoch/revision/node/request/mode/provider
drift and target-coordinate changes prevent old content from being displayed.
The existing size, time, concurrency and node budgets bound work and retained
requests; a timed-out resolver cannot admit a late payload.

For projected presentation, pass the current host request as `input.request`.
`content.markdown` is non-null only for a verified current payload. Render that
string once through the existing `ElMarkdownRenderer`, with the host's normal
base URL, CSP and feature options. Preparation does not parse Markdown. The
renderer owns parsing, the URL/feature gateway and its existing safe output
sink. It is read-only derived presentation and never enters host source,
transactions or history. Source mode continues to show the exact directive.

`ElMarkdownEditor` generates projection request digests and presents prepared
Markdown through its existing renderer in Live, Split and Preview. It cancels
pending work on document, revision or provider replacement and disposal;
document identity is captured before asynchronous hashing. Metadata-only
providers retain the escaped title/excerpt path, including when Web Crypto is
unavailable; an undigested request cannot authorize projected content. Source
mode retains the exact directive. The editor does not supply a materializer or
target-version authority: the consumer must provide real authorized facts to
`prepareMarkdownEmbedResult`. The companion
[`markdown-embed-editor-projection-integration.test.ts`](../../vue/tests/consumer-install/markdown-embed-editor-projection-integration.test.ts)
mounts the real public editor without mocks. Product payload integration and
independent rendered UX acceptance remain separate requirements.

The portable public regression is
[`markdown-embed-projection-public.test.ts`](../../vue/tests/consumer-install/markdown-embed-projection-public.test.ts).
Run it through Blog's real local-alias Vitest configuration by copying it and
its adjacent JSON fixture to `tests/frontend/unit/authoring/`. Its coordinate
and reference fixture were serialized using the actual
`ArticleEmbedDependencyCoordinate`, `ArticleEmbedSafeProjectionReference` and
`ArticleEmbedContractDigest.ComputeDependency` at Blog commit
`1194ee45037862aa30803650ec2a622700631224`. The adjacent fixture generator
compiles those exact source files, not replacement DTOs. It does not produce an
accepted authoring/dependency receipt or demonstrate live Blog permissions.

```sh
dotnet run --project vue/tests/consumer-install/markdown-embed-projection-blog-fixture.csproj \
  -p:BlogEmbedContractRoot=<exact-Blog-checkout>/src/shared/Contracts/ArticleEmbeds
# In the exact Blog consumer checkout's src/frontend directory:
FSUSBLOG_USE_LOCAL_FSUSUI=1 FSUSBLOG_LOCAL_FSUSUI_ROOT=<UI-checkout> \
  pnpm exec vitest run --config vitest.config.ts \
  ../../tests/frontend/unit/authoring/articleEmbedProjectionPublicBoundary.test.ts
```

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
