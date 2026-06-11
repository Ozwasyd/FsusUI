# Tabs 标签页

将数据内容分割成相关联的不同类别，每次只展示一类。

## Public Preview Notes

| 字段                   | 说明                                                                                  |
| ---------------------- | ------------------------------------------------------------------------------------- |
| purpose                | 在同一页面内切换并列内容区域，适合设置面板、信息分组和数据视图切换。                  |
| basic usage            | 使用 `v-model` 绑定当前 pane 的 `name`，通过 `el-tab-pane` 声明每个标签页。           |
| props / events / slots | 本页 `Tabs API` 和 `Tab-pane API` 覆盖公开 props、events、slots 和 exposes。          |
| accessibility          | 每个 tab label 应能独立说明内容；可关闭或可新增标签需要提供明确文本或可访问图标名称。 |
| theme token notes      | 跟随公开主色、边框、文本、背景、圆角和 motion control token。                         |
| known limitations      | 动态增删标签时，调用方需要维护当前激活项，避免删除当前项后焦点丢失。                  |
| stability level        | Preview public component。                                                            |

> 💡 **运行示例**：启动 demo-app（`pnpm dev`，端口 5173）查看交互效果。

---

## 基础用法

`v-model` 绑定当前激活 Tab 的 `name`，默认选中第一个标签页。

## 卡片风格

设置 `type="card"` 使用卡片样式。

## 带边框卡片

设置 `type="border-card"` 使用带边框的卡片样式。

## 位置

通过 `tab-position` 设置标签位置：`top`（默认）、`bottom`、`left`、`right`。

## 可新增和关闭

设置 `editable` 或同时设置 `addable` + `closable`（仅卡片类型支持），实现动态增删标签页。

---

## Tabs API

### Tabs Attributes

| 属性名                | 说明                                                  | 类型                                                        | 默认值       |
| --------------------- | ----------------------------------------------------- | ----------------------------------------------------------- | ------------ |
| model-value / v-model | 绑定值（当前激活标签的 name）                         | `string \| number`                                          | —            |
| type                  | 标签类型                                              | `'' \| 'card' \| 'border-card'`                             | `''`         |
| closable              | 标签是否可关闭                                        | `boolean`                                                   | `false`      |
| addable               | 标签是否可新增                                        | `boolean`                                                   | `false`      |
| editable              | 是否同时支持新增和关闭                                | `boolean`                                                   | `false`      |
| tab-position          | 标签位置                                              | `'top' \| 'right' \| 'bottom' \| 'left'`                    | `top`        |
| stretch               | 标签宽度是否自动撑开容器                              | `boolean`                                                   | `false`      |
| before-leave          | 切换前的钩子，返回 false 或 rejected Promise 阻止切换 | `(activeName, oldActiveName) => Awaitable<void \| boolean>` | `() => true` |

### Tabs Events

| 事件名     | 说明                     | 回调参数                                        |
| ---------- | ------------------------ | ----------------------------------------------- |
| tab-click  | 点击标签时触发           | `(pane: TabsPaneContext, ev: Event) => void`    |
| tab-change | 当前激活标签改变时触发   | `(name: TabPaneName) => void`                   |
| tab-remove | 点击关闭按钮时触发       | `(name: TabPaneName) => void`                   |
| tab-add    | 点击新增按钮时触发       | `() => void`                                    |
| edit       | 点击新增或关闭按钮时触发 | `(paneName, action: 'remove' \| 'add') => void` |

### Tabs Slots

| 插槽名   | 说明               | 子标签   |
| -------- | ------------------ | -------- |
| default  | 自定义内容         | Tab-pane |
| add-icon | 自定义新增按钮图标 | —        |

### Tabs Exposes

| 名称        | 说明               | 类型               |
| ----------- | ------------------ | ------------------ |
| currentName | 当前激活的标签名称 | `Ref<TabPaneName>` |

---

## Tab-pane API

### Tab-pane Attributes

| 属性名   | 说明                           | 类型               | 默认值  |
| -------- | ------------------------------ | ------------------ | ------- |
| label    | 标签页标题                     | `string`           | `''`    |
| disabled | 是否禁用                       | `boolean`          | `false` |
| name     | 标签唯一标识（默认为顺序序号） | `string \| number` | —       |
| closable | 是否可关闭                     | `boolean`          | `false` |
| lazy     | 是否延迟渲染内容               | `boolean`          | `false` |

### Tab-pane Slots

| 插槽名  | 说明           |
| ------- | -------------- |
| default | 标签页内容     |
| label   | 自定义标签标题 |
