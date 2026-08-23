# MarkdownEditor Markdown 编辑器

`ElMarkdownEditor` 提供通用 Markdown 编辑外壳：toolbar command registry、受控
`modelValue`、单一 transaction dispatcher、selection/history/IME 状态，以及
source/live/split/preview 模式和保存、提交、上传图片事件。业务项目仍只拥有上传、
保存草稿、发布等业务 glue，不维护第二份 document、selection、command 或 undo
authority。

## 基础用法

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

`modelValue: string` 是唯一公开内容 authority。组件可以在等待 parent
`v-model` 回显时维护同值的 optimistic document 和 revision，但 DOM、HTML、
Markdown AST 与 preview renderer 都不是可写内容源。

Enter/Delete/Tab、智能配对、clipboard 与 beforeinput/composition 共用同一个
transaction dispatcher。source/live/split 对相同输入必须产生相同 raw source
transaction。输入合同与验收入口见
[Markdown editor input](../api/markdown-editor-input.md)。

文档嵌入语法由唯一 `::embed[target="..." mode="article|heading|block"]`
block directive 进入 projection，不推断 mode，不把 target 解释为路径或权限。
Grammar 与 mutation fixture 见
[Markdown runtime projection](../api/markdown-runtime-projection.md)。

## Transaction contract

公共 transaction 使用升序、互不重叠的 UTF-16 code-unit ranges，与 browser
`HTMLTextAreaElement.selectionStart/selectionEnd` 单位一致：

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

Change range 不得越界、重叠、降序或切开 UTF-16 surrogate pair。恢复 selection
时，组件以 grapheme boundary 校正 combining sequence 与 ZWJ emoji，并保留
backward direction；Latin、CJK、emoji、RTL 与 multiline selection 使用同一
合同。`metadata` 只随只读事件传播，不参与 change validation、revision 或
history 决策。

每次已接受的内容 transaction 增加 revision。需要完成 placeholder、上传或其他
异步替换时，调用方必须保存前一个 dispatch result 的 `revision`，并通过
`expectedRevision` 提交 replacement。revision 已变化时 dispatcher 返回
`accepted: false` 与 `reason: 'stale-revision'`，不会猜测 rebase、重放到当前
cursor 或产生半替换。

## Public methods

组件 ref 只公开以下编辑入口；它们都进入同一个 dispatcher：

