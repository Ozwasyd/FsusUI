# Code editor

Component ID: `code-editor`

## Avalonia API

`FsusCodeEditor` is the preview public Markdown source editor for multiline
desktop editing. It owns one native Avalonia `TextBox` for keyboard input, IME,
selection, and clipboard integration while a bounded presentation layer draws
line numbers, selection, caret, and Markdown source highlighting. Consumers do
not query or replace template children.

Set `DocumentIdentity` and `Text` together with `LoadDocument(identity, text)`
when opening or switching documents. A document switch is atomic: it clears
undo/redo, merge, selection, search-current, and composition state before the
new document can accept user edits. Direct `Text` updates are external resets
and also clear history.

`DocumentChanged` reports the current identity, text, revision, and
`FsusCodeEditorChangeOrigin`. Typing, composition commits, paste, replace,
undo, redo, and Automation Value changes report `User`; `LoadDocument` and
direct `Text` updates report `External`. `SelectionChanged` reports both UTF-16
selection offsets and the caret position.

## Coordinates and navigation

Offsets are zero-based UTF-16 code-unit offsets. Lines and columns are
one-based; CRLF is treated as one line break. `GetPosition` and `GetOffset`
convert between forms. `RevealOffset`, `RevealLineColumn`, `SelectOffsets`, and
`SelectLineColumn` validate the requested coordinates and update the native
caret/selection without template access. `LastRevealedPosition` records the
exact resolved position.

`Find`, `FindNext`, and `FindPrevious` expose non-overlapping matches and wrap
navigation. Search is ordinal case-insensitive by default and can be made
case-sensitive. `ReplaceCurrent` replaces only the active selected match;
`ReplaceAll` is one undo unit. `Matches` and `CurrentMatchIndex` expose the
current search state.

## Editing, composition, and history

The editor accepts returns and tabs and exposes `TabWidth` from 1 through 16.
`WordWrap` and `ShowLineNumbers` are runtime properties. `Undo`, `Redo`,
`CopyAsync`, `CutAsync`, `PasteAsync`, and `PasteText` have matching typed
commands and do not delegate history to a private template editor.

`BeginComposition`, `UpdateComposition`, `CommitComposition`, and
`CancelComposition` provide a testable composition lifecycle. Preview text is
not added to history; a commit is one user edit and one undo unit. External
loads, read-only state, and disabled state cancel an active preview. The native
`TextBox` remains the operating-system input-method owner in a mounted control.

## Markdown highlighting and large documents

The presentation recognizes Markdown heading/list/quote markers, emphasis,
inline code, and links. It does not parse or preview Markdown and does not add a
second document authority. `HighlightSpans` describes the currently realized
source range.

For documents above 200 logical lines, `IsVirtualized` is true. The custom
presentation realizes at most 200 logical lines, including overscan, and
exposes `FirstRealizedLine`, `LastRealizedLine`, and `RealizedLineCount` for
budget verification. The native `TextBox` still owns the complete editable
buffer; FsusUI does not allocate one control or one `TextLayout` per document
line. `CaptureScrollPosition` and `RestoreScrollPosition` preserve horizontal
and vertical offsets plus a logical line anchor.

## Vue Contract Mapping

The control is a native Avalonia-only source-editing surface. It preserves the
shared Markdown transaction identity, UTF-16 coordinate, external-update, and
composition semantics; it does not claim a Vue component alias or DOM API.

## Supported Platform Differences

`AccessibleName` applies to the public Edit automation peer and native input
owner. The peer provides the Value pattern and read-only state; item status
exposes caret line/column, line count, and match count. Native IME, clipboard,
font fallback, text rasterization, and automation bridges follow [`docs/avalonia/platform-differences.md`](../platform-differences.md).

## Theme Tokens

The control reuses the text-editor surface, text, muted-text, border, focus,
disabled-surface, radius, spacing, typography, and monospace resources from
[Application Setup](../installation.md#application-setup); it defines no
component-specific token or theme variant.

## Minimal Avalonia Example

```csharp
using FsusUI.Avalonia.Controls;

var editor = new FsusCodeEditor
{
  AccessibleName = "Release notes source",
  WordWrap = true,
  ShowLineNumbers = true,
  TabWidth = 4,
};

editor.LoadDocument(
  new FsusMarkdownDocumentIdentity("release-notes", 1),
  "# Release notes\n\n- Ready for review");

editor.FindNext("review");
editor.RevealLineColumn(3, 3);
```

## Known Limitations

Committed evidence covers public-API interaction, a production native input
owner in Avalonia headless, deterministic Skia renders for light, dark, and
high-contrast themes, and a 10,000-line realization budget. The composition
receipt is a local lifecycle simulation; it is not a real Windows TSF, macOS
input method, Linux IBus, UIA, VoiceOver, AT-SPI, or physical-device session.
