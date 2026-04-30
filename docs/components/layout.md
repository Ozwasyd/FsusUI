# Layout 布局

基于 24 栅格的响应式布局系统，使用 Flex 布局实现。

> 💡 **运行示例**：启动 demo-app（`pnpm dev`，端口 5173）查看交互效果。

---

## 基础布局

使用 `<el-row>` 和 `<el-col>` 组合，通过 `span` 属性进行分栏。

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

## 列间距

使用 `<el-row>` 的 `gutter` 属性指定列之间的间距（默认 0）。

## 分栏偏移

通过 `offset` 属性指定列偏移量。

## 对齐方式

使用 `justify` 属性设置子元素的水平对齐：`start`、`center`、`end`、`space-between`、`space-around`、`space-evenly`。

## 响应式布局

预设五个断点：`xs`（< 768px）、`sm`（≥ 768px）、`md`（≥ 992px）、`lg`（≥ 1200px）、`xl`（≥ 1920px）。

```vue
<el-col :xs="8" :sm="6" :md="4" :lg="3" :xl="1">响应式列</el-col>
```

## 元素隐藏辅助类

引入 CSS 后可使用响应式隐藏类：

```ts
import 'element-plus/theme-chalk/display.css'
```

可用类名：`hidden-xs-only`、`hidden-sm-only`、`hidden-sm-and-down`、`hidden-sm-and-up`、`hidden-md-only`、`hidden-md-and-down`、`hidden-md-and-up`、`hidden-lg-only`、`hidden-lg-and-down`、`hidden-lg-and-up`、`hidden-xl-only`

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
