# Space 间距

为相邻元素提供统一间距，代替手动设置 margin 的繁琐操作。

> **注意**：不建议将 `ElSpace` 与依赖祖先宽/高的组件（如 `ElSlider`）嵌套使用，可能导致拖拽位置偏移。

> 💡 **运行示例**：启动 demo-app（`pnpm dev`，端口 5173）查看交互效果。

---

## 基础用法

水平排列多个元素，提供统一间距：

```vue
<template>
  <el-space>
    <el-button>按钮 1</el-button>
    <el-button>按钮 2</el-button>
    <el-button>按钮 3</el-button>
  </el-space>
</template>
```

## 垂直布局

通过 `direction="vertical"` 切换为纵向布局。

## 间距大小

内置尺寸：`small`（8px，默认）、`default`（12px）、`large`（16px）。  
也可传入自定义数值覆盖。

## 自动换行

在水平模式下，使用 `wrap` 属性控制自动换行。

## 分隔符

通过 `spacer` 属性插入文字或 VNode 分隔符：

```vue
<template>
  <el-space :spacer="'|'">
    <span>链接 1</span>
    <span>链接 2</span>
  </el-space>
</template>
```

## 填充容器

通过 `fill` 属性让子节点自动充满容器宽度，可配合 `fill-ratio` 自定义填充比例。

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
