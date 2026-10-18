# MarkdownEditor

`ElMarkdownEditor` provides a reusable Markdown editing shell: a toolbar command registry,
controlled `modelValue`, one transaction dispatcher, selection/history/IME state, and
source/live/split/preview modes with save, submit, and image-upload events. The application
owns only business glue such as upload, draft saving, and publishing; it does not maintain a
second document, selection, command, or undo authority.

## Basic Usage

```vue
<template>
  <el-markdown-editor
    v-model="content"
    default-mode="split"
    @save="saveDraft"
    @submit="publishArticle"
    @upload-image="openAssetPicker"
  />
</template>
```

`modelValue: string` is the sole public content authority. While waiting for the parent
`v-model` echo, the component may maintain an optimistic document and revision with the same
value, but DOM, HTML, the Markdown AST, and the preview renderer are not writable content sources.

Enter/Delete/Tab, smart pairing, clipboard, and beforeinput/composition share one
transaction dispatcher. The same input must produce the same raw-source transaction in
source/live/split. See the input contract and verification entry point in
[Markdown editor input](../api/markdown-editor-input.md)。

Document embeds enter projection through the single `::embed[target="..." mode="article|heading|block"]`
block directive. The editor does not infer mode or interpret target as a path or permission.
See the grammar and mutation fixture in
[Markdown runtime projection](../api/markdown-runtime-projection.md)。

## Transaction contract

Public transactions use ascending, non-overlapping UTF-16 code-unit ranges, matching the
units of browser `HTMLTextAreaElement.selectionStart/selectionEnd`:

```ts
interface MarkdownEditorChange {
  readonly from: number
  readonly to: number
  readonly insert: string
}

interface MarkdownEditorSelection {
  readonly start: number
  readonly end: number
  readonly direction?: 'forward' | 'backward' | 'none'
}

interface MarkdownEditorTransaction {
  readonly changes: readonly MarkdownEditorChange[]
  readonly selection?: MarkdownEditorSelection
  readonly origin:
    | 'input'
    | 'command'
    | 'paste'
    | 'drop'
    | 'programmatic'
    | 'external'
  readonly history: 'merge' | 'separate' | 'skip'
  readonly expectedRevision?: number
  readonly metadata?: Readonly<Record<string, unknown>>
}
```

Change ranges must not be out of bounds, overlap, descend, or split a UTF-16 surrogate pair.
When restoring selection, the component corrects to grapheme boundaries around combining
sequences and ZWJ emoji while preserving backward direction. Latin, CJK, emoji, RTL, and
multiline selections use the same contract. `metadata` is propagated only through read-only
events and does not participate in change validation, revision, or history decisions.

Each accepted content transaction increments revision. For a placeholder, upload, or other
asynchronous replacement, the consumer must save the prior dispatch result's `revision` and
submit the replacement through `expectedRevision`. If revision changed, the dispatcher
returns `accepted: false` with `reason: 'stale-revision'`; it does not guess a rebase, replay at
the current cursor, or produce a partial replacement.

## Public methods

The component ref exposes only these editing entry points; all enter the same dispatcher:

```ts
const result = editor.value?.dispatchTransaction(transaction)
editor.value?.undo()
editor.value?.redo()
editor.value?.applyAttachmentResult(providerResult)

const inserted = editor.value?.insertMarkdownAtCursor('plain markdown')
const placeholder = editor.value?.dispatchTransaction({
  changes: [{ from: cursor, insert: '![uploading]', to: cursor }],
  expectedRevision: currentRevision,
  history: 'separate',
  metadata: { operation: 'asset-placeholder' },
  origin: 'programmatic',
  selection: { start: cursor + 12, end: cursor + 12 },
})
```

- `dispatchTransaction(transaction)`: validates and applies changes, revision, selection, and
  history, then returns `MarkdownEditorDispatchResult`.
- `undo()` / `redo()`: apply saved changes/inverse changes without calling browser-native
  snapshot undo.
- `insertMarkdownAtCursor(markdown, options?)`: keeps the existing Boolean return contract and
  still calls the same dispatcher internally. `options` accepts `selection`, `expectedRevision`,
  and read-only `metadata`; new code that needs revision/result should call
  `dispatchTransaction()` directly.
- `applyAttachmentResult(result)`: returns provider progress, resolved, rejected, cancelled,
  stale, or document-abort results to the matching item. The component submits replacements
  only through stored document/revision/item identity and rebased source ranges; cancelled,
  deleted, and stale items never reappear at the current caret.

The component does not expose a textarea ref, internal store, DOM/HTML state, or third-party
editor type. `defaultMarkdownEditorCommands` and consumer commands merge into one registry;
there is no compatibility dispatcher or per-surface command list. New code uses the stable
command context through `runMarkdownEditorCommand` and passes its result to the dispatcher.

## Chrome variants

`chrome` controls only the editor's surrounding regions. It does not change mode, Markdown
source, selection, history, transaction, renderer, events, or editor identity:

| Chrome     | 使用场景                         | Toolbar 与 status             | 根表面                        |
| ---------- | -------------------------------- | ----------------------------- | ----------------------------- |
| `framed`   | 表单、设置和独立编辑器           | 默认显示                      | 完整公共 token frame          |
| `embedded` | 已有 document/task surface       | 保留，避免丢失 command 与状态 | 不重复根边框、圆角或 material |
| `minimal`  | consumer 自行组合 command/status | 不渲染空 toolbar/footer       | 仅内容表面与必要语义          |

The three chrome variants share one semantic region structure and apply to every public mode.
Hiding surrounding regions must not leave an empty separator, unreachable control, or reserved
height; `embedded` and `minimal` receive focus-visible from the active region. Switching chrome
must not rebuild the editor, lose selection/history, or change scroll-container identity.

Toolbar/command and status surfaces use their respective default content or slot. A provided
slot replaces that region's default content instead of creating a second region. `framed`
renders both by default; `embedded` renders a region only when it has default content or a slot;
`minimal` renders neither by default and shows them only when the consumer supplies the slots.
The body is always the sole content region for the current mode; `live` does not add a preview
region, `split` alone renders both an editor pane and renderer pane, and `preview` renders only
the renderer surface.

| Mode      | 编辑表面             | 渲染表面         | 可修改 |
| --------- | -------------------- | ---------------- | ------ |
| `source`  | 精确源码             | 无               | 是     |
| `live`    | 同一渐进渲染编辑表面 | 内嵌于编辑表面   | 是     |
| `split`   | 编辑 pane            | renderer pane    | 是     |
| `preview` | 无                   | renderer surface | 否     |

`live` is not a second preview chrome over the source textarea. The `split` separator expresses
only a real pane boundary; `preview` retains an accessible name and loading/error/capability
state even without an editing surface. Live has one `source-textarea` as the input/selection/
IME owner; projection decoration anchors to a `syn:` node range, is not editable, and never
writes HTML back to source. Mode changes do not rebuild textarea, history, or document identity.
Public modes are only `source` / `live` / `split` / `preview`; there is no `write` alias, and
the visible copy for source mode is 「源码」.

Live capability uses only these six frozen tokens: `supported`, `unsupported-platform`,
`runtime-unavailable`、`projection-failed`、`feature-degraded`、`fatal`。
Results must bind document identity, epoch, and source revision; same-source/different-document
results must not be reused. Unknown tokens, numeric codes, `write`/`ok` aliases, and
`readonly`/`disabled` mappings all fail closed. `resolveMarkdownLiveCapability` and
`readMarkdownLiveCapability` are the only entry points; state must not be guessed from DOM,
classes, or error strings.

Code highlighting, Mermaid, and LaTeX share one internal active/static/unmounted
resource lifecycle. Offscreen technical nodes release node-local work while an
unchanged node may reuse a bounded immutable render result through the same safe
output gateway. Cache and lifecycle state never become source or transaction
authority. See the [heavy-feature lifecycle contract](../api/markdown-heavy-feature-lifecycle.md).

## Command registry

Every command surface consumes the same `MarkdownEditorCommand` registry. Commands use stable
`key`, `label`, `group`, controlled icon tokens, shortcuts, and presentation targets;
`when(context)` controls presentation and `enabled(context)` controls execution. `preview`
has no editable surface: commands are still listed by `when`, but `enabled` is always false and
every invocation path, including shortcuts, fails closed. Shortcut conflicts must fail
explicitly and must not depend on array order. Before rendering any surface, the registry
rejects duplicate/empty keys, empty groups, unregistered icons, normalized shortcut conflicts,
and the legacy `apply` execution entry.

The consumer replaces `documentIdentity="{ id, epoch }"` when switching documents; identity
must change even when old and new `modelValue` strings match. An identity change cancels
pending commands, closes temporary command surfaces, clears old undo/redo, and starts a new
document from the current controlled `modelValue`; late results from the old document cannot commit.

Command context exposes only document identity, revision, selection, mode, read-only state,
syntax projection, position map, abort signal, and the transaction dispatcher. Commands must not
parse Markdown, query rendered DOM, access the textarea/editor instance, or store raw selection
offsets to guess a rebase. The editor projection supplies syntax/node/range facts; content
changes go through the transaction dispatcher. The position map uses
[`createMarkdownAnchorMap`](../api/markdown-runtime-projection.md)
`remapRange` semantics across each committed revision and distinguishes `mapped`, `partial`, and
`deleted`; it never adjusts raw offsets by string-length differences. Stable syntax identity is
preserved through in-place edits, moves, and mode changes; an invalid document epoch or projection
ID fails closed.

`run(context)` may return a controlled transaction result synchronously or asynchronously. An
asynchronous command must not commit after document epoch changes, abort, or anchor deletion;
the consumer displays errors through its own feedback component, and the command does not call
toast. Toolbar, keyboard, palette, slash, and selection presentations share the same key,
availability state, and pending/result authority.

`surfaces.commandPalette`, `surfaces.selectionToolbar`, and `surfaces.slashMenu` are opt-in
presentations. Palette search reads only command `label`, `description`, and `keywords`; visible
copy comes from `localeText.commandPalette`. `Esc` in the selection toolbar or slash menu closes
the current surface, restores source focus, and retains source, selection, and history. The
current projection/input context validates a slash trigger; execution merges the trigger range
and command result into one revision-bound transaction, so it cannot delete the trigger first
and then submit a stale command result. Slash does not infer syntax from keydown, rendered DOM,
or regex; URL, code, math, escaped slash, ordinary RTL text, and composition-active input do not
open the surface.

Built-in `link-properties`, `anchor-properties`, and `anchor-insert` commands also come from
the registry snapshot. Explicit insert and editing an existing anchor use different localized
command copy but enter the same controlled anchor-property surface.
The former reads only the stable link node and content/marker/full ranges supplied by projection,
and edits label, destination, and title within those projection-owned ranges; remove preserves
original label bytes and open continues to use Markdown URL authority. The latter explicitly
inserts/edits/removes/copies a block anchor and never generates an ID automatically. An invalid
projection ID, duplicate/invalid ID, or stale revision rejects the transaction. Both contextual
surfaces locate through the public anchor-map identity, so consumers need not pass a DOM
selector/ref; source reveal, cancellation, and successful commit restore the same source selection/focus.

Command pending/abort/stale state is managed by one editor command session. An asynchronous
result commits only while the original document identity, epoch, and revision remain current;
an external reset or component unmount aborts the pending session. `statusDensity="none"` hides
only the visible footer and does not hide the `aria-live` announcement for degraded/fatal
capability; that announcement is localized through `localeText.capabilityAnnouncement`.

`localeText` is the sole override authority for editor-owned visible copy, including modes,
built-in commands, command groups, actions, palette, search/replace, attachments, image
properties, embeds, atomic actions, selection/slash/contextual surfaces, textarea names,
capability/result states, and status metric labels. The provider returns only stable status/reason
codes; the editor resolves them through `localeText` at the display and ARIA boundaries rather
than matching error-message strings. Extensions continue to provide their own command `label`,
`title`, and `description`; custom group keys should get visible names through
`localeText.commandGroups`. `statusDensity="minimal"` shows only character and word counts;
`detailed` uses a definition list for lines/columns, line count, characters, words, selection,
and optional bytes. The metric session reparses only changed segment boundaries and incrementally
updates raw line starts and UTF-8 byte count; selection changes do not rescan the document.
Ordinary input does not write these metrics to `aria-live` on every keystroke.

## Paste as Markdown

`Paste as Markdown` is an explicit command. It does not replace or reprioritize
ordinary paste, so `Ctrl+V` / `Cmd+V` continues through the existing clipboard
transaction path.

