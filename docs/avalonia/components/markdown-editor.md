# Markdown editor

Component ID: `markdown-editor`

## Avalonia API

Use `FsusMarkdownEditor` for the public native shell. Document, identity, mode,
chrome, locale, status density, and a command entry exist; live projection,
IME, and AutomationPeer remain partial.

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

Live projection, IME integration, and AutomationPeer semantics remain partial.
The Vue-only paste-as-Markdown review flow does not currently map to a native
Avalonia command.
