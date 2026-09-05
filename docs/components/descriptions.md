# Descriptions

Displays multiple fields as a list.

> See the [Playground](../playground.md) for runnable component examples.

---

## Basic Usage

Compose `el-descriptions` and `el-descriptions-item`; use `label` for the field name and the default slot for its value.

## Sizes

Set the list size with `size`: `large`, `default`, or `small`.

## Vertical Layout

Set `direction="vertical"` for vertical layout.

## Row Spanning

Use `rowspan` to set how many rows a cell spans.

## Responsive Projection

`responsive="auto"` (default) chooses the projection from the component's own available width: below
`560px`, it uses a semantic `dl/dt/dd` field list while desktop retains the table.
`responsive="stack"` always uses the vertical projection; `responsive="scroll"` retains the table and
provides a focusable horizontal scroller with an edge cue. Long addresses, URLs, and identifiers wrap
naturally instead of being silently truncated. Use `scroll-aria-label` to provide business context for the scroller.

## Custom Styles

Customize styling with `align`, `label-align`, `class-name`, `label-class-name`, and related props.

---

## Descriptions API

### Descriptions Attributes

| 属性名            | 说明                          | 类型                                    | 默认值                    |
| ----------------- | ----------------------------- | --------------------------------------- | ------------------------- |
| border            | 是否显示边框                  | `boolean`                               | `false`                   |
| column            | 每行显示的条目数              | `number`                                | `3`                       |
| direction         | 排列方向                      | `'vertical' \| 'horizontal'`            | `horizontal`              |
| responsive        | 响应式投影                    | `'auto' \| 'stack' \| 'scroll'`         | `auto`                    |
| scroll-aria-label | scroll 模式滚动区的可访问名称 | `string`                                | `Scrollable descriptions` |
| size              | 尺寸                          | `'' \| 'large' \| 'default' \| 'small'` | —                         |
| title             | 标题（左上角）                | `string`                                | `''`                      |
| extra             | 扩展区域内容（右上角）        | `string`                                | `''`                      |
| label-width       | 每列 label 的宽度             | `string \| number`                      | —                         |

### Descriptions Slots

| 插槽名  | 说明                 | 子标签            |
| ------- | -------------------- | ----------------- |
| default | 自定义内容           | Descriptions-Item |
| title   | 自定义左上角标题     | —                 |
| extra   | 自定义右上角扩展区域 | —                 |

---

## Descriptions-Item API

### Descriptions-Item Attributes

| 属性名           | 说明                                                    | 类型                            | 默认值 |
| ---------------- | ------------------------------------------------------- | ------------------------------- | ------ |
| label            | 字段标签文字                                            | `string`                        | `''`   |
| span             | 列合并数                                                | `number`                        | `1`    |
| rowspan          | 行合并数                                                | `number`                        | `1`    |
| width            | 列宽（同一列取最大值；无边框时包含 label 和内容）       | `string \| number`              | `''`   |
| min-width        | 列最小宽度                                              | `string \| number`              | `''`   |
| label-width      | 当前列 label 宽度（优先于 Descriptions 的 label-width） | `string \| number`              | —      |
| align            | 内容对齐方式（无边框时同时作用于 label）                | `'left' \| 'center' \| 'right'` | `left` |
| label-align      | label 对齐方式（无边框时请用 align）                    | `'left' \| 'center' \| 'right'` | —      |
| class-name       | 内容区域自定义 class                                    | `string`                        | `''`   |
| label-class-name | label 区域自定义 class                                  | `string`                        | `''`   |

### Descriptions-Item Slots

| 插槽名  | 说明         |
| ------- | ------------ |
| default | 字段值内容   |
| label   | 自定义 label |
