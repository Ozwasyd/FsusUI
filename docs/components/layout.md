# Layout

A responsive 24-column grid implemented with Flexbox.

> See the [Playground](../playground.md) for runnable component examples.

---

## Basic Layout

Compose `<el-row>` and `<el-col>` and set the column span with `span`.

```vue
<template>
  <el-row>
    <el-col :span="24"><div>100%</div></el-col>
  </el-row>
  <el-row>
    <el-col :span="12"><div>50%</div></el-col>
    <el-col :span="12"><div>50%</div></el-col>
  </el-row>
</template>
```

## Column Gutter

Set the space between columns with `<el-row>`'s `gutter` (default `0`).

## Column Offset

Set a column offset with `offset`.

## Alignment

Use `justify` for horizontal alignment: `start`, `center`, `end`, `space-between`, `space-around`, or `space-evenly`.

## Responsive Layout

Five breakpoints are provided: `xs` (< 768px), `sm` (≥ 768px), `md` (≥ 992px), `lg` (≥ 1200px), and `xl` (≥ 1920px).

```vue
<el-col :xs="8" :sm="6" :md="4" :lg="3" :xl="1">响应式列</el-col>
```

## Element Visibility Helpers

After importing the CSS, use responsive visibility helpers:

```ts
import '@ozwasyd/element-plus/theme-chalk/display.css'
```

Available classes: `hidden-xs-only`, `hidden-sm-only`, `hidden-sm-and-down`, `hidden-sm-and-up`, `hidden-md-only`, `hidden-md-and-down`, `hidden-md-and-up`, `hidden-lg-only`, `hidden-lg-and-down`, `hidden-lg-and-up`, `hidden-xl-only`

---

## Row API

### Row Attributes

| 属性名 | 说明 | 类型 | 默认值 |
|--------|------|------|--------|
| gutter | 列间距 | `number` | `0` |
| justify | 水平对齐 | `'start' \| 'end' \| 'center' \| 'space-around' \| 'space-between' \| 'space-evenly'` | `start` |
| align | 垂直对齐 | `'top' \| 'middle' \| 'bottom'` | — |
| tag | 自定义元素标签 | `string` | `div` |

### Row Slots

| 插槽名 | 说明 | 子标签 |
|--------|------|--------|
| default | 自定义内容 | Col |

---

## Col API

### Col Attributes

| 属性名 | 说明 | 类型 | 默认值 |
|--------|------|------|--------|
| span | 栅格占据的列数 | `number` | `24` |
| offset | 栅格左侧间隔格数 | `number` | `0` |
| push | 向右移动格数 | `number` | `0` |
| pull | 向左移动格数 | `number` | `0` |
| xs | `< 768px` 响应式列数或列配置对象 | `number \| { span?, offset?, pull?, push? }` | — |
| sm | `≥ 768px` 响应式列数或列配置对象 | `number \| { span?, offset?, pull?, push? }` | — |
| md | `≥ 992px` 响应式列数或列配置对象 | `number \| { span?, offset?, pull?, push? }` | — |
| lg | `≥ 1200px` 响应式列数或列配置对象 | `number \| { span?, offset?, pull?, push? }` | — |
| xl | `≥ 1920px` 响应式列数或列配置对象 | `number \| { span?, offset?, pull?, push? }` | — |
| tag | 自定义元素标签 | `string` | `div` |

### Col Slots

| 插槽名 | 说明 |
|--------|------|
| default | 自定义内容 |
