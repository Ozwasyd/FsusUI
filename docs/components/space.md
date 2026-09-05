# Space

Provides consistent spacing between adjacent elements instead of manual margins.

> **Note:** Avoid nesting `ElSpace` with components that depend on ancestor width/height (such as `ElSlider`), as dragging positions may shift.

> See the [Playground](../playground.md) for runnable component examples.

---

## Basic Usage

Arrange multiple elements horizontally with consistent spacing:

```vue
<template>
  <el-space>
    <el-button>按钮 1</el-button>
    <el-button>按钮 2</el-button>
    <el-button>按钮 3</el-button>
  </el-space>
</template>
```

## Vertical Layout

Set `direction="vertical"` for vertical layout.

## Spacing

Built-in sizes are `small` (8px, default), `default` (12px), and `large` (16px).
Pass a custom value to override them.

## Auto Wrap

In horizontal mode, use `wrap` to control line wrapping.

## Separator

Use `spacer` to insert text or a VNode separator:

```vue
<template>
  <el-space :spacer="'|'">
    <span>链接 1</span>
    <span>链接 2</span>
  </el-space>
</template>
```

## Filled Container

Set `fill` to make children fill the container width; use `fill-ratio` for a custom ratio.

---

## API

### Attributes

| 属性名 | 说明 | 类型 | 默认值 |
|--------|------|------|--------|
| alignment | 子元素对齐方式（同 align-items） | `string` | `center` |
| direction | 排列方向 | `'horizontal' \| 'vertical'` | `horizontal` |
| size | 间距大小 | `'default' \| 'small' \| 'large' \| number \| [number, number]` | `small` |
| spacer | 分隔符 | `string \| number \| VNode` | — |
| wrap | 是否自动换行（水平模式） | `boolean` | `false` |
| fill | 是否填充容器 | `boolean` | `false` |
| fill-ratio | 填充比例 | `number` | `100` |

### Slots

| 插槽名 | 说明 |
|--------|------|
| default | 需要设置间距的子元素 |
