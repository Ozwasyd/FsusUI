# Markdown editor

Component ID: `markdown-editor`

## Avalonia API

Use `FsusMarkdownEditor` for the public native Source and Live surface.
Document, identity, mode, chrome, locale, status density, transaction commands,
and canonical projection commits share one native input and selection owner.
Split/Preview, off-host platform IME coverage, and atomic-node automation
actions remain partial. The editor itself exposes native Edit/Value automation
semantics; its value is writable only while the control is enabled and not
read-only, and the whole document is not a live region.

## Editor page scrolling

`ScrollContentFloor` adds a bottom content floor (in DIPs) so a short document
still scrolls like an editor page; zero keeps the plain content extent.
`ScrollPosition` reads and writes the editor page scroll offset, and
`ScrollToSourceLine` scrolls the first visual line containing a source offset
to the viewport top. Setting the position cancels the pending viewport-anchor
restore so host-driven scrolling and the internal anchor restore cooperate.
`ScrollViewportHeight` and `ScrollExtentHeight` expose the underlying metrics
for hosts that persist per-document scroll state.

## Editor-adjacent contracts

The native editor exposes the four editor-adjacent capability families without
introducing a second Markdown parser or a second input/scroll owner.

### Search and projection highlight

Call `RequestSearch` with a versioned `FsusMarkdownSearchQuery`. The
`SearchRequested` event binds the query to the current document identity,
revision, and raw UTF-16 source. A host bridges that request to the canonical
Markdown search runtime and returns `FsusMarkdownSearchSnapshot` through
`CommitSearch`; the control rejects a mismatched identity, revision, query, or
range. `NavigateSearch` wraps next/previous, selects and reveals the current
match, and paints current/non-current ranges through the existing projection
map without changing source, line wrapping, reading order, or scroll-container
identity. `ClearSearch` removes the query and presentation.

FsusUI deliberately does not add an Avalonia search bar. Product command and
toolbar composition stays with the host, while the editor owns the public
query/result/reveal semantics and projection highlight.

### Outline and reveal

`FsusMarkdownOutlineSnapshot` carries canonical-runtime heading items: stable
node identity, depth, text, source/content ranges, parent identity, and
diagnostics. `CommitOutline` validates the snapshot against the current
document and revision without reparsing Markdown. `RevealHeading` and
`RevealSourceRange` preserve the one native selection/focus owner and scroll
the mapped source line. They return `Success`, `Stale`, `NotFound`, or
`Unsupported` instead of guessing from heading text or raw offsets. Source and
Live are supported; the currently partial Split/Preview surfaces fail closed.

### Canonical HTML export and printing

Set `OutputHost` to an `IFsusMarkdownEditorOutputHost`. `ExportHtmlAsync`
supplies the current identity, revision, source, and optional committed
projection to the host's canonical renderer bridge. `PrintAsync` first consumes
that renderer-owned HTML, then gives it to the host print backend. Capability
discovery, cancellation, and post-await document/revision checks are explicit;
unsupported or stale work never reports success. FsusUI does not ship a second
HTML renderer, WebView, PDF engine, or operating-system print dialog through
this contract. Tagged PDF and browser-backed outline options remain available
through the separate [WebView adapter](webview-adapter.md).

### Focus and Typewriter hooks

`FocusWritingAidEnabled` and `TypewriterWritingAidEnabled` are opt-in and
default to false. `TypewriterAnchor` defaults to `UpperThird`; `Center` requires
an explicit host choice. `WritingAidsRequested` provides the current canonical
projection and selection so the host can commit revision-bound active and
exempt ranges through `CommitWritingAids`. In the `prose` profile, the control
reduces only non-active text emphasis; committed exempt ranges remain readable
and the presentation does not change source, selection, history, line wrap, or
the input owner.

`NotifyWritingAidsInteraction` exposes the native state hooks for input,
explicit search/outline navigation, user scroll, selection drag, composition,
and asynchronous layout changes. Manual scroll, drag, and composition suspend
automatic correction. A later input or explicit navigation restores it;
selection change/end alone does not steal the viewport. Reduced-motion policy
is inherited from the native theme, and this contract performs positional
correction without adding smooth or decorative motion.

