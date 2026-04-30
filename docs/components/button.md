# Button 按钮

常用的操作按钮。

> 💡 **运行示例**：启动 demo-app（`pnpm dev`，端口 5173）查看交互效果。

---

## 基础用法

使用 `type`、`plain`、`round`、`dashed`、`circle` 属性定义按钮的样式。

## 禁用状态

通过 `disabled` 属性控制按钮是否禁用，接受 Boolean 值。

## 链接按钮

> **已废弃**：`type="text"` 将在 3.0.0 移除，请改用 `link` 属性（新 API）。

## 文字按钮

使用 `text: true` 声明文字按钮（无边框、无背景）。使用 `bg: true` 可始终显示文字按钮的背景色。

## 图标按钮

通过 `icon` 属性添加图标，可以只使用图标节省空间，也可以和文字搭配使用。

## 按钮组

使用 `<el-button-group>` 标签来组合一组按钮。可通过 `direction` 属性设置排列方向（`horizontal` / `vertical`）。

## 加载状态

设置 `loading` 为 `true` 即可进入加载状态。可通过 `loading` slot 或 `loadingIcon` 自定义加载图标（slot 优先级更高）。

## 不同尺寸

按钮支持 `large`、`default`、`small` 三种尺寸。

## 自定义颜色

通过 `color` 属性自定义按钮颜色，FsusUI 会自动计算 hover 和 active 色。`color` 也适用于 `link` 和 `text` 按钮。

> FsusUI 默认主色为 **Scholarly Blue `#2A599C`**，Primary 按钮 Hover 时会从 Ink Black `#0F0F11` 切换至此色。

---

## Button API

### Button Attributes

| 属性名 | 说明 | 类型 | 默认值 |
|--------|------|------|--------|
| size | 按钮尺寸 | `'large' \| 'default' \| 'small'` | — |
| type | 按钮类型 | `'default' \| 'primary' \| 'success' \| 'warning' \| 'danger' \| 'info'` | — |
| plain | 是否为朴素按钮 | `boolean` | `false` |
| text | 是否为文字按钮 | `boolean` | `false` |
| bg | 文字按钮是否始终显示背景色 | `boolean` | `false` |
| link | 是否为链接按钮 | `boolean` | `false` |
| round | 是否为圆角按钮 | `boolean` | `false` |
| circle | 是否为圆形按钮 | `boolean` | `false` |
| dashed | 是否为虚线按钮 | `boolean` | `false` |
| loading | 是否加载中 | `boolean` | `false` |
| loading-icon | 自定义加载图标组件 | `string \| Component` | `Loading` |
| disabled | 是否禁用 | `boolean` | `false` |
| icon | 图标组件 | `string \| Component` | — |
| autofocus | 原生 `autofocus` 属性 | `boolean` | `false` |
| native-type | 原生 `type` 属性 | `'button' \| 'submit' \| 'reset'` | `button` |
| auto-insert-space | 两个汉字之间是否自动插入空格（仅 2 个汉字时生效） | `boolean` | `false` |
| color | 自定义按钮颜色，自动计算 hover/active 色 | `string` | — |
| dark | 暗色模式，将 `color` 自动转换为暗色模式颜色 | `boolean` | `false` |
| tag | 自定义元素标签 | `string \| Component` | `button` |

### Button Slots

| 插槽名 | 说明 |
|--------|------|
| default | 自定义默认内容 |
| loading | 自定义加载图标组件 |
| icon | 自定义图标组件 |

### Button Exposes

| 名称 | 说明 | 类型 |
|------|------|------|
| ref | 按钮 HTML 元素 | `Ref<HTMLButtonElement>` |
| size | 按钮尺寸 | `ComputedRef<'' \| 'small' \| 'default' \| 'large'>` |
| type | 按钮类型 | `ComputedRef<'' \| 'default' \| 'primary' \| 'success' \| 'warning' \| 'info' \| 'danger'>` |
| disabled | 是否禁用 | `ComputedRef<boolean>` |
| shouldAddSpace | 是否添加空格 | `ComputedRef<boolean>` |

---

## ButtonGroup API

### ButtonGroup Attributes

| 属性名 | 说明 | 类型 | 默认值 |
|--------|------|------|--------|
| size | 统一设置按钮组中按钮的尺寸 | `'large' \| 'default' \| 'small'` | — |
| type | 统一设置按钮组中按钮的类型 | `'primary' \| 'success' \| 'warning' \| 'danger' \| 'info'` | — |
| direction | 排列方向 | `'horizontal' \| 'vertical'` | `horizontal` |

### ButtonGroup Slots

| 插槽名 | 说明 | 子标签 |
|--------|------|--------|
| default | 自定义按钮组内容 | Button |