The command freezes the available HTML, Markdown, and plain-text clipboard
representations together with the current document identity, revision, source,
and selection. It then opens a review dialog without mutating source or history.
The dialog presents the converted Markdown, the source before/after diff, and
typed removed, flattened, or unsupported conversion warnings. Keyboard, touch,
and assistive-technology users receive the same three choices: paste plain text,
import Markdown, or cancel.

Confirmation creates one `history: 'separate'` command transaction, so one undo
reverts the import. A changed document, revision, source, or selection makes the
frozen anchor stale and the command fails without rebasing or inserting at a
guessed position. Cancel, rejection, and successful confirmation restore editor
focus and the applicable selection.

Picker, paste, and drop create the same attachment batch from actual `File` metadata; picker
does not manufacture an empty file in advance. A drop position must map from the browser pointer
caret through the public source anchor map. If a reliable pointer anchor is unavailable, the drop
is rejected instead of falling back to the current selection.
Attachment descriptors are emitted only as an identity- and revision-bound
provider intent through `upload-image`; the editor does not perform upload I/O or
insert clipboard data URLs. Consumers return lifecycle updates through
`applyAttachmentResult()`. The editor owns the undoable pending source form and
the compact, visible pending/error actions; it never stores provider HTML or a
consumer-private URL scheme. The command blocks duplicate activation while
reading the clipboard and fails closed during composition, when `readonly`,
`disabled`, or `loading` is set, and in `preview` mode. Conversion and
sanitization remain owned by
[Markdown editor input](../api/markdown-editor-input.md) and the existing HTML
import boundary.

## Markdown table editing

Table editing remains source-authoritative. The active cell is resolved from the
stable table projection plus an exact source-range anchor; row and column numbers
are remapped coordinates, not the cell identity on their own. Structural commands
therefore act on the cell containing the current editor selection and reject a
missing, malformed, deleted, or stale anchor.

While a source, live, or split editing surface owns focus, Tab and Shift+Tab move
between cells, Tab from the final cell appends one row, Escape exits the table, and
boundary arrow/Enter actions use the same transaction dispatcher. The contextual
table trigger opens one scrollable menu for row, column, alignment, and formatting
actions; it does not keep a multi-button toolbar visible. Arrow Up/Down and Home/End
move within the menu, Escape restores the trigger, and Tab follows normal focus
order instead of trapping focus. A context-menu request inside a cell opens the same
action authority rather than a second command implementation.

Pasting `text/tab-separated-values` or `text/csv` inside a table creates one
separate-history table transaction. It respects the document identity and revision,
keeps quoted CSV line breaks as `<br>`, applies row/column/cell budgets, and falls
back to ordinary clipboard handling when the payload is not table data. Preview
tables keep their width inside the editor-owned horizontal scroll container; the
consumer must not patch private table selectors. Explicit format preserves the
document newline style and cell text, pads each column to at least three source
characters, and writes separators as `---`, `:---`, `---:`, or `:---:` for
unaligned, left, right, or centered columns.

When the shared projection identifies the current selection as an image, the
editor exposes one compact property surface for alternative text, destination,
title, and the adjacent `::caption[...]` text. Apply, source reveal, safe open,
exact/visible copy, attachment replace, caption removal, and atomic figure
removal are visible keyboard and touch actions with a minimum 44px target. Each
edit uses the projection-owned raw subrange and the transaction dispatcher;
unsafe destinations are rejected by the Markdown URL authority. The surface
does not inspect rendered `<img>` attributes, regroup DOM, synthesize alt from
title/caption, or provide a parser fallback when the projection has no image
node.

## History and grouping

Each history entry stores forward and inverse changes, not a whole-document snapshot per keystroke.
The fixed budget is:

- at most 100 undo entries;
- retained inserted + deleted UTF-16 units across undo/redo must not exceed
  1,000,000；
- evict oldest entries when the limit is exceeded.

Adjacent ordinary input in the same direction may merge into one undo unit within 1000ms when
selection has not moved intentionally. Commands, paste, drop, programmatic changes,
composition completion, and async replacements are always separate units. Blur, selection moves,
mode/disabled/loading changes, and external reset end the merge group. A new local mutation or
external reset clears redo.

## Composition and controlled reset

After `compositionstart`, toolbar commands, Tab/Shift+Tab, Enter structure continuation,
programmatic mutation, and selection restoration fail closed. Intermediate composition `input`
does not create history; `compositionend` commits the final value as one
`history: 'separate'` transaction. Automated composition events prove only the component state
machine; real Simplified Chinese, Traditional Chinese, Japanese, and Korean OS IME still need
manual or device evidence from the corresponding input methods.

When the parent prop echo equals the current optimistic value, it confirms the existing revision
without adding a transaction/history entry. Any different prop value is an external hard reset:
replace content, clamp to a grapheme-safe selection, increment revision, and clear undo/redo.
Undo from the old document cannot affect the new external value. Only this prop watcher owns
silent-reset authority. Public `dispatchTransaction({ origin: 'external', history: 'skip' })` is
still a controlled content mutation, must emit `update:modelValue` / `change`, and fails closed
during composition like every other public mutation. When a prop reset invalidates an active
composition, late `compositionend` / `input` restores only the current controlled value and must
not commit IME DOM text from before the reset. The invalidation window is bounded; if the browser
does not send `compositionend`, ordinary non-composition input may continue after the window.
Outside the window, isolated old payloads marked `isComposing` or `insertCompositionText` remain
rejected, and an immediate commit after a late `compositionend` cannot cross the current controlled value.

## Search and consumer-resolved embeds

`Ctrl/Cmd+F` and `Ctrl/Cmd+H` open the editor-owned find or replace surface.
The active query is rerun after every accepted transaction and controlled
document reset. Match identity remains bound to the current document revision;
stale or deleted reveal results trigger a fresh search instead of restoring an
old source range. Source and Live use a non-interactive range overlay, while
Live/Split/Preview renderer text uses the CSS Custom Highlight API when the
browser supports it. Neither path wraps renderer HTML or changes Markdown
source, selection ownership, line wrapping, body width, or scroll-container
identity.

`embed-provider` is the consumer-owned resolution boundary for valid
`::embed[...]` projection nodes. The editor supplies an identity-, revision-,
node-, target-, mode-, and version-bound request. It commits only a matching
result and treats late or mismatched results as stale. Prepared Markdown projections
use the existing read-only renderer and host base URL, CSP and feature settings;
the consumer supplies authorized bytes and the current target version through
[`prepareMarkdownEmbedResult`](../api/markdown-runtime-projection.md).
Metadata-only provider excerpts are rendered as escaped text; the directive remains the only host
source/history authority. Source mode displays the exact directive. Live keeps
the textarea as its only input surface and places the controlled read-only embed
regions below it; Split and Preview interleave those regions with the normal
Markdown renderer. The regions expose source reveal, exact-Markdown copy, delete,
open-source, and applicable retry actions without an iframe, nested editor,
nested scroll surface, or permanent embed tab stop.

`embed-open-source(target, mode)` and `embed-retry(target, mode)` leave target
resolution, authorization, navigation, and retry policy with the consumer.
Delete and source selection remain editor transactions/selections. Provider
result height changes use the existing editor body as the only scroll owner.

## Web language tools

The same textarea used by Source and Live binds browser spellcheck, autocorrect, dictation,
context-menu correction, and text-replacement capability. `spellcheck` accepts `auto`,
`enabled`, `disabled`, or the corresponding Boolean; `lang` provides an optional BCP-47 hint,
and `nativeWritingTools` accepts `auto` or `disabled`. These props configure browser capability
only and do not create a second document or spelling engine.

`insertReplacementText` must first create a language-tool session bound to the current document
identity, revision, and selection, then turn its explicit raw UTF-16 range into one
`history: 'separate'` transaction. Every editor revision or source update refreshes the Web
adapter's current state; old sessions are not reused and no rebase is guessed. composition-active,
readonly, disabled, preview, and stale document/revision/selection states fail closed. Suppression
for code, URL, hidden marker, and atomic contexts is a local capability; switching Source/Live
does not avoid mapping by globally disabling spellcheck.

Raw ranges, hidden markers, nested syntax, atomic nodes, and visual points all consume the
stable projection and anchor map from `@ozwasyd/element-plus/markdown-runtime`; the language-tool
adapter does not parse Markdown or treat raw offsets as visual offsets. Replacement fails closed
when the map, projection, or source does not belong to the current document/revision.

Playwright Chromium, Firefox, and WebKit tests cover replacement event routing, revision/session
refresh, Source/Live switching, composition interlock, touch, and accessibility semantics in
production fixtures. Automation for dictation, writing tools, context menus, screen readers, and
IME uses reproducible local event/input simulation. It verifies editor session/selection/
transaction/map semantics but is not evidence from a native OS spellchecker, real context menu,
voice service, assistive technology, or OS IME device. The complete native host/device matrix is
an independent acceptance lane and is not replaced by these simulations.

## Events

| 事件名             | 说明                                                         |
| ------------------ | ------------------------------------------------------------ |
| update:modelValue  | 已接受的公开内容更新                                         |
| change             | 与 `update:modelValue` 相同的公开内容更新                    |
| transaction        | 每次 accepted/rejected dispatch 的只读 result 与 transaction |
| selection-change   | producer 捕获的只读 documentIdentity、revision 与 grapheme-safe、direction-preserving selection |
| history-change     | `canUndo/canRedo`、depth 与 retained UTF-16 units            |
| command            | toolbar command 已通过 dispatcher 执行                       |
| mode-change        | 编辑模式切换                                                 |
| save               | 保存事件                                                     |
| submit             | 提交事件                                                     |
| upload-image       | 上传图片事件                                                 |
| render-complete    | preview renderer 完成                                        |
| render-error       | preview renderer 失败                                        |
| features-activated | preview feature activation 完成                              |
| embed-open-source  | consumer 应打开指定 target/mode 的来源                       |
| embed-retry        | consumer 应重新解析指定 target/mode                          |

## Outline and writing aids

`revealHeading(nodeId)` and `revealSourceRange(range)` use the current document identity,
revision, and projection. The synchronous success status admits the target and starts
the legacy asynchronous selection/focus/scroll continuation; it is not a completion
acknowledgement. A stale, deleted, unsupported, or missing target does not move selection,
focus, scroll, or history. Use `revealSourceRangeAndWait` below when navigation needs
observed completion.

`writing-aids` takes effect only when explicitly enabled by the consumer:

- `focus` applies only to editable surfaces with `editor-profile="prose"`. It identifies the
  current block from the same projection and selection, lowers emphasis on other blocks through
  text opacity, and does not hide, blur, or create a second editable DOM owner. Search,
  diagnostic, property, attachment, and atomic nodes may remain readable through projection exemptions.
- `typewriter` positions only after ordinary input or explicit outline/search navigation; a
  selection change alone does not scroll. Wheel, touch, scrollbar, selection drag, and composition
  pause automatic positioning; later input or explicit navigation resumes it. The default anchor
  is upper-third; `writingAids.typewriterAnchor = 'center'` must be selected explicitly. Reduced
  motion retains positioning but disables smooth scrolling.

The Focus layer is an `aria-hidden` presentation; the textarea remains the sole owner of input,
selection, clipboard, focus, and IME. Neither writing aid modifies Markdown source or history.

## Attributes

