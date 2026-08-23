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