## Per-document undo history

The transaction store archives the undo/redo chain per document identity (up to
`MaxRetainedDocumentHistories`, LRU evicted). Switching identities preserves
each document's history; re-selecting a document whose content is unchanged
restores its archived chain immediately, and re-presenting the archived content
through an external reset goes live on the reset. Any other external reset
value clears both the live chain and the archived chain for that identity,
matching the Web hard-reset contract. `CaptureHistory` and `TryRestoreHistory`
serialize per-document history entries (forward and inverse changes, merged
steps included) so hosts can persist and restore undo state; a snapshot is only
restorable onto a store holding the same identity and value.

## Prose projection typography

Live-mode projection spans are presented with fsus-prose-equivalent
typography resolved from committed `SemanticKind` values: heading levels use
the `prose.scss` size ladder (base+16/+8/+4/inherit) at weight 700, `strong`
is bold, `code` uses the monospace face on the raised surface,
`link` uses Scholarly Blue (`color.action.primary`), `quote` renders in muted
text with a left border, and `list`/`task` items get the round bullet marker.
Presentation is theme-driven; hosts do not reimplement text layout.

## Native Source and Live projection

Source mode keeps the authoritative raw source in one native `TextBox` as the
only text input, selection, composition, and undo-command owner. Source and Live
present through the same native Avalonia `TextLayout` viewport; Source uses an
identity source map, while Live uses the canonical projection map. Live
decorations never become document authority.

That same owner is the only Avalonia IME, key, and clipboard path. The native
client decorator forwards Avalonia's preedit rendering and candidate-caret
geometry while the shared event machine freezes smart pairs, block transforms,
and unsafe selection restoration until composition commits or cancels. A
commit is one separate-history source transaction; a late commit after an
identity, epoch, revision, or selection change is rejected. Normal paste
priority is file attachment intent, Markdown source, plain text, then safe
HTML-to-text fallback; active HTML and data URLs never become editor source.

The Linux `--ime-harness` route is headful and requires a live X display with
ibus/libpinyin and libXtst. It rejects synthetic-only qualification by first
composing through a stock Avalonia `TextBox`, then drives the production editor
through OS key events and records structured commit, cancel, undo, stale,
clipboard, Unicode, high-DPI, and scrolled candidate-caret evidence.

The canonical Markdown runtime supplies a parser-neutral
`FsusMarkdownProjectionSnapshot` through `CommitProjection`. Each snapshot is
bound to the document identity, transaction revision, raw source, and feature
revision. A stale document, revision, source, or feature snapshot is rejected
without replacing the current source. `ProjectionRequested` identifies the
exact state for which a new projection is needed.

Native hosts consume that runtime through the versioned
`IFsusMarkdownProjectionProducer` boundary. The current sanctioned
`InterimHostBridge` adapts output produced outside .NET by
`@ozwasyd/element-plus/markdown-runtime`; it must not parse Markdown. The future
`CanonicalNativeBinding` will bind the same C++ runtime and keep the production
envelope unchanged. `FsusMarkdownProjectionProducerContract.Validate` rejects
an unknown contract version, noncanonical source-runtime identity, stale
request binding, malformed tiling, vocabulary drift, retired identity reuse,
or cross-document identity reuse before `CommitProjection` runs.

Explicit spans are positive-length, ascending, non-overlapping raw UTF-16
ranges. Uncovered gaps are exact current-source fallback tiles; an explicit
`SourceFallback` also reproduces its source slice and names a reason. The
machine vocabulary and identity/invalidation/upgrade rules are owned by
[`spec/avalonia/markdown-projection-producer-contract.json`](../../../spec/avalonia/markdown-projection-producer-contract.json),
with executable vectors beside it. Removed node ids remain retired for the
document epoch. A producer swap occurs at a new epoch unless it imports the
canonical identity allocator and tombstones.