| 属性名            | 说明                                        | 类型                                      | 默认值   |
| ----------------- | ------------------------------------------- | ----------------------------------------- | -------- |
| model-value       | 唯一公开 Markdown 内容 authority            | `string`                                  | `''`     |
| default-mode      | 初始编辑模式                                | `'source' \| 'live' \| 'split' \| 'preview'` | `source` |
| mode              | 受控编辑模式                                | `'source' \| 'live' \| 'split' \| 'preview'` | — |
| chrome            | 外围区域与根表面变体                        | `'framed' \| 'embedded' \| 'minimal'`     | `framed` |
| placeholder       | 文本域占位文本                              | `string`                                  | `''`     |
| commands          | toolbar command model                       | `MarkdownEditorCommand[]`                 | 内置命令 |
| writing-aids      | prose focus 与 typewriter opt-in             | `MarkdownEditorWritingAidsOptions`        | —        |
| focus-exemptions  | Focus mode 中保持清晰的 source node 状态     | `MarkdownEditorFocusExemptions`          | —        |
| editor-profile    | markdown 或 prose 写作表面                   | `'markdown' \| 'prose'`                  | markdown |
| readonly          | Read-only; blocks input and mutation methods     | `boolean`                                 | `false`  |
| disabled          | 禁用输入与全部 mutation method              | `boolean`                                 | `false`  |
| loading           | 标记 busy 并冻结输入与全部 mutation method  | `boolean`                                 | `false`  |
| preview-base-url  | preview renderer 的基础 URL                 | `string \| null`                          | `null`   |
| preview-csp-nonce | preview renderer 的 CSP nonce               | `string \| null`                          | `null`   |
| preview-features  | preview renderer 的 feature activation 开关 | `MarkdownFeatureActivationFeatureOptions` | —        |
| embed-provider    | consumer-owned、revision-bound embed resolver | `MarkdownEmbedProvider`                    | —        |
| min-rows          | 编辑区最小行数                               | `number`                                     | `12`     |
| spellcheck        | Browser spellcheck capability                | `'auto' \| 'enabled' \| 'disabled' \| boolean` | `auto`   |
| lang              | Optional BCP-47 language hint                 | `string`                                     | —        |
| native-writing-tools | Browser native writing-tools capability     | `'auto' \| 'disabled'`                       | `auto`   |

## Migration

Existing code may continue treating `insertMarkdownAtCursor()` as a Boolean and may omit
selection `direction`; the dispatcher normalizes an omitted value to `none`, while every
result/event returns an explicit direction. New asynchronous replacement code should use
`dispatchTransaction()`, save its `revision`, and pass `expectedRevision` in the later
transaction. Do not add a second dispatcher, consumer undo cache, or private textarea escape.

MarkdownEditor is classified as `native-adapter` in the Avalonia baseline: public transaction,
revision, history, and selection-direction semantics remain consistent. Avalonia uses a native
text control and selection API and exposes no Web DOM. See
[Avalonia platform differences](../avalonia/platform-differences.md)。

## Document identity and position maps

Consumers provide an opaque document identity (`key` with an optional `epoch`) when
the editor is used for more than one document. A key or epoch change is a complete
document switch even when the Markdown bytes are identical: the editor isolates
undo/redo, selection, merge state, pending composition, and asynchronous anchors
from the previous document. Re-sending the same value for the same identity is a
no-op and does not clear history.

Every accepted transaction reports its before/new revision, identity, selection,
history state, and a deterministic position map. Async commands, attachments,
search, outline, diagnostics, and projections must retain the identity and expected
revision with a mapped anchor; they must not keep a bare offset or implement a
consumer-local delta rebase. A stale revision, deleted anchor, or changed document
identity rejects the result instead of applying it at a guessed location.

The transaction implementation is complete, but its tracking acceptance remains
separate: native CJK IME commit, cancel, and undo require direct evidence from real
browser/OS/input-method combinations. Synthetic composition events validate only the
component state machine and are not native-IME acceptance evidence.

### Retained public editor session (source WIP)

`getSession(editorSessionRef)` binds one stable consumer session ref to the mounted
editor and returns the same `MarkdownEditorSession` on repeat calls. A different ref
on that instance is rejected. Types are exported from `@ozwasyd/element-plus`;
the internal session binding factory is not a public entry point.

`captureSnapshot(digestSource)` synchronously hashes the actual transaction-owner
source with the consumer's content digest function. The callback must return a
lowercase 64-character SHA-256 digest and must not retain the source. Snapshots
expose only opaque refs, document identity/epoch, transaction revision, selection,
history counts and the digest. The sole transaction store retains one bounded
checkpoint of its immutable history entries. A subsequent successful capture
supersedes the previous checkpoint; failed captures retain the previous checkpoint.
No source or undo/redo entries are copied to the consuming application.

`validateRetainedSnapshot(snapshot, expected)` is a read-only check of that
original retained token object and the actual current document id/epoch/revision.
Matching strings from another native instance, copied or superseded tokens and
stale expected context return false; IME/disposed owner refusal is preserved.
It does not recapture or restore state and does not certify view/renderer restore
or resource readiness. Application composition uses it to reject foreign native
custody and replacement during asynchronous original journal reads.
The check also delegates to the original transaction store's read-only retained
token/history custody check. A switch away and back to identical id/epoch/revision
does not revive a released transaction checkpoint. Original mutating restore and
its history-checkpoint refusal remain unchanged; no metadata-only ABA acceptance.
Capture/restore expected context may include `assertAdmission`. This actual
consumer callback runs after the final renderer/view read and before original
transaction retain/restore, with native availability/context checks preserved.
A thrown guard preserves prior custody/selection/history. The consuming factory
supplies its real owner/reference/admission guard; no success or receipt is issued.
The final admission is followed by the actual panel quiescence/custody fence before
transaction retain or restore. Public `openSearch()` can enqueue an original
nextTick continuation at unchanged document/revision; it refuses before native
history/selection mutation or replacement of the previous retained token.

The original native owner now optionally captures immutable panel metadata into
that SAME bounded checkpoint. `snapshot.panelRefs` contains independent backed
`activeNodeRef`, `scrollAnchorRef`, `outlineRef`, `searchRef` and nullable
`attachmentStateRef`; these are not aliases of the partial `viewStateRef`.
`session.readPanelState(originalSnapshot)` resolves only current original native
token/projection/DOM/job custody. Foreign/copied/superseded/epoch/revision/ABA or
replaced owners refuse. Missing projection/required native DOM or queued original
frame/layout/search continuations keep panel capture unavailable.

`inspectContentDigest(digestSource, expected?)` passes the actual original body
only to the synchronous digest callback and returns immutable native document/
revision/digest metadata. It reserves native inspection against reentrant retained
capture/restore and checks actual admission and unchanged native context/body after
the callback. It never retains/restores history or replaces a checkpoint. This is
read-only source correlation, not complete snapshot/resource/readiness authority.
Digest results and session refs must be primitive strings before validation;
object conversion callbacks never run after the final native context fence.

Active state uses original syntax/selection/link/anchor/contextual/atomic state.
Scroll metadata retains actual original live anchor and native textarea/preview
offsets, without recomputing geometry. Outline is derived by the existing original
projection/outline owner; search UI/matches are deeply frozen metadata copies.
Restore writes the original native refs and DOM targets and preserves the same
original projection and attachment jobs. No parser, body, history or job/controller
is cloned/replaced. Actual retained metadata/reference memory is counted by the
original native surface's measured usage; it does not qualify complete resources.

Attachment refs require real completed dispatch settlement, same original weak
job/controller identities and dispatch proof, exact metadata and cleared original
batch/item/File custody. Pending/progress/legacy unknown/unwind/cleanup cases yield
null attachment ref. Terminal cleanup, removal, retry, signal or phase/attempt/range
changes invalidate it. State restoration preserves verified original settled jobs;
it cannot revive a File loan/controller/request or rewind a terminal operation.
Weak identity witnesses retain no additional File/controller ownership. After the
actual original dispatch future settles and its terminal content handler finishes,
resolved/deleted attempts can retire their original item/batch/File records while
retaining the SAME original jobs and dispatch proofs. Original name/kind metadata
stays on the original job; no replacement attachment job/controller or File index.
This supplies a nonempty same-owner attachment state path when ALL original batch/
item/File custody is truly cleared. Retryable rejected/cancelled state and unknown
settlement retain their original custody and keep the attachment ref unavailable.
Same attempt and actual settlement are required; signal abort/UI phase alone is
insufficient. Pending or retryable sibling records keep the original batch alive.
Actual accepted button/ordinary editor deletion records the deletion attempt in
the existing original job binding and retries terminal retirement with the same
settlement/identity guards. A deleted phase alone cannot release retryable custody;
running/legacy unknown futures refuse. An old-attempt marker cannot retire a later
attempt. Undo/redo never resurrect released File/item/batch records or controllers.
Rejected removal restores only unchanged original job metadata, with owner/range/
attempt/revision checks between setters; it issues no deletion or settlement proof.
An accepted reentrant deletion during File abort never attempts retirement inside
the cleanup/publication stack. The original binding retains its actual deletion
attempt; the original cleanup unwind and completed transaction publication retry
the real retirement sweep. Actual running/pending sweep state blocks resource
inspection and is measured by the same native surface. Failure retains that
outstanding work and propagates, with no idle/paused acknowledgement. Outer cancel/
retry/remove rechecks original attempt/phase/range/binding/document/revision after
abort callbacks and preserves the accepted reentrant result instead of overwriting it.
If a retirement reader reenters with another accepted deletion after that job's
turn, the original frame scheduler owns one reserved auxiliary continuation for a
single later sweep. Further reentry gets another real frame, never a recursive
synchronous drain. Pending/running/refused/failed admission keeps outstanding
request state and refuses refs; actual handle cancellation or callback settlement
releases the continuation record. Scope release marks an installing continuation
cancelled and cancels its actual returned handle, without inventing settlement.
This is same-owner/same-revision source only; full factory/draft/renderer/resource and
native/worker/kernel/geometry/privacy acceptance remain blocked/UNRUN.

`restoreSnapshot(snapshot, expected)` accepts only the exact retained snapshot
object, on the same mounted owner, document identity/epoch and source revision.
It restores the transaction owner's history and selection plus retained mode,
search and textarea scroll state without taking focus. Foreign, cloned, superseded,
document-switched or source-modified snapshots are rejected. Capture/restore during
IME composition or after unmount is rejected. This is in-memory same-instance
restoration, not cross-instance hydration, serialization or crash recovery.

`inspectCapabilities()` reports the actual current roster and renderer proof
availability on this instance. A real authorized last-valid-render ref is available
only from an existing full-document renderer at the exact current identity/epoch/
revision. That retained ref does not supply renderer hydration after disposal.
Native/template surface subscriptions, complete renderer pipeline controls and
external command/embed/upload resource owners remain absent. Aggregate inspect,
pause and resume refuse before a partial transition when any roster owner is
missing; disposal also requires every original owner to be paused and recoverable.
A valid snapshot is preserved after refusal. Application panel/draft/crash-journal
refs remain original-owner dependencies. This source must not mint an immediate
ready receipt or admit workspace eviction.

The resource participant contract is now exported as types from the root API:
`MarkdownEditorSessionResourceParticipant` has one closed `ownerRef` and real
`inspect`, `pause`, `resume` and recoverable `dispose` operations. The coordinator
requires the entire owner roster before returning aggregate usage or beginning a
transition. Duplicate/unknown owners, invalid counts, nonzero running resources
reported as paused, failed resumes and unrecoverable disposal are refusals.
`inspectResourceParticipants()` exposes the partial census and explicit missing
owners; it does not claim that a partial census is total resource usage.

The actual shared frame scheduler reports pending phase entries/handles, auxiliary
frame handles and executing callbacks through a separate `resourceState()`; its
original metrics field contract is unchanged. Pause cancels the actual handles
and queue, rejects scheduling while paused and refuses cancellation inside an
executing callback. Auxiliary continuations preserve their existing RAF timing;
this increment does not qualify phase ordering or typography behavior.

The partial editor-surface owner controls the actual gesture timer, ResizeObserver
and owned viewport listeners. It remains excluded from the complete roster: Vue
template/v-model DOM subscriptions lack a reversible detach/drain/rebind owner.
Disabled/readonly does not prove subscription release; no full surface paused
acknowledgment is available from these imperative controls alone. The layout owner
tracks every existing nextTick/microtask continuation until it actually settles;
its document identity, revision and lifecycle leases suppress stale effects.
Pending microtasks cannot be removed physically and prevent a paused acknowledgment
until settlement. Existing unnamed frames now go through the same scheduler.
Retained transaction memory units count the union of live and checkpoint history
entries as logical 64 KiB payload units, not physical heap measurements.

The asynchronous command resource ledger retains the original attempt objects
until their original `finally`, including aborted, concurrent and superseded
attempts. It aborts the actual signals on pause and suppresses late commits and
failure UI after lifecycle/document changes. It does not replace the command-key
registry or recreate a command on resume. The async-command participant registers
only when all configured and pending commands are the original editor-owned pure
commands. Arbitrary public `run()` providers lack a resource census/control API;
AbortSignal alone cannot establish request cancellation or zero network usage.
Changing command props does not hide an outstanding external attempt. Blog's
command adapters currently include such external providers, so this dependency
remains explicit there.

