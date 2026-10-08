# Dialog

Informs the user and hosts related actions while preserving the current page state.

## Public Preview

This is a preview public component. See [API stability](../api-stability.md#stability-levels)
for the change policy. Provide a readable title; custom `header` content must
preserve `titleId`. Teleported content does not inherit SFC-scoped styles, and
nested dialogs must explicitly manage `append-to-body` and focus order. Dialog
uses the shared [viewport and safe-area contract](../theme/tokens.md#viewport-and-safe-area-contract);
consumers must not override its internal geometry.

> See the [Playground](../playground.md) for runnable component examples.

---

## Basic Usage

Bind a Boolean with `v-model` to control visibility, set the title with `title`, and place action buttons in the named `footer` slot.

## Custom Content

Dialog content can be any component, such as a table or form.

## Custom Header

Customize the heading region with the `header` slot; its slot scope includes `titleId` for accessible labeling.

## Nested Dialogs

When dialogs are nested, the inner dialog must set `append-to-body="true"`.

## Focus restoration

Dialog delegates focus entry, trapping, and restoration to the shared focus
trap. Closing returns focus to the connected opener, including pointer
activation that does not focus a button. Escape and external `v-model` closure
use the same owner. Closing a nested dialog restores its opener in the parent;
a paused parent must not take focus from a dialog above it. Consumers must not
add a second focus-restoration handler.
The opener is captured when an opening is requested, including `open-delay`,
first mounting through `v-if`, and focusable triggers with `tabindex="-1"`.
Cancelling `v-model` before an opening delay expires keeps the dialog closed.

## Draggable

Set `draggable` to allow dragging; `overflow` allows the dialog to move beyond the viewport.

## Fullscreen

Set `fullscreen` to `true` to open a full-screen dialog.

## Viewport / safe-area

Dialog follows the shared [viewport and safe-area contract](../theme/tokens.md#viewport-and-safe-area-contract):
the scrim stays `position: fixed; inset: 0`, while the panel uses four-way
insets, scrolling, centering, and `--fsus-viewport-block-size`. Full-screen
surfaces may fill the viewport, but header/body/footer controls remain inside
the safe area. Do not override `.el-overlay-dialog` through `:deep()` or a
product class. The `pnpm audit:visual-boundaries` matrix covers Chromium/WebKit
with #260 variable overrides; real Safari UI still needs release evidence.

## Destroy Content

Set `destroy-on-close` to destroy default-slot content on close, which can improve performance.

---

## API

### Attributes

| 属性名                | 说明                                  | 类型                         | 默认值        |
| --------------------- | ------------------------------------- | ---------------------------- | ------------- |
| model-value / v-model | 是否显示对话框                        | `boolean`                    | `false`       |
| title                 | 对话框标题                            | `string`                     | `''`          |
| width                 | 宽度                                  | `string \| number`           | `''`          |
| fullscreen            | 是否全屏                              | `boolean`                    | `false`       |
| top                   | 距离顶部的距离（margin-top）          | `string`                     | `''`          |
| modal                 | 是否显示遮罩                          | `boolean`                    | `true`        |
| append-to-body        | 是否挂载到 body（嵌套时必须为 true）  | `boolean`                    | `false`       |
| lock-scroll           | 显示时是否禁止 body 滚动              | `boolean`                    | `true`        |
| open-delay            | 打开延迟（ms）                        | `number`                     | `0`           |
| close-delay           | 关闭延迟（ms）                        | `number`                     | `0`           |
| close-on-click-modal  | 点击遮罩是否关闭                      | `boolean`                    | `true`        |
| close-on-press-escape | 按 ESC 是否关闭                       | `boolean`                    | `true`        |
| show-close            | 是否显示关闭按钮                      | `boolean`                    | `true`        |
| before-close          | 关闭前的回调，调用 `done` 关闭对话框  | `(done: () => void) => void` | —             |
| draggable             | 是否可拖拽                            | `boolean`                    | `false`       |
| overflow              | 拖拽时是否允许超出视口                | `boolean`                    | `false`       |
| center                | 头部和底部是否居中                    | `boolean`                    | `false`       |
| align-center          | 对话框是否垂直水平居中                | `boolean`                    | `false`       |
| destroy-on-close      | 关闭时是否销毁内容                    | `boolean`                    | `false`       |
| z-index               | 层级（同 CSS z-index）                | `number`                     | —             |
| transition            | 自定义动画（过渡名称或 Vue 过渡配置） | `string \| TransitionProps`  | `dialog-fade` |

### Slots

| 插槽名  | 说明                               |
| ------- | ---------------------------------- |
| default | 对话框主体内容                     |
| header  | 自定义头部区域（可访问 `titleId`） |
| footer  | 对话框底部操作区                   |

### Events

| 事件名 | 说明               | 回调参数     |
| ------ | ------------------ | ------------ |
| open   | 对话框打开时触发   | `() => void` |
| opened | 打开动画结束时触发 | `() => void` |
| close  | 对话框关闭时触发   | `() => void` |
| closed | 关闭动画结束时触发 | `() => void` |

### Exposes

| 名称          | 说明           | 类型         |
| ------------- | -------------- | ------------ |
| resetPosition | 重置拖拽位置   | `() => void` |
| handleClose   | 手动关闭对话框 | `() => void` |

---

## Frequently Asked Questions

**Why do scoped styles not work in an SFC?**

Dialog mounts through Teleport, so put these styles in global CSS rather than a scoped block.

**Why do page elements shift when the dialog opens or closes?**

Wrap the scroll region in the Vue mount node (such as `<div id="app" />`) and set `overflow: hidden` on `body`.
