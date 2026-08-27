# Markdown editor

Component ID: `markdown-editor`

## Avalonia API

Use `FsusMarkdownEditor` for the public native shell. Document, identity, mode,
chrome, locale, status density, and a command entry exist; live projection,
IME, and AutomationPeer remain partial.

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
`FsusMarkdownEditor`. Unimplemented live/IME semantics stay `partial`.

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
  Document = "# Draft",
  DocumentIdentity = new FsusMarkdownDocumentIdentity("draft", 1),
  Mode = FsusMarkdownEditorMode.Source,
  Chrome = FsusMarkdownEditorChrome.Framed,
  StatusDensity = FsusMarkdownEditorStatusDensity.Minimal,
};
```

## Known Limitations

Live projection, syntax-aware input, IME integration, AutomationPeer
semantics, and visual decoration remain partial.
The Vue-only paste-as-Markdown review flow does not currently map to a native
Avalonia command.