These implemented owners do not close the roster. Renderer/projection awaits complete underlying controls;
native/template surface and external provider custody remain incomplete;
external-command census, renderer last-valid checkpoint and recoverable disposal
remain dependencies. Full public pause/resume/inspect/dispose refuse before a
transition when any owner is absent. Integration with the concurrent typography
increment additionally needs its visibility listener, deferred callbacks,
measurement DOM and pending reflow promise in the actual resource census; the
session-only patch does not modify that owner's source.


The actual Web language controller now exclusively owns search creation/run/cancel.
On mount it takes search custody before the first search; the editor no longer
retains a second task alias or calls the runner independently. Search refreshes
original source/revision/config/context before execution. Its actual language-search
participant is registered only after controller binding. Pause first checks actual
composition, cancels the real task/session, gates native attributes and clears
existing match/highlight view aliases; document switches and unmount cancel through
the same controller. Resume permits only fresh work, without replaying cancelled
searches or automatically re-arming delayed native replacements. Controller memory
and existing renderer/layout/native aliases retain their separate actual custody.
`recoverable:false` and disposal refusal remain unchanged.

This source consumes language owner offer `6b9eb126984973438bba02c89316bdd8a85bad73`
as an isolated increment. Its six original-suite cases remain UNRUN. No runtime,
native language-tool, IME, privacy, cross-session CSS-highlight or recovery
qualification is supplied by this wiring.


`captureLastValidRender()` reads the actual existing full-document renderer's
opaque authorized result, checking the sole transaction owner's current document
identity/epoch/revision. It returns null for absent, fragment/embed or stale renders;
no hidden renderer or synthetic ref is created. `captureSnapshot` retains that
nullable proof. A snapshot with a render proof cannot restore if the original
renderer has lost/replaced that exact ref. This is same-owner custody checking,
not serialized renderer hydration or recoverable disposal. The new snapshot field
has no content/HTML payload and does not qualify a complete host snapshot.

Renderer source offer `53d83a1c1f4c020597c6e807c8582f8c04309454` is consumed as its
own isolated increment. Its partial resource source offer remains complete:false;
the renderer-projection participant is not admitted. Real worker-pool/pipeline,
hardware sampler, virtual-window and heavy-runtime control APIs and validated
restoration remain upstream dependencies. Existing security/privacy/render/race/
backuprestore/native/IME holds continue unchanged.


The original editor now uses `createMarkdownAttachmentEmbedResourceOwner` as its
single embed watcher/request/generation/version/results lifecycle. The previous
component maps/Sets and async runner are removed rather than run in parallel.
Retry, presentation versions, unmount abort and attachment-result eligibility
all go through the actual owner. Cancelled provider promises and preparation
work remain counted until their real settlement. Creation identity on original
attachment jobs is retained; old-document and terminal progress cannot commit.

The integrating participant refuses pause before any change when an upload is
unfinished, preserving its original terminal-result path. Capture/retry use the
actual pause gate. Opaque consumer networking has no inspect/control interface:
once an embed provider is bound or an upload is invoked, this participant is
excluded from the complete session roster until a real consumer owner exists.
Replacing props or receiving a terminal response does not prove the producer
released independent resources. Its library-only zero network count is never
presented as whole-session usage for those consumers. The empty, never-external
lifecycle can report its actual watcher/record census; disposal remains restricted
to the source owner's verified empty paused state. No other owner's
`recoverable:false` is promoted.

Attachment offers `a4a25d2c` and
`b4baa7d5b2ef43e9c0133584cf58f1922e23c2db` are preserved as separate source
increments. The author's 51 runtime cases lacked coordinating-root approval and
are excluded from this task's acceptance. Their command is not adopted as a
preflight or executed here. This task performs source parsing/lint/compilation
only; native/worker/network exposure of that external run is unresolved under
the root audit and supplies no zero-resource or qualification evidence.


Consumers may pass expected original document identity/epoch/revision as the second
`captureSnapshot` argument. The transaction owner validates it before hashing or
checkpoint mutation; stale mounted binding therefore preserves the prior snapshot.
This supplements the post-digest actual-owner checks, without trusting registry
identity as a substitute for reading the mounted original editor.


The public `restoreLastValidRender(capture, expected)` delegates to the existing
full-document mounted renderer's real retained projection restoration. It checks
the original document epoch/revision and renderer instance across the await.
Segmented/embed projections and replaced/busy owners fail closed. This operation
does not restore the complete workspace snapshot or prove resource quiescence.
The exact upstream renderer offer is UI916 `21c9e8769c005ffbc1fbd0a09a7ccc463211984e`;
its measured source census remains `complete:false` and its participant remains
excluded. Its A/B/C source review and all runtime qualification are still held.

Language/search now consumes the reviewed UI917 final offer
`e37960672df85705793d6534ed4c7c076b4a0f86`, including real runner buffer custody
and cancellation checks. Its participant remains non-recoverable. The attachment
participant is excluded pending original owner settlement/admission repairs.
An `upload-image` event has no service future and cannot prove settlement.
External command observation is monotonic for this instance: command prop
replacement, abort or Promise settlement does not prove opaque resource release.
The original default command implementation functions are validated as well as
object identity. Deferred selection restoration rechecks its owner after focus.
All incoming source cases and owning session cases remain UNRUN here.

Document switches explicitly cancel the old typewriter owner's actual layout and
scroll-cleanup frame handles and reset its scroll suppression flags. Old geometry
callbacks keep their document-epoch guard; cleanup never executes stale geometry.
This minimal source fix addresses the independent reviewer P2 on the original
`9f600e0c` checkpoint. Runtime geometry/scroll/IME acceptance remains UNRUN.


`attachmentDispatch({ batch, item, file, onProgress })` is an optional per-item
consumer hook returning the **actual service Promise/thenable**, not a synchronous
result. Native file capture retains the original File in the existing item custody
for that attempt/retry. When configured, capture/retry invokes this hook through
the original attachment owner's real dispatch ledger and does not also emit
`upload-image` for that attempt. `onProgress` enters only its progress admission
gate; terminal content receives the owner's immutable settled proof after the real
future resolves. Rejection settles that ledger and updates only a still-current
original job. No Promise is manufactured from an event or terminal label.

Without the hook, the existing void `upload-image` event and legal
`applyAttachmentResult` progress/Markdown completion remain compatible. Content
admission is recorded on the original item before the event and still checks the
original document/epoch, batch/item, revision, range and terminal state. This is
content permission only: no service future, settlement proof or recoverability is
issued. Started service-future attempts still need their exclusive owner proof even
if the dispatch prop is later removed. Legacy resource settlement remains unknown, so an unknown or still-running legacy attempt cannot be retried as a
settled attempt. The original paste-as-Markdown event producer has no registered
attachment job/service future and retains its legacy event/unknown custody. No
second upload is started. The existing MarkdownTextEditor Blog upload permission
and callback path is unchanged; it supplies no real service future here.

The immutable UI915 `90cc75bb5afce355430d414ee2e1b421ea265804` fixes are consumed
as separate upstream commits. They separate embed refresh from attachment
admission generations and progress from awaited terminal provenance, and control
capacity refusal. Root source review remains held. Attachment total-roster
registration remains disabled; arbitrary consumer network/timer resources and
retained File physical-heap qualification are not inferred from promise settlement.
All runtime/native/worker/network/IME/receipt qualifications remain UNRUN here.

The public `inspectDocumentState()` reads identity/epoch/revision directly from
the original transaction owner without digesting, capturing or replacing a
checkpoint. It gives the existing Writer mount resolver a real editor binding
before first edit/render, independent of adapter event caches. No body, history
copy, route identity fallback or second mounted-session registry is introduced.


`inspectRendererResourceSource()` reads scalar observations from the existing
full-document mounted renderer, with the original editor document/epoch/revision
and renderer-instance checks around the read. Missing, source-only or segmented
renderer ownership returns null, never synthetic zero usage. The result keeps
`complete:false`, `measuredUsageOnly:true`, `sourceReview:'unqualified'`, the actual
nullable network measurement and original unknown timer/network/worker/pool tags.
`pendingRenderAdmissions` and `pendingControlTransitions` read the underlying
owner's actual counters. No scope capabilities, handles or mutation methods are
exposed by this scalar projection; it does not enter the complete resource roster.

This wiring consumes immutable renderer UI916
`439ad560207b6cde1a6641c41d35c73714b45ad8` (A227/B54/C210 source) as a separate
upstream offer. Its A cleanup-exception P1 remains under original-owner repair and
is retained explicitly as a missing source-review dependency. Language UI917 final
`e37960672df85705793d6534ed4c7c076b4a0f86` remains the actual registered controller
participant, recoverable=false. Attachment review stays closed to registration;
UI9155be7dcee904c4ea90db6835abf97a1e7319bd6a4 attempt-cache/unlink repairs are not consumed or accepted here. Readonly
source inspection does not issue ready, paused, recovery or eviction proofs.

`inspectAttachmentResourceSource()` reads the sole setup-owned attachment/embed
participant's actual scalar counters through the same public session. The original
inspection may refuse unknown legacy settlement or owner transitions; those
exceptions remain visible. The result always keeps complete:false and unqualified
source review, excludes opaque consumer network totals (`null`) and records missing
consumer controls, dispatch continuation custody and recoverable checkpoint owners.
It exposes no paused/recoverable acknowledgment or control capability and does not
admit the attachment participant into the aggregate roster. Actual document epoch
and revision are checked before/after this read, including same-source replacement.
Candidate UI915311ffe5d remains under independent review and is not consumed by this
owning scalar observation increment; the legacy content compatibility fix remains.

The current renderer source combination is UI916
`26d94443350bfbe91e0862640f7b8eacd17b5471`, consuming corrected A927
`ef17179f8788a4bf69f0998e8635191460ad1db1`. Independent review closes the original
worker cleanup callback exception P1 in source; the notification-watermark P2
remains an explicit scalar source dependency. The actual renderer retains its
callback failure, counts its diagnostic record and refuses projection restore
while it remains. This session forwards the original missing recovery dependency
and measured values without exposing failure causes/control handles or creating
notification-delivery acknowledgment. Complete/unqualified and runtime holds remain.
Attachment311ffe5d stays unconsumed; final-jobs callback context and raw/proxy job
findings are under original-owner repair. Legacy settlement stays unknown.

The current renderer combination is UI916
`f3be19325c00e933c0590a988843d502ddec5f81`, consuming A928
`f99529d944c604b0c2a0f518b95eb3403bf07d9f`. Root reports the notification-watermark
P2 source CLOSED; the prior unconditional review-gap tag is removed. Actual pending
notification still adds the original conditional settlement dependency and retained
logical diagnostic unit, and blocks projection restore. A cleared pending snapshot
means a notification attempt only; the original retained failure/recovery gap and
all complete:false/unqualified/resource qualification holds remain.

Attachment7d771a96 still has an original watcher lifecycle/unique-handle P1 under
repair. Its actual bindAttachmentInputs contract was inspected: original reactive
documentIdentity, editorRevision ref and deep attachmentJobs ref are the exact
inputs; one prepared `.vue` hunk stays unapplied until source review. Existing
attachmentEmbedOwner.abort owns watcher cleanup; no consumer watcher is added.

Original editor panel captureViewState retains partial mode/search/caret scroll.
Outline methods are model/reveal planners, not an active-node/scroll-anchor retained
checkpoint issuer. Search and attachment original owners do not currently expose
full immutable checkpoint/validation/restore refs. Those original producers must
supply actual #2294/#2295 panel state before a complete factory refset can exist;
ref aliases or reconstructed parallel panel state are not used here.

The current attachment source is UI915
`b1693bdb302714c11a974994246d11e4ca48d8b5`, consumed as an independent upstream
increment. The sole setup-owned attachmentEmbedOwner now receives exactly one
bindAttachmentInputs call using the existing reactive documentIdentity, original
editorRevision ref and original deep attachmentJobs ref. Existing stable batch/item
Maps remain the owner callbacks. No consumer watcher, copied job queue or second
attachment owner is introduced. The original abort on unmount stops owner watcher
lifetimes; original pause/resume delegates remain the sole lifecycle controls.

Actual future dispatch/onProgress/frozen awaited-final provenance and original
legacy content compatibility remain unchanged. Prior context/proxy/transition P1s
are root-reported source CLOSED; combined session wiring is still unqualified.
Failed native watcher stops remain actually owned/counted. Sequential request
cancellation can stop early on a throwing cleanup while references remain; it is
not release proof. Reviewed flag stays false and aggregate roster remains excluded
until genuine consumer resource controls and acceptance exist. The separate public
attachment892 FileConsumer/capture offer is not fabricated or replaced here; the
original upload-image event is not renamed. Runtime/list/discovery/mount/native,
consumer/native heap and eviction qualification all remain UNRUN.