Projection spans use raw UTF-16 source ranges and stable node identities.
`Text`, `HiddenMarker`, `Atomic`, and `SourceFallback` presentations support
ordinary text, hidden Markdown syntax, atomic before/after caret placement, and
localized source fallback without introducing a second Markdown parser.
`FsusMarkdownProjectionMap` maps caret/pointer positions bidirectionally, and
`FsusMarkdownSourceCoordinateMap` preserves the raw/normalized relationship for
BOM, CRLF/CR, CJK, emoji, and RTL text.

After an ordinary transaction, unaffected spans are remapped through the
transaction position map and retain their identities. Invalidated gaps render
the current raw source until the canonical owner commits the next snapshot; the
control does not rebuild a parallel parse tree.

Source/Live mode changes preserve the source line at the top of the viewport,
then resolve its new pixel position through the active source/presentation map.
The viewport snaps to the mapped line boundary so hidden markers and atomic
presentations cannot introduce clipped leading glyphs or a different logical
scroll context.

## Transaction contract

`DispatchTransaction`, `Undo`, and `Redo` use the same FsusUI-owned transaction
store. Successful results carry the document identity, before/new revision,
selection, history state, and a position map. `Transaction`,
`SelectionChange`, and `HistoryChange` expose those changes without leaking an
Avalonia text-control implementation.

Every expected-revision operation should also carry the corresponding
`FsusMarkdownDocumentIdentity`. A document identity or epoch change isolates
selection, undo/redo, merge state, and stale work even when the Markdown source
is byte-for-byte identical.

External updates use an explicit policy:

- `reset` replaces the source, moves selection to the end unless an explicit
  selection is supplied, and clears history.
- `rebase` applies the supplied changes, maps the current selection, and clears
  history so old undo entries cannot mutate externally updated content.

The Web and Avalonia implementations consume the same scenarios from
`spec/avalonia/markdown-editor-transaction-vectors.json`. Those vectors cover
multiple changes, selection direction, merge groups, undo/redo, external
reset/rebase, stale revisions, document switching, affinity, and partial/full
deletion.

## Vue Contract Mapping

Maps the Vue markdown editor chrome/document/mode contract onto
`FsusMarkdownEditor`. The projection snapshot is a native transport for the
same parser-owned source ranges and stable identities; it is not an Avalonia
Markdown parser.

## Supported Platform Differences

Native host, scroll, and content regions follow
`docs/avalonia/platform-differences.md`. This control is not a WebView wrapper
and is not an alias of `FsusTextEditor`.

## Theme Tokens

The native shell consumes the shared text-editor surface, text, border, spacing,
control-border, and surface-radius resources from the generated Avalonia theme.

## Minimal Avalonia Example

```csharp
using FsusUI.Avalonia.Controls;

var editor = new FsusMarkdownEditor
{
  Document = "**Draft**",
  DocumentIdentity = new FsusMarkdownDocumentIdentity("draft", 1),
  Chrome = FsusMarkdownEditorChrome.Framed,
  StatusDensity = FsusMarkdownEditorStatusDensity.Minimal,
};

editor.ProjectionRequested += async (_, request) =>
{
  var result = await FsusMarkdownProjectionProducerContract.ProduceAndCommitAsync(
    editor,
    canonicalProjectionProducer,
    request);
  if (!result.Accepted)
  {
    // Live remains in its current-source fallback state.
    return;
  }
};

editor.Mode = FsusMarkdownEditorMode.Live;
```

## Known Limitations

Split/Preview presentation, off-host native IME matrix coverage, atomic-node
AutomationPeer actions, and final AOT
acceptance remain partial. When no current canonical snapshot exists, Live
mode intentionally presents localized/current raw source fallback and reports
`source-fallback`.
The shipped producer contract does not include the future native shared
library or an in-process .NET Markdown parser; hosts must provide a canonical
runtime bridge until the native binding is packaged.
The Vue-only paste-as-Markdown review flow does not currently map to a native
Avalonia command.
FsusUI does not provide search, outline, export, or print chrome on Avalonia;
hosts compose those commands around the typed control/host contracts. Search,
outline, and Focus facts must come from the same canonical runtime projection;
raw-text scanning or a second C# Markdown parser is not a supported producer.
Split/Preview reveal remains unsupported while those native surfaces are
partial.
