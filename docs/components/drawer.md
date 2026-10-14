# Drawer

A temporary panel that slides from an edge. Its API is largely shared with Dialog, but the interaction differs.

## Public Preview

This is a preview public component. See [API stability](../api-stability.md#stability-levels)
for the change policy. Keep a readable heading, or provide an equivalent name
when the title is hidden; resizable drawers must keep critical controls inside
the viewport. Lazy content requires DOM-dependent work after `open` or
`opened`, and nested drawers need an explicit scroll-lock check. Directional
insets and overlay geometry follow the shared [viewport and safe-area contract](../theme/tokens.md#viewport-and-safe-area-contract).

> See the [Playground](../playground.md) for runnable component examples.

---

## Basic Usage

Use `v-model` to control visibility, `direction` for the slide edge, and `size` for width or height (30% by default).

## Viewport / safe-area

Drawer background reaches the viewport edge; safe-area insets apply to content
padding without moving that edge:

- `ltr`: top / bottom / left
- `rtl`: top / bottom / right
- `ttb`: top / left / right
- `btt`: bottom / left / right

The absolutely positioned close button does not move with header padding, so it
also consumes the top inset and the right inset on `rtl`, `ttb`, and `btt`
panels through `fsus-inset-safe-area`.

The overlay scrim still covers the full viewport. Do not patch Drawer geometry
from a consumer; use the shared [viewport and safe-area contract](../theme/tokens.md#viewport-and-safe-area-contract).

`size` still specifies the panel width or height, including CSS expressions such
as `min(86vw, 22rem)`. The edge-attached background is distinct from the safe
content rectangle. During the opening animation the panel is moving; perform
settled geometry measurements after `opened`, rather than treating `open` as
the final layout. Closing immediately marks the panel `inert` and `aria-hidden`
while its existing leave animation finishes. Retained content becomes
interactive again on reopening; `destroy-on-close` still controls destruction.

The `pnpm audit:visual-boundaries` matrix covers all four Drawer directions.
It verifies the viewport-safe CSS contract, not a physical Safari toolbar.

## Without a Title

Set `with-header="false"` to remove the heading region.

## Resizable

Set `resizable="true"` to enable edge dragging for resize.

## Nested Drawers

When drawers are nested, the inner drawer must set `append-to-body="true"`.

## Destroy Content

Set `destroy-on-close` to destroy child content on close; each opening then runs the `mounted` lifecycle.

> **Tip:** Drawer content is lazy-rendered by default. Perform DOM work through a `ref` or after the `open` event.

---

## API

### Attributes

| 属性名                | 说明                                                               | 类型                                         | 默认值  |
| --------------------- | ------------------------------------------------------------------ | -------------------------------------------- | ------- |
| model-value / v-model | 是否显示                                                           | `boolean`                                    | `false` |
| title                 | 标题（也可通过 `#header` 插槽设置）                                | `string`                                     | —       |
| direction             | 打开方向（`rtl`：右→左，`ltr`：左→右，`ttb`：上→下，`btt`：下→上） | `'rtl' \| 'ltr' \| 'ttb' \| 'btt'`           | `rtl`   |
| size                  | 宽度（水平）或高度（垂直），数字为 px，字符串支持 `x%`             | `number \| string`                           | `30%`   |
| with-header           | 是否显示头部区域                                                   | `boolean`                                    | `true`  |
| show-close            | 是否显示关闭按钮                                                   | `boolean`                                    | `true`  |
| before-close          | 关闭前的钩子，调用 `done()` 完成关闭                               | `(done: (cancel?: boolean) => void) => void` | —       |
| modal                 | 是否显示遮罩                                                       | `boolean`                                    | `true`  |
| close-on-click-modal  | 点击遮罩是否关闭                                                   | `boolean`                                    | `true`  |
| close-on-press-escape | 按 ESC 是否关闭                                                    | `boolean`                                    | `true`  |
| append-to-body        | 是否挂载到 body（嵌套时必须为 true）                               | `boolean`                                    | `false` |
| lock-scroll           | 显示时是否禁止 body 滚动                                           | `boolean`                                    | `true`  |
| destroy-on-close      | 关闭时是否销毁子内容                                               | `boolean`                                    | `false` |
| resizable             | 是否支持拖拽调整大小                                               | `boolean`                                    | `false` |
| z-index               | 层级                                                               | `number`                                     | —       |
| header-class          | 头部自定义 class                                                   | `string`                                     | —       |
| body-class            | 主体自定义 class                                                   | `string`                                     | —       |
| footer-class          | 底部自定义 class                                                   | `string`                                     | —       |

### Events

| 事件名       | 说明               | 回调参数                                  |
| ------------ | ------------------ | ----------------------------------------- |
| open         | 打开动画开始前触发 | `() => void`                              |
| opened       | 打开动画结束后触发 | `() => void`                              |
| close        | 关闭动画开始前触发 | `() => void`                              |
| closed       | 关闭动画结束后触发 | `() => void`                              |
| resize-start | 开始调整大小时触发 | `(evt: MouseEvent, size: number) => void` |
| resize       | 调整大小过程中触发 | `(evt: MouseEvent, size: number) => void` |
| resize-end   | 调整大小结束时触发 | `(evt: MouseEvent, size: number) => void` |

### Slots

| 插槽名  | 说明           |
| ------- | -------------- |
| default | 抽屉主体内容   |
| header  | 自定义头部区域 |
| footer  | 抽屉底部区域   |

### Exposes

| 名称        | 说明                                   |
| ----------- | -------------------------------------- |
| handleClose | 触发关闭（会经过 `before-close` 钩子） |
