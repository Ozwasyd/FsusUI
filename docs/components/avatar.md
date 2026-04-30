# Avatar 头像

用于展示用户或事物的图像，支持图片、图标或文字形式。

> 💡 **运行示例**：启动 demo-app（`pnpm dev`，端口 5173）查看交互效果。

---

## 基础用法

通过 `shape` 设置头像形状（`circle` / `square`），通过 `size` 设置大小。

## 类型

支持图片（`src`）、图标（`icon`）和字符三种展示方式。

## 图片加载失败

通过 `error` 事件处理图片加载失败，或使用默认插槽自定义回退内容。

## 适配容器

通过 `fit` 属性控制图片如何填充容器（同 CSS `object-fit`）。

## 头像组

使用 `el-avatar-group` 将多个头像组合展示，支持折叠和 tooltip。

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
