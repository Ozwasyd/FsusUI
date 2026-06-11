# Tag 标签

用于标记和选择。

## Public Preview Notes

| 字段                   | 说明                                                                       |
| ---------------------- | -------------------------------------------------------------------------- |
| purpose                | 标记状态、分类、筛选摘要或轻量对象标签。                                   |
| basic usage            | 使用 `type`、`effect`、`size`、`closable` 和 `round` 表达不同标签状态。    |
| props / events / slots | 本页 `Tag API` 和 `CheckTag API` 覆盖公开 props、events 和 slots。         |
| accessibility          | 可关闭标签应让关闭按钮有明确上下文；可选中标签不能只依赖颜色表达选中状态。 |
| theme token notes      | 跟随公开主色、文本色、边框色、圆角和 motion control token。                |
| known limitations      | Tag 不是表单控件；需要提交值时应与 Checkbox、Select 或业务状态同步。       |
| stability level        | Preview public component。                                                 |

> 💡 **运行示例**：启动 demo-app（`pnpm dev`，端口 5173）查看交互效果。

---

## 基础用法

使用 `type` 属性定义标签类型，`color` 属性设置背景色。

## 可移除标签

设置 `closable` 为 `true`，标签右侧显示关闭图标，点击后触发 `close` 事件；设置 `disable-transitions` 禁用动画。

## 动态编辑

通过监听 `close` 事件动态添加/删除标签。

## 不同尺寸

通过 `size` 属性设置标签大小：`large`、`default`、`small`。

## 主题

通过 `effect` 属性切换主题：`light`（默认）、`dark`、`plain`。

## 圆角

设置 `round` 属性使标签变为圆形。

## 可选中标签（CheckTag）

适合需要多选标签的场景，使用 `el-check-tag`，通过 `v-model:checked` 绑定选中状态。

---

## Tag API

### Tag Attributes

| 属性名              | 说明           | 类型                                                        | 默认值    |
| ------------------- | -------------- | ----------------------------------------------------------- | --------- |
| type                | 类型           | `'primary' \| 'success' \| 'info' \| 'warning' \| 'danger'` | `primary` |
| closable            | 是否可关闭     | `boolean`                                                   | `false`   |
| disable-transitions | 是否禁用动画   | `boolean`                                                   | `false`   |
| hit                 | 是否有高亮边框 | `boolean`                                                   | `false`   |
| color               | 背景色         | `string`                                                    | —         |
| size                | 尺寸           | `'large' \| 'default' \| 'small'`                           | —         |
| effect              | 主题           | `'dark' \| 'light' \| 'plain'`                              | `light`   |
| round               | 是否圆角       | `boolean`                                                   | `false`   |

### Tag Events

| 事件名 | 说明               | 回调参数                    |
| ------ | ------------------ | --------------------------- |
| click  | 点击标签时触发     | `(evt: MouseEvent) => void` |
| close  | 点击关闭按钮时触发 | `(evt: MouseEvent) => void` |

### Tag Slots

| 插槽名  | 说明       |
| ------- | ---------- |
| default | 自定义内容 |

---

## CheckTag API

### CheckTag Attributes

| 属性名                    | 说明     | 类型                                                        | 默认值    |
| ------------------------- | -------- | ----------------------------------------------------------- | --------- |
| checked / v-model:checked | 是否选中 | `boolean`                                                   | `false`   |
| disabled                  | 是否禁用 | `boolean`                                                   | `false`   |
| type                      | 类型     | `'primary' \| 'success' \| 'info' \| 'warning' \| 'danger'` | `primary` |

### CheckTag Events

| 事件名 | 说明               | 回调参数                   |
| ------ | ------------------ | -------------------------- |
| change | 选中状态改变时触发 | `(value: boolean) => void` |

### CheckTag Slots

| 插槽名  | 说明       |
| ------- | ---------- |
| default | 自定义内容 |
