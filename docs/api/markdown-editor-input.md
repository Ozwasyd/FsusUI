# Markdown editor input contract

Block intents, smart pairing, clipboard MIME priority, and the native
beforeinput/composition machine share one `#268` transaction store. Source,
live, and split must emit the same raw source transaction for the same input.
They must not register a second keydown, DOM, or consumer pipeline.

This document is the consumer-facing contract for tracking parent #287 and
children #327–#331. It does not implement Live visual projection, table UX,
or attachment IO.

## Package export

| Import | Stability |
| --- | --- |
| `@ozwasyd/element-plus/components/markdown-editor` | Experimental public API |

## Surfaces

| Child | Shipped function | Owns |
| --- | --- | --- |
| #327 block | `resolveMarkdownBlockInputIntent` | Enter, Delete, Tab by projection context |
| #328 pair | `resolveMarkdownPairInput` | Frozen pair set and fence |
| #329 clipboard | `resolveMarkdownClipboardPaste` / `Copy` / `Cut` | MIME order and attachment intent |
| #330 native | `createMarkdownEditorNativeEventMachine` / `driveMarkdownNativeHarnessTrace` | beforeinput, composition, undo ownership |
| #331 acceptance | `evaluateMarkdownInputAcceptance` | Same-candidate gate |

`driveMarkdownNativeHarnessTrace` is the #319 read/drive surface. Synthetic
Chromium/Firefox/WebKit scripts are not native OS IME evidence.

Public editor mode is exactly `source` / `live` / `split` / `preview`. Live
capability tokens are exactly the six frozen values from
`markdownLiveCapabilities`. There is no `write` mode alias.

`createMarkdownLiveSurface` is the #333 owner plan: one `source-textarea`
selection/focus/IME host. Split and preview may show the safe renderer pane;
live does not. Projection failure keeps the source bytes and falls back to a
source-only surface.

`resolveMarkdownLiveSyntaxReveal` is the #334 marker state machine. Reveal and
hide do not write source, history, or selection. Nested emphasis/link/code
prefer the innermost marker range. Composition freezes structural reveal
changes. Esc returns focus without editing.

`roundTripMarkdownLiveSelection` and `resolveMarkdownAtomicNodeIntent` are the
#335 source↔visual selection and generic atomic primitive. All mapping goes
through `createMarkdownAnchorMap`. Image, table, code, Mermaid, LaTeX,
footnote, and attachment share one before/after/source/copy/delete/focus path.
Atomic visuals are not Tab traps and are not source/history authority.

`resolveMarkdownLiveLayoutStability` and `resolveMarkdownLiveVirtualWindow`
are the #336 source-anchored caret/viewport plan. Height changes restore from
`#325` node/range/affinity. User wheel/touch/scrollbar/selection-drag yields.
Stale feature results do not commit. Ordinary input stays inside a numeric
mounted-node budget and does not remount the full visual tree.

`resolveMarkdownTechnicalNode` and `createMarkdownTechnicalFeatureRequest`
are the #382 shared contract for fenced code, Mermaid, and LaTeX. Ranges
come from the projection node, not a second fence regex. Feature output
must use the unique gateway. Local errors keep source and reveal an exact
range. Height and atomic actions reuse #335/#336.

`resolveMarkdownCodeLanguage` and `applyMarkdownCodeLanguageChange` are the
#383 fenced-code contract. Language aliases come from the Shiki grammar
authority. Unknown info strings stay put and fall back to plain code.
Language edits touch only the info range. Keyboard and clipboard stay on
the #287 pipeline. Fences are not identified by regex and bodies are not
executed.

`Paste as Markdown` is the explicit-only #394 command boundary. It freezes one
clipboard snapshot and one document/revision/selection anchor before showing
Markdown, source-diff, and typed conversion-warning evidence. Plain-text import,
Markdown import, and cancel are explicit choices; there is no source mutation
before confirmation. A confirmed choice uses one separate-history transaction,
while a stale anchor, composition, `readonly`, `disabled`, `loading`, or
preview-only state fails closed and restores editor focus. Attachment
descriptors leave the editor only as provider intent and never as data URLs.
This command does not change normal paste MIME priority and does not redefine
the existing sanitizer, converter, attachment provider, or upload-I/O
boundaries.

The isolated importer measures clipboard size as UTF-8 bytes and fails closed
against its node, depth, table-cell, image, and elapsed-time budgets. URL
attributes are decoded before scheme classification, so encoded active schemes
cannot cross the sanitizer boundary. Budget rejection, cancellation, and active
content removal remain typed conversion losses; they never trigger a browser
rich-paste fallback, remote conversion, or consumer-local importer.

`planMarkdownMermaidPreview` is the #384 Mermaid preview contract. Requests
reuse the #382 identity. Valid diagrams preview through the unique feature
gateway. Invalid, large, abort, and stale results stay local and source-only.
Height restore uses #336. Consumer SVG/innerHTML and auto-rewrites are
rejected.

`planMarkdownLatexPreview` is the #385 inline/block math contract. Nodes and
marker/body ranges come from the projection. Valid math commits only through
the feature gateway. Invalid, large, abort, and stale results stay local.
Inline math keeps wrapping; block math restores height from #336. Consumer
DOM and auto-rewrites are rejected.

`evaluateMarkdownTechnicalAcceptance` is the #386 local gate for #382–#385.
It checks 0/1/100 nodes, language/fence, invalid/large Mermaid/LaTeX, stale
results, atomic undo, XSS payload reject, and the shared mutation fixtures.
Native IME, screen-reader hardware, and the 375/1440 zoom matrix stay leftover.

## Acceptance gate

`evaluateMarkdownInputAcceptance` composes the four planners and rejects
consumer keydown, DOM mutation, HTML-first paste, pair drift, double insert,
and full-document normalize. Source/live/split fingerprints must match.
Unedited BOM, CRLF, Tab, trailing spaces, hard breaks, CJK, ZWJ emoji,
combining marks, and RTL bytes must stay put.

## Forbidden consumer strategies

- consumer `keydown` that writes source outside a transaction
- DOM / `innerHTML` / rendered-text context
- HTML-first clipboard or data URL insert
- pair-set drift (`«»`, auto-strong, extra fences)
- timeout or second paste/input path that double-inserts
- normalizing the whole document on ordinary input