## Native attachment File bridge

Native pick, paste, and drop retain their actual `File` objects only for active
attachment jobs in the owning editor. The `upload-image` event still receives the
metadata-only `MarkdownAttachmentBatchIntent` first; it never gains a `files`
property. Native accepted captures add an optional second argument,
`MarkdownAttachmentCaptureObservation`:

```ts
interface MarkdownAttachmentCaptureObservation {
  readonly batch: MarkdownAttachmentBatchIntent
  readonly transaction: MarkdownEditorTransactionEvent
  readonly plan: Readonly<{
    transaction: MarkdownEditorTransaction
    jobs: readonly Readonly<MarkdownAttachmentJob>[]
  }>
  readonly placements: readonly Readonly<{
    item: MarkdownAttachmentItemIntent
    range: MarkdownAttachmentRange
  }>[]
}

type MarkdownAttachmentFileConsumer = (
  file: File,
  capture: MarkdownAttachmentCaptureObservation,
) => void

const accepted = editor.value?.withAttachmentFile(batch, item, (file, capture) => {
  // Bind the consumer's original capture to this accepted placeholder transaction,
  // then lend this exact File and item.signal to its genuine pending upload handle.
})
```

These types are exported by the existing MarkdownEditor public type boundary.
`withAttachmentFile(batch, item, consume): boolean` calls the consumer synchronously
with the identical original native File and genuine capture observation, or returns
`false` without calling it. It requires the original batch and item objects from this
editor, the exact item order, capture revision, document id/epoch, first attempt, and
active batch/item signals. Equal metadata, object spreads, reconstructed IDs,
serialized observations, another editor's objects, and metadata-only captures do
not grant a File association. The observation itself contains no Files.

The observation's `transaction` is the exact read-only object emitted by the
existing `transaction` event for the accepted placeholder insertion. Its
`beforeRevision === batch.revision` and its
`transaction.expectedRevision === batch.revision`. Its post `revision` increments
once when content changes; replacing a placeholder with identical bytes is an
accepted no-op with the same before/post revision, following the existing kernel.
The replacement still revokes the previous File, even for equal metadata. Native
event fingerprints distinguish new batch/item IDs at an unchanged revision;
fingerprints and IDs alone never grant File access. All ordered placeholders
enter that one change/dispatch. `upload-image` runs after dispatch and job registration;
the File loan performs no capture or dispatch. `plan` is the actual original
planner result, including the original transaction and job objects; its jobs stay
owned by the existing lifecycle and can subsequently rebase. `placements` retains
the original frozen range objects from those jobs, paired with the original ordered
items. Use these ranges and the actual accepted transaction/result/position map to
verify the localized placeholders; do not replan or derive offsets from filenames.
Consumers connect their original capture to genuine pending handles by admitting
that existing transaction in their own context. A consumer `commitCreated` that
dispatches its own placeholder requires a consumer-owned admission change first;
receiving this event must not insert placeholders again. An observer that changes
the document/revision during dispatch prevents the old capture from granting Files.
The original accepted jobs enter the existing attachment lifecycle before public
dispatch callbacks run; File associations are registered only after those jobs
remain current. A callback that deletes or replaces an original placement prevents
admission even when it inserts identical bytes and the revision stays unchanged.
Selection-only callbacks and non-deleting edits at the same revision preserve the
association. Refusal retires only that capture's original jobs/items before aborting
its signals; it does not recreate a placement or grant from matching source bytes.
Public transaction metadata cannot exempt an attachment from mapping. Completion
and removal keep their existing exemption through their actual private owning job,
without granting authority to a copied item ID.

Each item has its own `AbortSignal`. Cancellation, retry, rejection, completion,
removal, replacement, or deletion revoke that item's loan and release the retained
File. Other pending items remain independent. Ordinary edits keep surviving jobs
current through the existing range rebasing. A document id/epoch change or unmount
revokes every loan before abort listeners run. The batch signal aborts when its last
loan is revoked. Metadata retry events keep their existing first-argument contract
but have no native capture observation and cannot remint a released File: obtaining
another File requires a new native capture.

Accepted edits rebase every affected attachment job and remove all deleted File
associations before invoking any item abort listener. A deleted sibling cannot be
borrowed during another item's abort callback; surviving rebased siblings remain
usable. Abort signals still run their normal synchronous listeners.

Completion plans retain the actual placeholder range until the existing dispatcher
accepts the replacement. After File revocation and its callbacks, the editor verifies
the original item/batch/job binding, attempt, range, source, current document id/epoch
(including props awaiting a switch), and current revision. The completion transaction
carries that document identity and `expectedRevision`; the resolved range is published
with the actual accepted result/position map before outward transaction observers.
A callback that edits, replaces, deletes, switches, or releases this context causes
coherent refusal and preserves the current source. Equal numeric revisions alone
cannot authorize a completion: an equal-byte replacement map can delete its anchor.
A stale completion cannot be revived by later progress/resolved callbacks. Recover
through a fresh native replacement and its new original File association. Ordinary
current completions and surviving independent items continue through
`applyAttachmentResult()`.

Accepted transaction events retain their original result/map as historical evidence,
even if a synchronous listener commits a newer transaction. Model/change notifications
and saved selection/history effects require the result's document id/epoch, current
source and revision to remain current. The editor checks again after each outward
callback, including the model notification; a nested edit cannot be followed by an
older model/change value. A selection-only callback can keep the content result current
while superseding its selection. Queued selection restoration checks the actual document,
source, revision and selection again after the next tick and after focus listeners.
Release/unmount also suppresses saved effects. Native capture checks the released state
before capture and again after the accepted dispatch, before registering any job or
File association. If a transaction listener unmounts the editor, the fresh unregistered
batch/item controllers abort and no association is recreated after cleanup. File loans
also require a live editor. The editor preserves callbacks and the accepted historical
transaction; it does not replay or remint the superseded operation.

Applications own their pending handles, upload IO, callbacks, and cleanup of any
references they retain from the synchronous loan; observe `item.signal` when lending
into an upload. Continue returning results through `applyAttachmentResult()`.
File access and transaction observations confer no asset/reference/cleanup
authority. Descriptor-only upload events remain metadata-only and omit the second
argument. This bridge does not qualify a browser/device or consumer integration.

The #2295 integration keeps `getSession`, capture fingerprint census and all
existing real future/attempt result gates. Legacy content-attempt bookkeeping
uses the original item object without replacing it or retaining another File.
Copied job document identity is checked together with private raw-job/original
batch/item proof. The original batch Map now owns revocable records; its actual
resource census includes File/controller entries and accepted capture placements.
Opaque consumer resources and post-future continuations remain unqualified;
`attachmentResourceOwnerReviewed` stays false and complete pause/disposal is
unavailable. Selection restoration keeps the existing tracked layout scheduler
and rechecks current native state after focus. These are source capabilities,
not runtime, resource-release, recovery or eviction qualification.

During actual synchronous File revocation, public attachment resource inspection
and participant control refuse while cleanup callbacks are still executing.
Detached records/controllers can remain on that cleanup stack; an empty Map
alone is not a release acknowledgment. Surviving File loans still follow their
original per-item admission. The guard ends when the actual cleanup frame exits.


### Consumer request capabilities

`MarkdownAttachmentFileConsumer` remains a synchronous File loan callback. A void
callback or a bare provider-result promise supplies no cancellation, resource census,
full-work settlement or recreation capability. The owning native adapter must keep
that invocation unknown; it must not record it as zero work or qualify pause/disposal.

Consumers that own these operations may implement `MarkdownAttachmentRequestConsumer`
or `MarkdownAttachmentRequestDispatch`. Both return their actual original
`MarkdownAttachmentConsumerRequest`, with distinct `result` and `settled` futures,
`cancelLocal(reason?)`, and `inspectLocalResources()`. The settlement future covers
all local request work, including progress callbacks, cancellation/cleanup and work
that continues after content result settlement. Resource counts include background
tasks, timers, observers, retained listeners, local network requests and memory units,
including retained checkpoints. Unknown, missing, negative or noninteger counts are
unsupported, never normalized to zero. Server-side work is outside this local census.

`bindMarkdownAttachmentConsumerRequest(returned)` retains that same request and both
original request futures. Binding does not call an upload provider, subscribe to or
replace those result/settled futures, start another attempt or create a File grant.
Cleanup invocations separately observe only their actually returned cleanup work.
Void, bare promises and incomplete handles
return `{ supported: false, reason, value: returned }`, preserving any original unknown
work for its invocation owner. Supported bindings forward pinned original methods with
their original receiver. Census admission checks their identity around the actual
callback; reentrant binding controls refuse before changing state. Exceptions propagate.
Calling cancellation does not settle either request future or prove any resource was released.

`cancelLocal` and checkpoint `release` explicitly return either synchronous `void` or
their actual `PromiseLike<void>` cleanup work. The binding returns that identical work,
not an async wrapper or synthetic future. It observes the original cleanup future and
exposes the actual returned observer future in `inspectCleanup()`, together with its
original checkpoint pointer, pending/fulfilled/rejected/unobservable status, original
rejection cause and any observation failure cause. The invocation owner must retain
and await both real futures. Pending, failed or unobservable cleanup blocks census
admission; cancellation/cleanup statuses do not acknowledge full business settlement.
Pending or unobservable work cannot be retried by assuming it finished. Synchronous
exceptions and observed asynchronous rejections retain original cause and cleanup
references, allowing the same original pinned operation to retry after known failure.
A successful actual release fulfillment clears the checkpoint; merely returning a
promise does not. Unobservable work remains held with its pointer and actual return.

The optional original `checkpoint` port supplies `capture()`, `recreate(checkpoint)`
and `release(checkpoint)`. Without all three methods, checkpoint operations are
unsupported. A capture retains the original non-null opaque object without inspecting,
cloning or reconstructing its body. Only that binding's current original pointer can
recreate. Copies, foreign objects, released checkpoints and repeated or cancelled
recreations refuse. Recreation invokes the original port once and returns a binding to
its actual new request; returning the same original attempt or reusing any original
result/settled future in that recreation chain is unsupported. Different object shape
alone is not a new attempt. Failed
recreation still consumes recreation admission. The checkpoint reference remains for
original release, including after cancellation; a failed release retains it for retry.
Released or consumed opaque objects remain weakly marked expired in that binding and
cannot regain recreation admission when returned again by the original capture port.
`retire()` invalidates checkpoint recreation before an owning attempt/document is
replaced, retaining original cleanup methods, request, futures and census access.
The producer does not remint File access from a checkpoint. If capture returns an
opaque object but changes capabilities during its callback, the unsupported result
still exposes that identical object. `getRetainedCheckpoint()` also returns the exact
retained pointer for original release, including after capture failure or retirement.
It performs no provider read, body cloning or new checkpoint issuance.

These helpers only bind capabilities supplied by the actual invocation. They do not
grant attachment-job/result/transaction authority. The native attachment owner must
associate the binding with its actual original attempt, retain unknown/failed requests,
await the original full-work `settled` future independently of `result`, and obtain a
current known census before claiming local quiescence. Checkpoint capture/recreation
also requires that owner's actual current document/attempt and quiescence admission;
the helper neither dispatches placeholders nor qualifies retained-session restore.
Import these original helpers/types from `@ozwasyd/element-plus`; the public editor
type barrel additively exports the same producer declarations. The existing
`MarkdownEditorAttachmentDispatch` remains the promise-only legacy hook. The shared
editor now accepts `attachmentRequestDispatch` through the original strict request
entry described below. Existing void-event consumers remain
unsupported for resource/settlement/recreation admission. No remote cancellation,
server settlement or disposed-editor recovery guarantee is supplied.


## Prepared native snapshot publication

The same public getSession now supplies prepareSnapshot(digestSource, expected?),
commitPreparedSnapshot(preparation, assertAdmission?) and
discardPreparedSnapshot(preparation). Preparation returns a frozen
MarkdownEditorSessionPreparedSnapshot containing the proposed native snapshot.
It is uncommitted: validateRetainedSnapshot rejects the candidate and the original
retained token remains current. Equal-data copies or another owner's candidate
cannot commit or cancel it. There is at most one pending candidate per original
transaction/session owner. Additional prepare/legacy capture refuses until it
is committed or discarded.

