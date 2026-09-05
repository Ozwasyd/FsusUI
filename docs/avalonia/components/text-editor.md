# Text editor

Component ID: `text-editor`

## Avalonia API

Use `FsusTextEditor`, `FsusTextSelection`, `FsusTextEditorBudget`, and
`FsusTextEditorBudgetResult` for multiline editing, undo/redo, selection,
preview sync, and budget checks.

## Vue Contract Mapping

Vue editor model value, composition, selection, paste, undo, redo, preview,
and debounce contracts map to explicit editor state and methods.

## Supported Platform Differences

See [`docs/avalonia/platform-differences.md`](../platform-differences.md) for IME, clipboard, text selection, and scroll-sync boundaries.

## Theme Tokens

Use text, muted-text, surface, border, focus, danger, and density resources from [Application Setup](../installation.md#application-setup); motion behavior is defined in [Avalonia Motion Runtime](../motion-runtime.md).

## Accessibility

The production automation peer exposes the current raw document through its
editable value pattern. Reads and writes therefore round-trip through the same
text contract, while item status reports document length, selection, preview
synchronization, and undo/redo availability. Its read-only state mirrors
`IsReadOnly`.

## Minimal Avalonia Example

```csharp
using FsusUI.Avalonia.Controls;

var editor = new FsusTextEditor
{
  AccessibleName = "Markdown body",
  Text = "# Draft",
};
```

## Known Limitations

Syntax highlighting adapters remain product-specific.
