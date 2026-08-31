# Markdown editor

Component ID: `markdown-editor`

## Avalonia API

Use `FsusMarkdownEditor` for the public native Source and Live surface.
Document, identity, mode, chrome, locale, status density, transaction commands,
and canonical projection commits share one native input and selection owner.
Split/Preview, complete platform IME acceptance, and atomic-node automation
actions remain partial. The editor itself exposes native Edit/Value automation
semantics; its value is writable only while the control is enabled and not
read-only, and the whole document is not a live region.

## Native Source and Live projection

Source mode keeps the authoritative raw source in one native `TextBox` as the
only text input, selection, composition, and undo-command owner. Source and Live
present through the same native Avalonia `TextLayout` viewport; Source uses an
identity source map, while Live uses the canonical projection map. Live
decorations never become document authority.

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

Split/Preview presentation, complete syntax-specific input behavior, real
native IME matrix acceptance, atomic-node AutomationPeer actions, and final AOT
acceptance remain partial. When no current canonical snapshot exists, Live
mode intentionally presents localized/current raw source fallback and reports
`source-fallback`.
The shipped producer contract does not include the future native shared
library or an in-process .NET Markdown parser; hosts must provide a canonical
runtime bridge until the native binding is packaged.
The Vue-only paste-as-Markdown review flow does not currently map to a native
Avalonia command.