The original transaction store pins its own live immutable history entries/array
identity, selection, revision/document identity, merge boundary and prior
retained token. It creates no second history/body owner and exposes no entries or
source. Commit performs all fallible allocation before publication and rechecks
original private custody afterward. Original admission, renderer/panel/lifetime
checks precede final native mutation; no callback/await/fallible owner action
follows native token publication. All native refs in that one snapshot publish
with the original transaction token as one synchronous operation. Nullable render
or panel/attachment refs remain nullable; they are not full-host completeness.

Preparation/commit failure propagates and cancels only that candidate. The prior
original token is not replaced; genuine independent edits, identity changes or
release can still invalidate it and are never undone. Cancel is allowed after
owner retirement for cleanup, returns true only for actual candidate custody,
and does not release the committed checkpoint. Actual retained panel memory
includes the one pending candidate. CaptureSnapshot now uses these real methods
without changing getSession or the component's expose owner. Original mutating
restore history code remains unchanged.

This provides atomic publication of issued native refs only. Draft/journal/renderer
participants still need original non-invalidating preparation, private validation
and callback-free publication/failure protocols for a complete application refset.
Existing native restore remains same-owner/same-identity/epoch/revision. Identity
props reset history and cannot supply cross-body/epoch restoration. Resource
completeness, pause/disposal/eviction and every runtime qualification remain held.


Prepared publication's original store now allocates retained array containers in
a separate staging step BEFORE the session's final admission/render/panel/
lifetime guards. Allocation may synchronously retire application admission while
leaving native coordinates unchanged. The final guards therefore follow both
allocations; store commit then performs only private checks/assignments, followed
by the session's private assignment. Allocation success is never an admission
proof. The exact normal-return allocation reentry control is source-only UNRUN.


The same session also supplies `sealPreparedSnapshot(preparation, assertAdmission?)`,
`hasSealedSnapshotCustody(publication)` and `publishSealedSnapshot(publication)`.
Seal finishes reservation allocation, original retained-array allocation and all
external admission/render/panel/lifetime reads before issuing one exact private
publication ticket. Ticket construction failure cancels only the candidate.
The last custody check and publisher use pinned original transaction producer
methods and private session pointers; they perform no external callback, await,
allocation, model write or history restore. The ticket has scope
`native-owner-custody`; copied, cancelled, retired or already published tickets
return false/null. Original native input, selection/projection, IME/mode, panel
and mounted-ref transitions synchronously invalidate that ticket. The original
unmount hook retires publication authority before cleanup/release, including
setup-time retirement. Changed authority cannot reseal an older candidate.

This finite native ticket does not attest Renderer live document/projection,
Journal disk/TTL, application principal or complete multi-owner lifetime. Those
original producers must supply their own synchronous invalidation/private
reservation protocols before a joint final guard and callback-free same-identity
publication can be installed. Sequential native/Renderer/Writer/Journal publishes
are not a complete atomic refset. All runtime and full-host qualification remains
UNRUN; resource completeness, restoration and eviction holds stay in force.


The original transaction store now supplies a document authority feed through the
same heavy-feature document context. `documentAuthority.capture()` borrows one
exact immutable ticket (`scope: native-transaction-document`, documentKey,
documentEpoch, revision), and `hasCustody(ticket)` checks only original private
store custody. Real switch/reset/dispatch/selection/undo/redo/history-merge,
retained restore/release entry first invalidates authority before argument reads,
allocation or callbacks. Capture refuses throughout nested writes and resumes
only when original try/finally exits. Failed/no-op writes conservatively revoke
older tickets without rolling back or replacing committed native history.
Native pending preparation also pins this same private generation, so identical
coordinates after raw-store write/ABA cannot qualify an older candidate. Pure
native retained publication does not invalidate the live document ticket.

The SFC forwards pinned original store methods in its frozen existing context
and retires the store authority at the same early original unmount event, before
scheduler/resource cleanup, with setup-time retirement compensation. The feed
contains no source/history, owns no second editor/index and provides no Renderer
projection/pipeline, application/principal or resource qualification. Renderer
must consume this real producer together with its own original authorities;
no complete live Renderer seal or fullready is installed here. All ordinary
source controls and runtime qualification remain UNRUN/HOLD.


`documentAuthority.subscribeRetirement(receiver)` now registers a synchronous
retirement receiver in that SAME native store. It returns a frozen handle with
`unsubscribe()`, pure `hasCustody()` and `failureCause()`. Each actual write first
invalidates the existing generation/ticket, then attempt-all notifies original
registered receivers before entering the original writer body or caller reads.
A notification failure propagates the first original cause, retains failed
registrations/causes and permanently closes ticket issuance. Busy notification
rejects registration/unsubscribe/reentrant writes; actual native pending custody
also refuses retirement operations. Permanent unmount retirement notifies the
same receivers and attempts session retirement even when a receiver fails.

Unsubscribe first retires its receiver; successful private unlink alone releases
actual registration custody. Failure, including caught release reentry, keeps
the receiver and original cause. A genuine successful retry may remove it but
cannot reopen permanently retired document authority. No external listener Set,
second generation/producer/history or synthetic resource-zero receipt exists.
Renderer must register its original retirement function and retain failed
handles; its projection/pipeline/cleanup and all qualification remain its original
owner's work. New ordinary source controls remain UNRUN/HOLD.

The public `getSession(editorSessionRef).documentAuthority` readonly field now
borrows the exact same frozen authority object supplied to that mounted editor's
heavy-feature context. Its original `capture`, `hasCustody` and
`subscribeRetirement` functions remain pinned to that one transaction store;
the session does not wrap them, copy a ticket, create a second realm, or replace
the returned retirement handle. Internal bindings whose owner supplies no authority
return `null`, never a fabricated source. The actual mounted editor supplies it.

Public type imports from `@ozwasyd/element-plus` are
`MarkdownEditorSessionDocumentAuthority`,
`MarkdownEditorSessionDocumentAuthorityTicket`, and
`MarkdownEditorSessionDocumentAuthorityRetirementHandle`. These alias the existing
producer types. A retained public authority still obeys original write/unmount
retirement: capture returns null and private custody refuses when retired; new
registration refuses. Existing handles remain available for real cleanup retry.
Unsubscribe failures keep the same registration/cause and throw the same original
error object; consumers must retain that handle until actual unlink succeeds.
The public bridge does not acknowledge resource release or qualify Main/Renderer
joint publication, restoration, complete host readiness, or eviction. The mounted
same-object, failure-custody and missing-source controls remain source-only UNRUN.


Receiver notification occurs only once at the outermost actual transaction write
entry. Internal nested merge-boundary/retained operations remain inside that
already revoked generation and introduce no second receiver callback after value,
selection/history mutation. Notification/release-time reentrant writes still
refuse. A next outer notification failure remains before its mutation.

Early unmount stores its first original retirement failure. The original late
cleanup hook attempts each attachment/retained/search/command/timer/frame/observer/
highlight/embed/viewport cleanup independently and rethrows that first cause only
after all attempts. Failed search cancellation retains controller/participant;
timer/observer references clear only after successful original cancellation.
No resource completeness/disposal/zero-usage receipt is issued. Source controls
for second-call failure, actual SFC model synchronization and failure-followed
viewport cleanup are added only/UNRUN. The earlier3de receiver source had one P1
and one P2 and is not an accepted implementation; this repair needs new review.

### Full-document Renderer checkpoint handle

The original session owner installs `getRendererCheckpointHandle()` from the
same mounted full-document preview Renderer. Segmented/embed rendering, DOM
fallback, hidden/unmounted preview, a missing getter or an unassembled Renderer
returns `null`. The owner pins the selected Renderer, original getter and `this`,
then checks the same instance/root/full-document selection around the getter call.
The public session additionally checks native document identity/epoch/revision.
Reader errors and replacement refusal propagate; no other Renderer is discovered.

The returned handle and its opaque preparation/publication must be held across
prepare/seal/has/publish/cancel. The getter forwards the actual original handle
without cloning or issuing tickets; pure has never reacquires or inspects. A held
handle still permits original pending-candidate cancellation after the getter
refuses a retired/replaced mount. This scoped capability preserves all original
resource/restoration/native holds and `complete:false`/`recoverable:false`; it
grants no full-host ready, disposed recovery or eviction.

### Published native snapshot custody

`MarkdownEditorSession.hasRetainedSnapshotCustody(snapshot)` checks only the
exact original published native pointer, retained transaction custody and same
private publication generation and the original transaction's retained write
generation. The transaction producer withdraws qualification before notifying
any write/retirement receiver, including when the document/history/revision
remain unchanged or a receiver throws. Notification failure keeps the original
failure/registration custody and never revives the published generation. The
query reads only original private slots; snapshot metadata is not authority.
It returns false before publication, for foreign
or superseded snapshots, while capture runs, or after original generation
invalidation/retirement. It never calls owner availability, composition, panel,
Renderer, DOM, clock, resource or source readers, and never captures or reacquires.
The admission-oriented `validateRetainedSnapshot(snapshot, expected)` remains
separate and unchanged. The new query introduces no history/body store or ticket
issuer and grants no resource, full-host recovery or eviction qualification.

### Original native surface registration controls

`getSession(editorSessionRef).getNativeSurfaceResourceHandle()` returns the same
actual mounted SFC-owned handle, or null for an owner without this capability.
Import its public `MarkdownEditorNativeSurfaceResourceHandle` and
`MarkdownEditorNativeSurfaceInspection` types from `@ozwasyd/element-plus`.
This source is scoped to `native-surface-owned-registrations`.

The original SFC now binds its explicit native template events through a local
Vue directive that owns each actual node, event name, callback and registration.
Keyboard/event modifiers and the original Vue component error routing remain.
Viewport registrations use the same owner. `pauseOwnedRegistrations()` removes
these actual listeners, pauses the original WatchHandles, disconnects the owned
ResizeObserver and cancels the original gesture timer/typewriter work. It refuses
composition or an active callback. `resumeOwnedRegistrations()` rearms these
actual registrations using the original native authority ticket retained during
pause; it never reacquires after a native write/retirement or a changed node
structure. Observer/timer continuations retain original node/generation guards.
The native snapshot invalidation watch stays active.

Inspection reports actual listener/watch/callback records, observer/timer
counts, failures and original first/latest causes. A throwing native registration
operation retains an unknown record: `attachedListeners` becomes null rather
than zero. Cleanup attempts every owned record, and only a genuine successful
retry clears that record.
Successful release removes both the listener record and its target/name index
only when that index still points to the same original record. An empty target
bucket is removed only by identity; reentrant replacement registrations survive.
`retryOwnedCleanup()` remains available on the held original handle after
retirement, and retries actual cleanup without native capture or rearm authority.
Rearm failure attempts to detach partial installations
and re-pause watches before propagating the original cause. An original Vue watch
job already queued before pause is suppressed; its callback arguments are not
saved/replayed, and that skipped job closes rearm admission.

`complete:false` and `fullSurfacePaused:false` are fixed. Only
`ownedRegistrationsPaused` can describe this exact bounded owner. Vue's component
render effect/scheduler, v-model's internal input/composition/change listeners,
paused watch dependency subscriptions and queued/async work, the active authority
guard watch, fallthrough native attrs, child emitters and other directive/Teleport
lifecycle registrations have no complete reversible port here. They remain
explicit unsupported boundaries; disabled/readonly is not their detachment.
The complete session roster still omits `editor-surface`, and full resource,
disposed restoration and eviction refusals remain. Source controls are UNRUN
under the existing runtime/native/IME qualification hold.

### Bounded same-process native checkpoint recreation

An original live session can call `prepareNativeHandover(snapshot, principal)`
with its exact currently published snapshot and a borrowed original application
custody object. That object's pinned `hasCustody()` must return exactly true for
the same principal AND document/source context throughout admission. The SDK
does not create authentication or document authority from strings. Main must
provide the real original issuer; an old mounted/native token that dies during
widget unmount cannot substitute for continuing application custody.

The returned opaque `MarkdownEditorNativeHandover` is valid only in this process
and SDK instance. Normal SFC retirement and `releaseRetainedSnapshot()` still run.
Only an already-issued native pin can retain the original transaction checkpoint
at that release boundary. Ordinary writes/context changes withdraw its eligibility;
the old document issuer remains permanently retired. Without a pin, ordinary
unmount release is unchanged. `cancel()` explicitly releases the pin, including
genuine failed-retirement cleanup retry, without claiming complete disposal.

