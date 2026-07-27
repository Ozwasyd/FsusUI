# Dialog 对话框

在保留当前页面状态的情况下，告知用户并承载相关操作。

## Public Preview Notes

| 字段                   | 说明                                                                                          |
| ---------------------- | --------------------------------------------------------------------------------------------- |
| purpose                | 承载需要用户短期聚焦处理的确认、编辑、检查或说明任务。                                        |
| basic usage            | 使用 `v-model` 控制显示，`title` 或 `header` slot 提供标题，`footer` slot 放置主次操作。      |
| props / events / slots | 本页 `API` 覆盖公开 props、events、slots 和 exposes。                                         |
| accessibility          | 必须提供可读标题；自定义 `header` 时保留 `titleId`；避免在 Dialog 内打开无必要的嵌套 Dialog。 |
| theme token notes      | 跟随公开 surface、文本、边框、阴影、圆角、backdrop blur 和 panel/overlay motion token；交互几何消费 `#260` canonical viewport/safe-area 变量与统一 SCSS helper（见 `docs/theme/tokens.md`）。 |
| known limitations      | Teleport 内容不继承 SFC scoped 样式；嵌套 Dialog 必须显式处理 `append-to-body` 和焦点顺序。   |
| stability level        | Preview public component。                                                                    |

> 💡 **运行示例**：启动 demo-app（`pnpm dev`，端口 5173）查看交互效果。

---

## 基础用法

通过 `v-model` 绑定一个布尔值控制对话框显示，`title` 设置标题，`footer` 具名插槽放置操作按钮。

## 自定义内容

对话框内容可以是任何组件，例如表格、表单等。

## 自定义头部

使用 `header` 插槽自定义标题区域（插槽 scope 包含 `titleId`，用于无障碍访问）。

## 嵌套对话框

嵌套使用时，内层对话框必须设置 `append-to-body="true"`。

## 可拖拽

设置 `draggable` 允许拖动对话框；`overflow` 允许超出视口范围拖动。

## 全屏

设置 `fullscreen` 为 `true` 打开全屏对话框。

## Viewport / safe-area

- 遮罩（scrim）始终 `position: fixed; inset: 0`，不会被 safe-area 缩小。
- `.el-overlay-dialog` 通过统一 helper 提供四方向安全间距、滚动与居中；非全屏 Dialog 的 `max-block-size` 由 `--fsus-viewport-block-size` 与上下 safe-area/基础间距共同计算。
- 全屏表面可铺满 viewport，但 header/body/footer 交互内容避开安全区。
- 不要在 consumer 中用 `:deep(.el-overlay-dialog)` 等方式重写几何。

## 销毁内容

设置 `destroy-on-close` 在关闭时销毁默认插槽内容，有助于性能优化。

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

## 常见问题

**SFC 中的 scoped 样式不生效？**

因为 Dialog 使用了 Teleport 挂载，建议将样式写在全局 CSS 中，而非 scoped。

**显示/隐藏时页面元素偏移？**

建议将滚动区域包裹在 Vue 挂载节点（如 `<div id="app" />`）内，并为 body 设置 `overflow: hidden`。
