# Empty

`ElEmpty` represents a state with no data, no matching results, or no content created yet. An empty state should answer two questions first:

1. Why is there no content here?
2. What can the user do next?

The default illustration is a quiet monochrome document shape used only as a positional cue. It does not convey the state and must not replace a clear explanation or next action.

> See the [Playground](../playground.md) for runnable component examples.

## Basic Usage

```vue
<el-empty description="当前筛选条件没有匹配结果，请调整筛选条件。">
  <el-button>清除筛选</el-button>
</el-empty>
```

Avoid writing only “No data”. Explain why, and provide a clear action when the user can continue. If no action is available, explain the reason in the description instead of filling the space with a large illustration.

## When Not to Use an Illustration

For compact lists, tables, drawers, and local filter results, prefer
[`FsusEmptyState size="inline"`](./empty-state.md), which hides the illustration by default. When the page heading, description, and surrounding structure are already clear, avoid adding another illustration.

`ElEmpty`'s default graphic has no gradient, animation, or brand-colored glow and uses `aria-hidden="true"`; text always carries the state meaning.

## Custom Image

Set a custom image URL with `image` and its width in pixels with `image-size`. Prop images are decorative and render with `alt=""` and `aria-hidden="true"`. Use the `image` slot when you need control over accessible semantics or custom structure.

```vue
<el-empty
  image="/images/archive-empty.svg"
  :image-size="96"
  description="归档中还没有文档，请先导入一个文件。"
>
  <el-button>导入文档</el-button>
</el-empty>
```

## Custom Slots

The `image`, `description`, and default slots remain available. Custom decorative images should also set `aria-hidden="true"`; nearby text explains the state.

```vue
<el-empty>
  <template #image>
    <span class="archive-mark" aria-hidden="true" />
  </template>
  <template #description>
    尚未创建归档。创建后可在这里集中查看历史文档。
  </template>
  <el-button type="primary">创建归档</el-button>
</el-empty>
```

## API

### Attributes

| 属性名 | 说明 | 类型 | 默认值 |
|--------|------|------|--------|
| image | 装饰图片 URL | `string` | `''` |
| image-size | 图片宽度（px） | `number` | — |
| description | 说明原因与下一步的文字 | `string` | `''` |
| description-layout | 说明区域宽度预设 | `'default' \| 'narrow' \| 'wide'` | `'default'` |
| description-width | 自定义说明区域最大宽度 | `string \| number` | — |

### Slots

| 插槽名 | 说明 |
|--------|------|
| default | 底部操作区域 |
| image | 自定义装饰或图片区域 |
| description | 自定义说明文字 |

## Visual and Regression Contract

- Default `ElEmpty` uses a monochrome document shape without orbit, node, glow, gradients, or animation.
- `FsusEmptyState` defaults to no illustration for inline / compact and a small document mark for page.
- `empty-illustration.spec.ts` stores Light and Dark snapshots for default / inline / compact / page and verifies decorative semantics.
- Component tests lock the custom image, `image-size`, `image` / `description` / default-slot APIs.
