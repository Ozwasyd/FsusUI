# Tabs

Divides related content into categories and shows one category at a time.

## Public Preview

This is a preview public component. See [API stability](../api-stability.md#stability-levels)
and the shared [theme and motion contracts](../theme/tokens.md). Each tab label
must identify its content; add/close controls need readable text or an
accessible icon name. When tabs are added or removed dynamically, the consumer
must maintain the active item so focus is not lost.

> See the [Playground](../playground.md) for runnable component examples.

---

## Basic Usage

Bind the active Tab's `name` with `v-model`; the first tab is selected by default.

## Card Style

Set `type="card"` for the card style.

## Bordered Card

Set `type="border-card"` for the bordered-card style.

## Position

Set the tab position with `tab-position`: `top` (default), `bottom`, `left`, or `right`.

## Add and Close Tabs

Set `editable`, or both `addable` and `closable` (card type only), for dynamic tab creation and removal.

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
