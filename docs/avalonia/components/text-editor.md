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

IME, clipboard, text selection, and scroll sync follow
`docs/avalonia/platform-differences.md`.

## Theme Tokens

Text editor uses text, muted text, surface, border, focus, danger, density, and
motion resources.

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
