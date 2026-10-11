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
revision, and projection. On success, the component mounts the live virtual window containing
the target, restores source selection, focuses the sole textarea input owner, and scrolls the
target into view. A stale, deleted, unsupported, or missing target does not move selection,
focus, scroll, or history.

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
