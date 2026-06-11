# Drawer 抽屉

从侧边滑出的临时面板，与 Dialog 的 API 基本一致，但提供不同的用户体验。

## Public Preview Notes

| 字段                   | 说明                                                                                             |
| ---------------------- | ------------------------------------------------------------------------------------------------ |
| purpose                | 从视口边缘打开临时上下文，适用于详情、筛选、设置和辅助编辑。                                     |
| basic usage            | 使用 `v-model` 控制显示，`direction` 决定方向，`size` 控制宽高，`footer` slot 放置操作。         |
| props / events / slots | 本页 `API` 覆盖公开 props、events、slots 和 exposes。                                            |
| accessibility          | 默认保留标题区域；隐藏标题时应通过业务内容提供等价名称；可调整大小时不要让关键控件离开可视区域。 |
| theme token notes      | 跟随公开 surface、文本、边框、阴影、圆角、backdrop blur 和 panel/overlay motion token。          |
| known limitations      | 内容懒渲染，依赖 DOM 的逻辑应在 `open` / `opened` 后执行；嵌套 Drawer 需要单独验证滚动锁定。     |
| stability level        | Preview public component。                                                                       |

> 💡 **运行示例**：启动 demo-app（`pnpm dev`，端口 5173）查看交互效果。

---

## 基础用法

通过 `v-model` 控制显示，`direction` 设置滑出方向，`size` 设置宽度/高度（默认 30%）。

## 无标题

设置 `with-header="false"` 移除标题区域。

## 可调整大小

设置 `resizable="true"` 开启边缘拖拽调整大小。

## 嵌套抽屉

嵌套使用时，内层抽屉必须设置 `append-to-body="true"`。

## 销毁内容

设置 `destroy-on-close` 在关闭时销毁子组件，每次打开都会触发 `mounted` 生命周期。

> **提示**：Drawer 内容默认懒渲染，DOM 操作应通过 `ref` 或在 `open` 事件后进行。

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
