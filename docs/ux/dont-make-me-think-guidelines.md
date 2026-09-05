# Don’t Make Me Think UX Guidelines

> **Role:** Normative UX composition guidance
> **Applies to:** FsusUI task, page, action, empty-state, loading, and
> dangerous-operation compositions
> **Authority:** Complements the detailed [task-oriented component contract](./task-oriented-components.md); it does not define business workflows.

Every surface should let a user scan and answer: where am I, what is here, and
what should I do next? Do not use explanatory prose to compensate for unclear
component semantics.

The contract keeps its searchable labels: “用户不会阅读” (users do not read),
“我在哪” (where am I), “下一步” (next step), “按钮必须说出结果” (buttons state
the result), “高级选项” (advanced options), “危险操作” (dangerous operation),
“空状态” (empty state), “列表” (list), and “推荐动作” (recommended action).

## Scan-first layout

- Use one `h1` (or equivalent page title) to identify the current location.
- Use a short description or task introduction for the object, scope, and
  current state.
- Use one result-oriented primary action; lower-priority actions remain visibly
  secondary.
- Keep advanced options collapsed by default, but make the entry discoverable
  and explain its effect.

## Button labels

Labels must state the result rather than a generic confirmation. Unless a
documented code exception supplies context, do not use:

```text
确定
提交
确认
OK
Submit
Confirm
```

Prefer result-oriented labels such as:

```text
保存草稿
发布文章
更新设置
关闭会话
提交工单
通过评论
拒绝评论
恢复文章
永久删除
```

If a generic label is unavoidable, declare the exception and its context in
code, for example `data-ux-allow-generic-label` with
`data-ux-label-context`.

## Dangerous operations

Deletion, rejection, hiding, closing, and permanent deletion must state:

- whether confirmation is required and whether undo is available;
- whether the result is recoverable (permanent actions must say when it is not);
- whether users are notified;
- whether an audit record is written; and
- which objects are affected.

```text
永久删除
此操作不可恢复，会删除正文、评论关联和资产引用，并写入审计日志。
```

```text
关闭会话
关闭后用户仍可查看历史记录，但不能继续回复。
```

## Empty, filtered, and recommended states

- An empty state must explain why it is empty and what the user can do next. If
  there is no action, state why.
- A filtered list or table must show the active filter summary and provide a
  clear action unless no filter can be cleared. An empty filtered result must
  name the active conditions so it is not mistaken for a complete empty list.

```text
当前显示：状态=待审核，地区=中国大陆，关键词=spam，共 12 条结果
```

- A recommendation (for moderation, risk, inspection, or diagnosis) must state
  the recommendation, its reason or evidence, confidence when available, and
  whether the user may override it.

## Loading and asynchronous state

Loading longer than 300ms must show a skeleton or explicit status text; a long
blank region is not acceptable. Asynchronous save, publish, review, and
migration actions must expose pending, success, and failure states.