A fresh actual mounted editor binds the same logical session reference and calls
`adoptNativeHandover(offer, { documentIdentity, revision, principal })`. It requires
the same original custody object, source/epoch, and a pristine matching target
store. The producer moves the original live undo/redo and retained checkpoint
array pointers, never creates a second history timeline or serializes the body to
Pinia/storage. The target blocks native writes during reception and the original
SFC restores and verifies the actual textarea value, selection and direction.
Old transaction/history/session/document pins remain until that succeeds and all
final admission checks pass. Failure restores original target store pointers and
tries actual target view rollback, retains original source pins and first/latest
causes, and permits genuine retry. No original issuer is revived. New session
snapshot sequencing continues beyond the source sequence.

The proof is `native-recreated` with `nativeHistoryTransferred:true`,
`fullRefsRestored:false`, `resourcesValidated:false`. The old full session snapshot
is not installed as a valid target snapshot; capture uses the actual new owner.
This is bounded native checkpoint memory custody, not complete #2294 restoration,
pause/dispose/eviction or cross-startup revival. Renderer checkpoint recreation,
panel/provider state and Vue render/v-model/scheduler resource qualification remain
separate source dependencies. Main factory/composition/host readiness guards and
all runtime/native/IME/security/privacy/receipt qualifications remain held.

Receiving cleanup has independent original custody. If clearing the receiving
flag throws after adoption failure, `inspectNativeHandoverCleanup()` retains the
original primary cause and cleanup first/latest causes; the adopting barrier
stays closed. The held session's `retryNativeHandoverCleanup()` retries that same
pinned cleanup callback, refuses reentry/healthy retries, and releases the barrier
only on genuine success. Primary rejection identity is never replaced by cleanup.
Actual SFC restoration also pins its original document/root/textarea and locks
reentry; owner identity, document membership and root containment are checked
before and after the awaited original selection restoration. A connected node
moved elsewhere cannot produce a successful native recreation proof.

### Original physical native target birth lifetime

`session.getNativeTargetLifetimeHandle()` returns the same original SFC-owned
`MarkdownEditorNativeTargetLifetimeHandle`, or `null` without that actual owner.
Import it, `MarkdownEditorNativeTargetBirth` and
`MarkdownEditorNativeTargetSubscription` from `@ozwasyd/element-plus`.

`captureBirth()` checks the original transaction's private initial generation and
pristine history/checkpoint state, and pins the actual connected root/textarea
containment before final original admission. It issues one exact frozen birth
pointer. The cached pointer is never recaptured, reconstructed from revision-zero
metadata or refreshed after retirement. `hasCustody(birth)` reads only that exact
private pointer and observed physical lifetime, without DOM, source, resource or
document-ticket readers. Intentional document retirement during original native
handover does not withdraw this independent physical lifetime.

Initial native ref attachment establishes the actual birth; original root/textarea
replacement or withdrawal, owned-registration pause, surface pause and permanent
unmount withdraw the lifetime before notifications and subsequent owner effects.
`subscribeBeforeInvalidation(receiver)` returns an original notification handle
with `hasCustody()`, `unsubscribe()` and `failureCause()`. Every original receiver
is attempted. Failed notifications, raw/undefined causes and caught unsubscribe
reentry remain held; the same subscription retries its genuine failed callback
before releasing its registration. No cleanup, resource or disposal receipt is
created. The held lifetime handle remains readable after retirement.

The existing accepted native handover owns adoption, cancellation, receiving
cleanup/retry, history transfer/rollback and target containment. Its original
final admission additionally checks this original physical lifetime. No separate
staging barrier, cancel API or native cleanup/retry API is installed here. Root
owns actual Write mounting, physical cancellation and final readmission, and must
join the same borrowed birth with its actual view/document/principal custody.
Unobserved external DOM mutation, framework effects and platform queues remain
unqualified. Full resource/restoration/eviction refusals and all runtime/native/
IME/security/privacy/receipt/race/backup-restore holds remain HOLD/UNRUN. Local
source alias only; no package publication.

### Accepted original attachment consumer lifecycle intake

The separate local source composition consumes the exact attachment API, original
attachment lifecycle and embed/consumer owner postimages from
`ea9b729ac05dad9d8818bf7978b2d7c792b806f3`. The original File API lineage
`acdafdb18ee4668d6db8705837ff5e73c83a2f6e` and all previously installed File
API bytes remain; the new consumer capability section is additive. Original
attachment source controls are copied exactly and remain UNRUN. Current native
physical lifetime, MarkdownEditor SFC/session, shared dispatch and Heavy/Renderer
owning source are preserved.

The original rich consumer owner dispatches once and retains the real request,
separate result/full-local settlement futures, actual observer work and cleanup
history. It registers unsupported field futures before observation, shares original
observations across rejected future reuse, installs independent rich observations
before transfer and retains private legacy completion identity. Its diagnostic
source is a frozen snapshot gated by current epoch/attempt; a monitor never
substitutes for the original business future. Release requires actual full-local
fulfillment, known zero resources, completed cleanup observation and no retained
checkpoint. Missing/unknown/failed evidence keeps its actual obligation.

The existing shared SFC Promise dispatch remains explicit legacy/unsupported for
rich business settlement. No Blog business request, unaccepted upload/runtime
producer or synthetic full-settled wrapper is supplied by this intake.
`complete:false`, `sourceReview:'unqualified'` and `businessCoverage:'not-proven'`
remain literal original producer fields. Full resource/recovery/eviction and all
runtime/native/IME/security/privacy/receipt/race/backup-restore qualification holds
remain HOLD/UNRUN. Local source alias only; no package publication.

### Shared strict attachment request entry

Provide `attachmentRequestDispatch` with a
`MarkdownEditorAttachmentRequestDispatch` imported from `@ozwasyd/element-plus`.
It aliases the original canonical `MarkdownAttachmentRequestDispatch`: the
synchronous callback returns its actual `MarkdownAttachmentConsumerRequest`,
including the separate original result/full-local settlement futures and owned
resource/cleanup capabilities. It must not return an async wrapper, bare provider
promise or invented settlement acknowledgment.

The existing single SFC dispatch chooses this original strict hook before invoking
the consumer, calls the original `runAttachmentConsumerRequest` once for that job,
and returns the identical supplied request directly inside the original dispatch
admission. No provider invocation occurs before that admission or through a second
dispatch. The original owner alone binds the actual request/futures, observers,
cleanup history and epoch/attempt-qualified frozen progress/terminal snapshots.
Synchronous `onProgress` performs only original admission and content application;
it never awaits an upstream result/settled future or its enclosing SDK request.
Terminal consumption likewise performs a synchronous content commit after the
original owner's existing proof. Removing the hook does not replace or release
the original in-flight request.

Content provenance follows fulfillment of the original result future and its
actual observation work, independently of the request's full-local `settled`
future. The owner installs and retains both observations before content delivery.
Pending or unobservable local settlement and its original failures remain in the
same invocation ledger after the content result returns. Only actual known result
termination plus distinct full-local fulfillment, without observation failure,
can mark that dispatch settled. Retry, retirement, cancellation, cleanup and
resource census retain their original settlement requirements. Content delivery
does not make unknown upload transport work settled or certify zero resources.

A genuinely observed result rejection updates only the current original job's
presentation while local settlement remains pending. It does not release its File
or enable retry. The same retained settlement observation notifies the native
caller once actual settlement is known, so deferred File cleanup and terminal
retirement checks run and retry presentation refreshes without replaying content.
That notification stays inside the original observation/control boundary; its
raw failures remain debt and block settled admission. Replaced attempts, changed
documents, paused/released editors and removed original bindings refuse these
late presentation/cleanup effects. The original retirement rules remain intact.

`attachmentDispatch` retains its existing Promise-only compatibility signature
and original legacy owner path. Providing both hooks refuses before either
business invocation. Neither legacy content settlement nor a rich supplied handle
admits the whole component's resource/recovery census. Existing opaque-consumer
observation and `attachmentResourceOwnerReviewed:false` remain; no source/runtime
qualification is promoted. Blog still needs its real accepted business request
producer and callable adapter. This SDK integration supplies no upload/runtime/
binary-transport implementation or synthetic full-settled wrapper. All existing
full-ready/resource/restoration/eviction and runtime/native/IME/security/privacy/
receipt/race/backup-restore holds remain HOLD/UNRUN.

Dispatch configuration is captured before picker selection reads, attachment
clipboard/drop state changes, controllers, placeholders, jobs and File registration.
The capture holds that same immutable configuration through synchronous transaction
callbacks and uses it for the one original dispatch; it does not reread later props
and throw a conflict after allocating source state. Retry configuration refusal
likewise precedes File withdrawal and attempt mutation.
Paste and drop pass their same frozen entry configuration through transfer parsing,
selection reentry, capture and dispatch; transfer never rereads later props.

### Original terminal transaction observation

`attachmentTerminalObserver` is a synchronous application observation callback.
It receives `applying` before the original terminal application's File release,
`committed` only after the existing native dispatcher accepted a resolved content
transaction and all synchronous transaction/model callbacks returned with current
custody, or `refused` when the operation or notification did not finish admission.
Progress and the accepted placeholder capture never supply this terminal event.

The mounted editor's `withAttachmentTerminalTransaction` authenticates the exact
observation only inside its original notification. It lends the same capture,
batch/item, raw job, original settled dispatch reference/attempt, private-authorized
resolved result and actual transaction. The consumer returns a synchronous
boolean observation admission, not business success or work settlement. Copies,
repeated loans and asynchronous substitutes refuse. The original publication
barrier blocks lifecycle pause/resume during the application; original native
custody is rechecked after each callback and after the content transaction.

The custody's `isReleasingInput()` distinguishes this application's real File
release from unrelated input cancellation while it is in progress. It does not
revive a revoked File. Applications must still retain genuine cancellation and
notification failures. `inspectAttachmentTerminalNotificationFailures()` returns
original failed notifications, raw causes and unsupported returned work; it is not
a settlement or resource census. An accepted transaction remains historical even
if a later notification refuses. No second history, attachment result issuer,
resource owner, business grant, full snapshot/recovery or qualification is added.

This source is isolated from the independently pending atomic retry candidate.
Runtime, tests, native/IME/receipt and resource qualification remain unrun.

Terminal observation admission retains actual inner invocation and synchronous
acceptance separately from the outer observer return. Inner false, raw thrown
causes (including undefined), unsupported returned work and post-callback custody
failure remain original notification debt even if an outer callback catches or
returns true. Notify requires the actual accepted inner loan and no failure debt;
a later refusal notification cannot erase the first/raw failure.

### Pending original atomic retry consumer candidate

The separate consumer candidate depends on original owner
`b0775bf73a6a5a78067ff72afdc598f27639caa2`, which is still under independent
review. Its exact lifecycle/consumer postimages are staged only in this candidate;
the owner algorithms are not rewritten by Main and are not called accepted.

Main forwards the same frozen dispatch configuration and original job/binding/
document admission through the original strict or legacy entry's retry option.
It performs no File withdrawal or native retry mutation before owner admission.
The owner alone admits the old private scope/ledger, invokes Main's original File
callback, mutates the original native attempt and issues the one dispatch. Main's
phase callback checks the actual captured job, binding, item/batch membership,
document identity/epoch/revision and expected old/new native fields. File lookup
occurs inside the actual dispatch callback after owner File handling, so no earlier
loan is smuggled through cancellation/reentry. No public census or cloned ledger
grants retry. A pre-admission refusal leaves the old attempt and content unchanged.
Main records the actual attempt only inside that admitted dispatch callback, never
an old-attempt prediction. If the callback was not entered, its rejection and
retirement continuations do not mutate a guessed attempt. The b077 owner review
remains OPEN for custody between native retry mutation and new dispatch ledger;
Main does not implement ledger rollback or claim that finding closed.

This is pending-source integration, not completed P2 acceptance. Original controls
and all runtime/qualification remain UNRUN/HOLD; Root physical staging and real
Blog business producer/wiring remain separate. No complete resources, recovery,
full-ready or eviction is granted.

### Accepted atomic retry preparation consumer dependency

The isolated retry consumer replaces only the original owner/lifecycle source
with the exact accepted `e0351af7c1a855caf0fdc4d42507cc364ebb76dc` postimages.
After mutation, admission reads the original undelivered ledger preparation's
`targetAttempt`, never a native attempt increment prediction. The original File
loan identity is checked before its idempotent native revocation; partial prior
revocation cannot transfer a new File. File and actual attempt are still read only
inside admitted dispatch.

