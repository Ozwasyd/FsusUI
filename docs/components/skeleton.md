# Skeleton 骨架屏

在数据加载前展示骨架结构，提供更好的视觉体验。

> 💡 **运行示例**：启动 demo-app（`pnpm dev`，端口 5173）查看交互效果。

---

## 基础用法

```vue
<el-skeleton :rows="5" animated />
```

## 加载状态控制

通过 `loading` 属性控制是否显示骨架屏。`loading` 为 `false` 时显示默认插槽中的真实内容。

```vue
<el-skeleton :loading="isLoading" animated>
  <template #default>
    <!-- 真实内容 -->
  </template>
</el-skeleton>
```

## 自定义模板

通过 `#template` 插槽自定义骨架结构，配合 `el-skeleton-item` 组件使用。

```vue
<el-skeleton animated>
  <template #template>
    <el-skeleton-item variant="circle" style="width: 50px; height: 50px" />
    <el-skeleton-item variant="text" style="width: 200px" />
  </template>
</el-skeleton>
```

## 防止渲染抖动

使用 `throttle` 属性设置延迟渲染（ms），避免快速请求导致闪烁。支持传入对象控制显示/隐藏的独立延迟：`{ leading: 500, trailing: 300 }`。

---

## Skeleton API

### Attributes

| 属性名 | 说明 | 类型 | 默认值 |
|--------|------|------|--------|
| animated | 是否显示加载动画 | `boolean` | `false` |
| count | 渲染骨架的数量 | `number` | `1` |
| loading | 是否显示骨架屏（`false` 时显示真实内容） | `boolean` | `false` |
| rows | 默认段落行数（无 `#template` 插槽时生效） | `number` | `3` |
| throttle | 渲染延迟（ms），可传对象 `{ leading, trailing, initVal }` | `number \| { leading?: number; trailing?: number; initVal?: boolean }` | `0` |

### Slots

| 插槽名 | 说明 | 参数 |
|--------|------|------|
| default | 加载完成后展示的真实内容 | — |
| template | 自定义骨架结构 | `{ key: number }` |

---

## SkeletonItem API

### Attributes

| 属性名 | 说明 | 类型 | 默认值 |
|--------|------|------|--------|
| variant | 骨架元素类型 | `'p' \| 'text' \| 'h1' \| 'h3' \| 'caption' \| 'button' \| 'image' \| 'circle' \| 'rect'` | `text` |
