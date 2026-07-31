# MarkdownEditor Markdown 编辑器

`ElMarkdownEditor` 提供通用 Markdown 编辑外壳：toolbar command model、受控
`modelValue`、单一 transaction dispatcher、selection/history/IME 状态，以及
write/split/preview 模式和保存、提交、上传图片事件。业务项目仍只拥有上传、保存
草稿、发布等业务 glue，不维护第二份 document、selection 或 undo authority。

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
command transform；在组件内，transform 结果必须交给 dispatcher 执行。

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
| default-mode      | 初始编辑模式                                | `'write' \| 'split' \| 'preview'`         | `write`  |
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
