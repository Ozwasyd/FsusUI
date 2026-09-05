# Avatar

Displays a user or object as an image, icon, or text avatar.

> See the [Playground](../playground.md) for runnable component examples.

---

## Basic Usage

Use `shape` for `circle` or `square`, and `size` for the avatar size.

## Types

The avatar supports an image (`src`), icon (`icon`), or character content.

## Image Load Failure

Handle image-load failure in the `error` event, or provide fallback content in
the default slot.

## Container Fit

Use `fit` to control how the image fills its container, as with CSS `object-fit`.

## Avatar Group

Use `el-avatar-group` to combine avatars; it supports collapsing and tooltips.

---

## Avatar API

### Avatar Attributes

| 属性名 | 说明 | 类型 | 默认值 |
|--------|------|------|--------|
| icon | 图标组件（作为头像内容） | `string \| Component` | — |
| size | 尺寸（数字为 px，或预设大小） | `number \| 'large' \| 'default' \| 'small'` | — |
| shape | 形状 | `'circle' \| 'square'` | — |
| src | 图片地址 | `string` | — |
| src-set | 图片 `srcset` 属性 | `string` | — |
| alt | 图片 `alt` 属性 | `string` | — |
| fit | 图片适配方式 | `'fill' \| 'contain' \| 'cover' \| 'none' \| 'scale-down'` | `cover` |

### Avatar Events

| 事件名 | 说明 | 回调参数 |
|--------|------|---------|
| error | 图片加载失败时触发 | `(e: Event) => void` |

### Avatar Slots

| 插槽名 | 说明 |
|--------|------|
| default | 自定义头像内容 |

---

## AvatarGroup API

### AvatarGroup Attributes

| 属性名 | 说明 | 类型 | 默认值 |
|--------|------|------|--------|
| size | 统一控制组内头像大小 | `number \| 'large' \| 'default' \| 'small'` | — |
| shape | 统一控制组内头像形状 | `'circle' \| 'square'` | — |
| collapse-avatars | 是否折叠超出数量的头像 | `boolean` | `false` |
| collapse-avatars-tooltip | 鼠标悬停折叠头像时是否显示全部 tooltip（需开启 `collapse-avatars`） | `boolean` | `false` |
| max-collapse-avatars | 最多显示的头像数（需开启 `collapse-avatars`） | `number` | `1` |
| effect | tooltip 主题 | `'dark' \| 'light'` | `light` |
| placement | tooltip 弹出位置 | `string` | `top` |
| popper-class | tooltip 自定义 class | `string` | `''` |