A real undelivered nonmutating preparation can display continuation retry without
claiming settlement. Original strict/legacy entries reuse that same preparation;
no repeated File callback, attempt increment, replacement job or duplicate ledger
is introduced. The consumer composite remains independently reviewable and is
separate from the native terminal transaction source. Runtime and qualification
remain unrun; preparation is not settled work.

Continuation adds the original Retry action metadata alongside the existing action
without rewriting the native job phase to rejected or marking its ledger settled.
The `attachment-retry-failure` scoped slot receives the original preparation's
`previousFailure` object and original raw `failures` values; default display uses
the existing localized retry status. No token, geometry, locale or typography
source changes. Final admission belongs to the original owner after all callbacks.

The original UI session branch composes accepted terminal observation/inner-loan
repair source `00645b8e4d2579bb2245fde29391b1e24b5beb07` with accepted atomic
retry consumer source `480cd78c9e15be6817b590fc23f1a7891e2a3e0f`. Their native
terminal and retry owning statements remain exact; original owner/lifecycle and
control blobs remain exact. Only the obsolete native retry helper import is
removed because the original owner now performs mutation. Constituents have
bounded source acceptance; this composite is independently reviewable and adds
no runtime/task/resource qualification. The issuer/SDK source lane remains
independently owned and is composed below.
### Original terminal revision issuer producer seam

Issuer `reserve` and `hasReservation` retain thrown control-read failures in the
existing original loan failure holder before rethrowing the same raw cause,
including `undefined`. That holder's explicit presence permanently blocks
reissuance and reservation validation for the application. The existing terminal
notification gates observe this debt even if a consumer catches the reader throw
and returns `true`; cancellation and application end do not erase failure history.

The actual mounted editor exposes one stable
`getAttachmentTerminalRevisionIssuer()` object. Its `reserve(custody, leaseRef)`
method only runs within the original authentic applying loan and binds one opaque
reservation to that real native application/job/dispatch and exact caller lease
reference. The original SDK must independently validate its real private lease
and bind this issuer through the existing original mounted/Writer composition.
A supplied object shape or Boolean callback is not that binding.

`hasReservation(reservation, leaseRef, phase, exactEvent)` reads the actual private
native association, original notification/loan state and custody. It does not take
a second loan, complete the SDK lease or publish an SDK document. Cancellation
withdraws only that native association; refusal/debt/application end invalidate it
without granting cleanup or settlement. No body/history copy or second authority
is introduced.

Only an armed reservation emits `accepted` from the existing dispatcher's private
accepted observer, before public transaction/model/source callbacks, carrying the
SAME accepted event. The original SDK can use that genuine producer seam for one
controlled source publication and then the same `committed` event for completion.
Without a reservation, the existing applying/committed unavailable path remains.
The SDK controlled transition and Main same-entry association are separate source
work and are not implemented or qualified by this native producer alone.

### Original native cohort continuation (source offer; not activated)

`getAttachmentTerminalCohortIssuer()` exposes a stable native producer alongside
(the same) single-application revision issuer. `reserve(custody, reservation,
members)` is available only inside the actual applying loan with its genuine
single reservation. Its passive member tuples contain the exact original
`item`, `jobRef` and SDK `leaseRef`; the roster must match every original capture
job/item in order. The native owner validates private registration, attempt one,
original File-controller custody and current document lifetime. Batch IDs,
cloned observations and copied jobs cannot reserve or join a cohort. The opaque
token binds this one original capture; it does not authenticate SDK leases.

For a later member, `inspectContinuation(token, member)` returns the original
capture, original starting revision and the exact accepted native event objects
recorded after successful committed loans. `join(token, custody, reservation,
leaseRef)` binds that member's own genuine applying reservation, at the current
end of this continuous publication chain. `hasPublication(token, reservation,
leaseRef, phase, exactEvent)` jointly checks the actual private application,
single reservation, exact accepted/committed event and its before/after revision.
An in-flight accepted transaction cannot be read as a completed continuation.
Completed members must still have the same retained original job/dispatch proof;
ordinary settled retirement may remove their File/item bindings. Pending members
must still have their original private File/controller/job/item registrations.
The token does not retain Files after their original owner releases them.

Ordinary native transactions (including selection/history operations), unrelated
attachment publication, document switch, blocked editing, pause, native lifetime
retirement, refused publication and explicit token cancellation revoke the
continuation permanently. Original cancellation is idempotent and clears native
association metadata; it is not SDK cancellation, File cleanup, settlement,
resource zero, recovery qualification or application-ended acknowledgement.
Cleanup/control-read throws retain their original raw cause, including
`undefined`; failed original cleanup must still be retried by its original owner.

The SDK must separately validate every actual same-adapter active/pending lease,
its original started envelope and the exact source/digest revision chain. SDK
scope/retire/cancel and ordinary update entrances (including same-value updates,
which native source cannot observe) must cancel the original token. Ordinary
`isTaskCurrent`, Main anchors and runtime context checks remain strict. This
source offer is not connected to Main or SDK and does not replace the separate
application-ended acknowledgement capability. Runtime, native, security,
privacy, receipt, renderer and session-eviction qualification remain unrun/held.

### Original native application-ended source offer (not activated)

The mounted editor exposes `getAttachmentTerminalApplicationEndIssuer()`.
`reserve(custody, reservation, leaseRef)` only binds a handle inside the original
applying loan with the genuine single-application reservation, the SAME private
native application/capture/item/job and exact caller lease reference. The SDK
must still authenticate that lease and producer through its original adapter.
Cancellation of the single reservation does not erase this original end handle,
its failure history or an already observed native publication.

The original observer invocation and terminal loan increment/decrement real
private depths at their actual entry/finally exit. Only the actual application
finally, after clearing its native application slot and returning publication
depth, records application release. An end observation is produced after that
finally's actual retirement cleanup call. It is independent of content
accepted/committed, provider result, consumer Boolean or the application return
value. `inspect(handle, leaseRef)` only reads that source observation; it cannot
perform cleanup or promote it. `hasEnded(handle, leaseRef, exactObservation)`
authenticates the exact source event and original application association.

Observations distinguish `running`, `cleanup-blocked` and `ended`, expose actual
callback/loan/application release and native cleanup facts, preserve the SAME
historical transaction object, and retain tagged raw failure history (including
`undefined`). An ended observation reports physical completion of this native
scope; it does not declare success or clear original observer/loan/business
failure debt. False admission, cancellation and synchronous callback throws
remain separate facts after their original stacks actually unwind.

The original File cleanup owner retains a cursor over its actual item/batch
abort controllers for this application. Controllers advance only after their
real abort call returns. `retry(handle, leaseRef)` resumes that SAME cursor and
the original retirement sweep after the application/loan/cleanup stack has
released. It never looks up an item ID again after detachment, repeats source
publication, reruns a consumer callback or acts on a new session. Throws and
reentry preserve debt and the same retry handle. The original detach-before-abort
and item-before-batch order remains; successful retired controls are not replayed.
Incomplete original abort cursors remain retained by this File owner and block
session resource inspection/pause/resume rather than yielding an incomplete census.
A body throw and a later finally throw retain both real raw causes separately.

A non-Boolean observer/loan return is unsupported work. If it returns a Promise
or other unknown work, synchronous stack exit cannot prove that work ended;
the handle remains explicitly blocked even after native cleanup. No new settled
wrapper or guessed Promise observation is introduced. Resolving that blocker
requires a genuine original returned-work/cleanup producer capability.

This producer never waits for its own consumer's full-local settled signal:
that can depend on the SDK acknowledgement it is meant to provide. An original
retirement sweep returning does not prove all File/item records, network/provider
work or session resources retired. Census, settlement, recovery and eviction
remain with their actual owners. There is no Main/SDK activation or new end
callback/subscription in this source offer; consume the handle after the original
native stack releases, and keep SDK cancellation/lease/context checks strict.
Runtime/native/security/privacy/receipt/renderer/full qualification remain held.
The offer is based on #954 and has no dependency on the separate unreviewed cohort.

### Isolated original issuer and retry source composition

The isolated composite preserves UI914 `570f2c4f6076c8ab489d100bca29127bf7126d17`
as its session/native/renderer and original atomic retry consumer base, and
UI945 `8130a71b4e30441f67fa6183c5cdfa060db87426` as its exact terminal application,
accepted observer and single native revision issuer implementation. The shared
terminal failure holder retains both inner-loan and issuer control-read debt;
there is one mounted issuer and one original private application/reservation.
Original owner/lifecycle and frozen source controls are inherited unchanged.
This reconciles source overlap; it does not bind or complete the original SDK,
qualify business acknowledgement, run tests/native paths or allow session eviction.
Inherited changesets cover the public surface; this composition adds no new API.

### Observed public source reveal completion (source WIP)

The legacy `revealHeading` and `revealSourceRange` return synchronous target
admission statuses. Their `success` does not acknowledge asynchronous focus or
viewport completion. Existing signatures and behavior are preserved.

`revealSourceRangeAndWait(selection, options): Promise<MarkdownEditorRevealCompletion>`
is the completion-bearing public instance method. `selection` requires raw UTF-16
`start`, `end` and `direction` (`none`, `forward` or `backward`); it is never
collapsed or silently snapped to a different grapheme boundary. Options require
`session` (the exact object returned by this mounted instance's `getSession`),
`expected: { documentIdentity: { id, epoch }, revision }`, a genuine `signal`,
and `assertAdmission: () => void`. The host callback throws when its current
navigation admission no longer holds. `timeoutMs` defaults to 1500 and accepts
integer values from 1 through 5000. A deadline always rejects.

The frozen successful result is exactly `{ status: 'success', editorSessionRef,
documentIdentity, revision, selection, focus: 'textarea',
viewport: 'full-selection-visible' }`. It acknowledges the same mounted owner,
source revision, complete native selection/direction and actual focused textarea,
with every measured selection fragment inside the viewport. Success requires two
fresh native Intersection Observer V2 observations (`trackVisibility: true`,
`isVisible: true`), at least 100ms apart, confirming the entire textarea is
unoccluded. Whole-textarea visibility is deliberately conservative: an obstruction
elsewhere in the input can also prevent completion. Point hit tests, visible-area
percentages, bounding-box corners and frame counts cannot grant success.
Masks and clip paths refuse. Rounded input/overflow clips must contain the whole
input in a guaranteed rectangular interior; otherwise they also refuse. A native
rectangular intersection alone does not prove a curved clip's visible interior.
Native control geometry and clipping must agree with a temporary inert browser
text-layout measurement; this never creates another input owner. Geometry must
remain stable between observations. DOM changes invalidate the pending proof;
only the owner's temporary nonpainting measurement nodes are excluded. Running
or pending document animations postpone confirmation. The final native proof must
postdate the latest synchronous admission check and match the current native
bounds and every selection fragment. No consumer callback runs between that
proof and resolution; the host still rechecks its own admission after await.
The [native visibility algorithm](https://w3c.github.io/IntersectionObserver/#calculate-visibility-algo)
requires a complete unocclusion guarantee and may conservatively refuse.
Engines without genuine V2 support reject as `unsupported`; there is no sampled
or intersection-only fallback.
No source or history entry is written. Positioning is instant, including under
reduced motion. This bounded source-input contract is separate from renderer
presentation or a host navigation/history receipt.

The promise rejects with exported `MarkdownEditorRevealError` and a `reason`:
`aborted`, `admission-rejected`, `stale`, `unavailable`, `unsupported`,
`invalid-selection`, `focus-lost`, `selection-changed`, `superseded`,
`interrupted` or `timeout`. A thrown admission error remains in `cause`. Original owner failures propagate
unchanged and never become success.
Cancellation, pause, unmount, document/epoch/revision/mode drift, composition,
disabled/loading/readonly state, genuine focus loss, a new reveal or manual
wheel/touch/pointer/keyboard input cannot produce a completion. All listeners,
frames, both observers and the failure deadline are released on settlement. After a failure,
selection/scroll effects already made are not rolled back over a newer action.

Preview without the source input, RTL/vertical/transformed or masked/clipped-path geometry, sources over
1,000,000 UTF-16 units, a selection larger than the input viewport, or unavailable
or inconsistent native text measurement reject as `unsupported`. Clipped or
occluded targets never receive a nearby/estimated success. These limitations
are explicit; legacy target admission remains available for existing consumers.
The consumer must still verify its own current navigation admission after await.
This source contract does not qualify full Blog navigation, native IME, screen
reader, Avalonia or independent UX acceptance.
