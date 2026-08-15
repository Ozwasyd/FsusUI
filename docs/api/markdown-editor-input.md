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
