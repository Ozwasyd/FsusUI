# ColorPicker 颜色选择器

用于颜色的选择，支持多种颜色格式。

> 💡 **运行示例**：启动 demo-app（`pnpm dev`，端口 5173）查看交互效果。

---

## 基础用法

`v-model` 绑定字符串类型的颜色值。

## Alpha 通道

设置 `show-alpha` 开启透明度选择。

## 预定义颜色

通过 `predefine` 数组提供快捷颜色选项。

## 尺寸

通过 `size` 设置尺寸。

---

## API

### Attributes

| 属性名 | 说明 | 类型 | 默认值 |
|--------|------|------|--------|
| model-value / v-model | 绑定值 | `string` | — |
| disabled | 是否禁用 | `boolean` | `false` |
| clearable | 是否显示清空按钮 | `boolean` | `true` |
| size | 尺寸 | `'large' \| 'default' \| 'small'` | — |
| show-alpha | 是否显示透明度选择 | `boolean` | `false` |
| color-format | v-model 的颜色格式 | `'rgb' \| 'hex' \| 'hex6' \| 'hex8' \| 'hsl' \| 'hsv' \| 'name'` | `hex`（无 alpha）/ `rgb`（有 alpha） |
| popper-class | 下拉框自定义 class | `string` | `''` |
| predefine | 预定义颜色选项 | `string[]` | — |
| validate-event | 是否触发表单校验 | `boolean` | `true` |
| teleported | 是否将弹框传送到 body | `boolean` | `true` |

### Events

| 事件名 | 说明 | 回调参数 |
|--------|------|---------|
| change | 输入值改变时触发 | `(value: string) => void` |
| active-change | 当前激活颜色变化时触发 | `(value: string) => void` |
| focus | 聚焦时触发 | `(event: FocusEvent) => void` |
| blur | 失焦时触发 | `(event: FocusEvent) => void` |
| clear | 点击清空按钮时触发 | `() => void` |

### Exposes

| 名称 | 说明 | 类型 |
|------|------|------|
| color | 当前颜色对象 | `Color` |
| show | 手动显示颜色选择器 | `() => void` |
| hide | 手动隐藏颜色选择器 | `() => void` |
| focus | 聚焦选择器 | `() => void` |
| blur | 使选择器失焦 | `() => void` |
