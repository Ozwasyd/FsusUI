# Descriptions 描述列表

以列表形式展示多个字段信息。

> 💡 **运行示例**：启动 demo-app（`pnpm dev`，端口 5173）查看交互效果。

---

## 基础用法

使用 `el-descriptions` 和 `el-descriptions-item` 组合，`label` 属性设置字段名，默认插槽放置字段值。

## 不同尺寸

通过 `size` 属性设置列表尺寸：`large`、`default`、`small`。

## 垂直排列

设置 `direction="vertical"` 改为垂直方向排列。

## 跨行

通过 `rowspan` 属性设置单元格跨行数。

## 响应式投影

`responsive="auto"`（默认）根据组件自身可用宽度选择投影：宽度小于
`560px` 时使用语义化的 `dl/dt/dd` 纵向字段列表，桌面仍使用表格。
`responsive="stack"` 始终使用纵向投影；`responsive="scroll"` 保留表格并
提供可聚焦的横向滚动容器和右边缘提示。长地址、URL 和标识符会自然换行，
不会被静默省略。滚动模式可通过 `scroll-aria-label` 提供业务语境名称。

## 自定义样式

通过 `align`、`label-align`、`class-name`、`label-class-name` 等属性自定义样式。

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