```ts
const result = editor.value?.dispatchTransaction(transaction)
editor.value?.undo()
editor.value?.redo()

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

- `dispatchTransaction(transaction)`：验证并应用 changes、revision、selection 与
  history，返回 `MarkdownEditorDispatchResult`。
- `undo()` / `redo()`：应用保存的 changes/inverse changes，不调用 browser native
  snapshot undo。
- `insertMarkdownAtCursor(markdown, options?)`：保留原有 boolean 返回合同；内部仍只
  调用同一个 dispatcher。`options` 可传 `selection`、`expectedRevision` 和只读
  `metadata`；需要 revision/result 的新代码直接调用 `dispatchTransaction()`。

组件不公开 textarea ref、内部 store、DOM/HTML state 或第三方 editor 类型。
`applyMarkdownEditorCommand` 与 `defaultMarkdownEditorCommands` 仍是可复用的纯
command transform；`applyMarkdownEditorCommand` 仅用于同步旧调用迁移。新代码通过
`runMarkdownEditorCommand` 使用稳定 command context，并把 result 交给 dispatcher。

## Chrome variants

`chrome` 只控制编辑器外围区域，不改变 mode、Markdown source、selection、history、
transaction、renderer、事件或 editor identity：

| Chrome | 使用场景 | Toolbar 与 status | 根表面 |
| --- | --- | --- | --- |
| `framed` | 表单、设置和独立编辑器 | 默认显示 | 完整公共 token frame |
| `embedded` | 已有 document/task surface | 保留，避免丢失 command 与状态 | 不重复根边框、圆角或 material |
| `minimal` | consumer 自行组合 command/status | 不渲染空 toolbar/footer | 仅内容表面与必要语义 |

三个 chrome 变体共享同一语义区域结构，并适用于全部公共 mode。隐藏外围区域不得留下
空 separator、不可达控件或保留高度；`embedded` 与 `minimal` 的 focus-visible
由活动区域提供。切换 chrome 不应重建 editor、丢失 selection/history 或改变
scroll-container identity。

Toolbar/command surface 与 status surface 由各自的默认内容或对应 slot 提供：有 slot
时 slot 替换该区域的默认内容，而不是创建第二个 region。`framed` 默认呈现两者；
`embedded` 仅在该区域有默认内容或 slot 时呈现；`minimal` 默认不呈现两者，只有调用方
提供相应 slot 时才呈现。body 始终是当前 mode 的唯一内容 region；`live` 不额外创建
preview region，`split` 才同时呈现编辑 pane 和 renderer pane，`preview` 则只呈现
renderer surface。

| Mode | 编辑表面 | 渲染表面 | 可修改 |
| --- | --- | --- | --- |
| `source` | 精确源码 | 无 | 是 |
| `live` | 同一渐进渲染编辑表面 | 内嵌于编辑表面 | 是 |
| `split` | 编辑 pane | renderer pane | 是 |
| `preview` | 无 | renderer surface | 否 |

`live` 不是 source textarea 上覆盖第二个 preview chrome。`split` 的 separator
只表达真实 pane 边界；`preview` 即使没有编辑表面，仍保留可访问名称和
loading/error/capability 状态。Live 只有一个 `source-textarea` 作为
input/selection/IME owner；projection decoration 锚定 `syn:` node range，不可编辑，
也不把 HTML 写回 source。Mode 切换不重建 textarea、history 或 document identity。公共 mode 只有 `source` / `live` / `split` /
`preview`，没有 `write` 别名；源码模式的可见文案是「源码」。

Live capability 只使用六个冻结 token：`supported`、`unsupported-platform`、
`runtime-unavailable`、`projection-failed`、`feature-degraded`、`fatal`。
结果必须绑定 document identity、epoch 与 source revision；same-source
different-document 不得复用。unknown token、数字码、`write`/`ok` 别名和
`readonly`/`disabled` 映射都 fail closed。`resolveMarkdownLiveCapability` 与
`readMarkdownLiveCapability` 是唯一入口，不能从 DOM、class 或 error string
猜测状态。

## Command registry

所有 command surface 消费同一 `MarkdownEditorCommand` registry。Command 使用稳定
`key`、`label`、`group`、受控 icon token、shortcut 和 presentation targets；
`when(context)` 决定是否呈现，`enabled(context)` 决定是否可执行。Shortcut 冲突
必须显式失败，不能由数组顺序决定。

Command context 只公开 document identity、revision、selection、mode、read-only
状态、syntax projection、position map、abort signal 与 transaction dispatcher。
Command 不得解析 Markdown、查询 rendered DOM、访问 textarea/editor instance，或
保存裸 selection offset 自行猜测 rebase。Syntax/node/range 事实由 editor
projection 提供；内容修改通过 transaction dispatcher 完成。

`run(context)` 可以同步或异步返回受控 transaction result。异步 command 的结果在
document epoch 变化、abort 或 anchor 删除后不得提交；consumer 负责以自己的反馈
组件展示错误，command 本身不调用 toast。Toolbar、keyboard、palette、slash 和
selection presentation 共享同一 key、可用状态与 pending/result authority。

## History and grouping

History entry 保存 forward changes 与 inverse changes，不保存每键整文 snapshot。
预算固定为：

- 最多 100 个 undo entries；
- undo/redo retained inserted + deleted UTF-16 units 合计不超过
  1,000,000；
- 超限时按 oldest-first 淘汰。

相邻、同方向的普通 input，在 1000ms 内且 selection 未人为移动时可以合并为一个
undo unit。Command、paste、drop、programmatic、composition complete 与 async
replacement 始终是独立 unit。Blur、selection move、mode/disabled/loading
切换和 external reset 终止 merge group。新本地 mutation 或 external reset
清空 redo。

## Composition and controlled reset

`compositionstart` 后，toolbar command、Tab/Shift+Tab、Enter structure
continuation、programmatic mutation 与 selection restore fail closed。
Composition 中间 `input` 不创建 history；`compositionend` 把最终值提交为一个
`history: 'separate'` transaction。自动化 composition events 只证明组件状态机；
真实简中、繁中、日文、韩文 OS IME 仍需要具备对应输入法的人工或设备证据。

Parent prop 回显若等于当前 optimistic value，只确认现有 revision，不新增
transaction/history。任何不同的 prop value 都是 external hard reset：替换内容、
clamp grapheme-safe selection、增加 revision，并清空 undo/redo。旧文档的 undo
不能作用到新 external value。只有这个 prop watcher 拥有 silent reset authority；
公开 `dispatchTransaction({ origin: 'external', history: 'skip' })` 仍是受控内容修改，
必须 emit `update:modelValue` / `change`，并与其他公开 mutation 一样在 composition
期间 fail closed。Active composition 被 prop reset 失效后，迟到的
`compositionend` / `input` 只恢复当前受控值，不得提交 reset 前的 IME DOM 文本。
失效窗口是有界的；若 browser 没有发送 `compositionend`，窗口结束后的普通
non-composition input 可继续编辑。窗口外仍会拒绝 `isComposing` 或
`insertCompositionText` 标记的孤立旧 payload；迟到 `compositionend` 后的即时
commit 也不会越过当前受控值。

## Events

| 事件名             | 说明                                                         |
| ------------------ | ------------------------------------------------------------ |
| update:modelValue  | 已接受的公开内容更新                                         |
| change             | 与 `update:modelValue` 相同的公开内容更新                    |
| transaction        | 每次 accepted/rejected dispatch 的只读 result 与 transaction |
| selection-change   | revision 与 grapheme-safe、direction-preserving selection    |
| history-change     | `canUndo/canRedo`、depth 与 retained UTF-16 units            |
| command            | toolbar command 已通过 dispatcher 执行                       |
| mode-change        | 编辑模式切换                                                 |
| save               | 保存事件                                                     |
| submit             | 提交事件                                                     |
| upload-image       | 上传图片事件                                                 |
| render-complete    | preview renderer 完成                                        |
| render-error       | preview renderer 失败                                        |
| features-activated | preview feature activation 完成                              |

## Attributes

| 属性名            | 说明                                        | 类型                                      | 默认值   |
| ----------------- | ------------------------------------------- | ----------------------------------------- | -------- |
| model-value       | 唯一公开 Markdown 内容 authority            | `string`                                  | `''`     |
| default-mode      | 初始编辑模式                                | `'source' \| 'live' \| 'split' \| 'preview'` | `source` |
| mode              | 受控编辑模式                                | `'source' \| 'live' \| 'split' \| 'preview'` | — |
| chrome            | 外围区域与根表面变体                        | `'framed' \| 'embedded' \| 'minimal'`     | `framed` |
| placeholder       | 文本域占位文本                              | `string`                                  | `''`     |
| commands          | toolbar command model                       | `MarkdownEditorCommand[]`                 | 内置命令 |
| disabled          | 禁用输入与全部 mutation method              | `boolean`                                 | `false`  |
| loading           | 标记 busy 并冻结输入与全部 mutation method  | `boolean`                                 | `false`  |
| preview-base-url  | preview renderer 的基础 URL                 | `string \| null`                          | `null`   |
| preview-csp-nonce | preview renderer 的 CSP nonce               | `string \| null`                          | `null`   |
| preview-features  | preview renderer 的 feature activation 开关 | `MarkdownFeatureActivationFeatureOptions` | —        |
| min-rows          | 编辑区最小行数                              | `number`                                  | `12`     |

## Migration

旧代码可继续把 `insertMarkdownAtCursor()` 当作 boolean，并可继续省略 selection
的 `direction`；省略时 dispatcher 归一化为 `none`，所有 result/event 则始终返回
显式 direction。需要异步 replacement 的新代码应改用 `dispatchTransaction()`，
保存其 `revision` 并在后续 transaction 传入 `expectedRevision`。不要增加第二个
dispatcher、consumer undo cache 或 private textarea escape。

MarkdownEditor 在 Avalonia baseline 中分类为 `native-adapter`：公开 transaction、
revision、history 与 selection direction 语义保持一致；Avalonia 使用 native text
control 与 selection API，不暴露 Web DOM。平台分类见
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
