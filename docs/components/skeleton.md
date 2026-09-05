# Skeleton

Shows a skeleton structure before data loads to maintain visual continuity.

> See the [Playground](../playground.md) for runnable component examples.

---

## Basic Usage

```vue
<el-skeleton :rows="5" animated />
```

## Loading State Control

Use `loading` to control the skeleton. When `loading` is `false`, the default slot renders the real content.

```vue
<el-skeleton :loading="isLoading" animated>
  <template #default>
    <!-- 真实内容 -->
  </template>
</el-skeleton>
```

## Custom Template

Customize the skeleton with the `#template` slot, typically using `el-skeleton-item`.

```vue
<el-skeleton animated>
  <template #template>
    <el-skeleton-item variant="circle" style="width: 50px; height: 50px" />
    <el-skeleton-item variant="text" style="width: 200px" />
  </template>
</el-skeleton>
```

## Prevent Render Jitter

Use `throttle` to delay rendering in milliseconds and avoid flashes from fast requests. An object can set independent show/hide delays: `{ leading: 500, trailing: 300 }`.

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
