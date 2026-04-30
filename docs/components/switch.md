# Switch 开关

表示两种相互对立的状态间的切换，多用于触发「开/关」。

> 💡 **运行示例**：启动 demo-app（`pnpm dev`，端口 5173）查看交互效果。

---

## 基础用法

`v-model` 绑定布尔值。通过 CSS 变量 `--el-switch-on-color` / `--el-switch-off-color` 自定义颜色。

## 文字描述

通过 `active-text` / `inactive-text` 添加状态文字；设置 `inline-prompt` 将文字内嵌在按钮中。

## 自定义图标

通过 `active-icon` / `inactive-icon` 设置状态图标。

## 扩展 value 类型

通过 `active-value` / `inactive-value` 支持字符串或数字类型的值。

## 禁用

设置 `disabled` 属性禁用开关。

## 加载状态

设置 `loading` 属性显示加载中状态。

## 阻止切换

设置 `before-change` 返回 `false` 或 rejected 的 Promise 可阻止切换。

---

## API

### Attributes

| 属性名 | 说明 | 类型 | 默认值 |
|--------|------|------|--------|
| model-value / v-model | 绑定值（应与 active-value 或 inactive-value 等价） | `boolean \| string \| number` | `false` |
| disabled | 是否禁用 | `boolean` | `false` |
| loading | 是否加载中 | `boolean` | `false` |
| size | 尺寸 | `'' \| 'large' \| 'default' \| 'small'` | `''` |
| width | 开关宽度 | `number \| string` | `''` |
| inline-prompt | 图标或文字是否内嵌在圆点内 | `boolean` | `false` |
| active-icon | 开启状态的图标 | `string \| Component` | — |
| inactive-icon | 关闭状态的图标 | `string \| Component` | — |
| active-action-icon | 开启状态的动作图标 | `string \| Component` | — |
| inactive-action-icon | 关闭状态的动作图标 | `string \| Component` | — |
| active-text | 开启状态文字 | `string` | `''` |
| inactive-text | 关闭状态文字 | `string` | `''` |
| active-value | 开启时的值 | `boolean \| string \| number` | `true` |
| inactive-value | 关闭时的值 | `boolean \| string \| number` | `false` |
| name | 原生 `name` 属性 | `string` | `''` |
| validate-event | 是否触发表单校验 | `boolean` | `true` |
| before-change | 切换前钩子，返回 `false` 或 rejected Promise 时阻止切换 | `() => Promise<boolean> \| boolean` | — |
| id | 输入框 id | `string` | — |
| tabindex | 输入框 tabindex | `string \| number` | — |

### Events

| 事件名 | 说明 | 回调参数 |
|--------|------|---------|
| change | 值改变时触发 | `(val: boolean \| string \| number) => void` |

### Slots

| 插槽名 | 说明 |
|--------|------|
| active-action | 自定义开启状态动作内容 |
| inactive-action | 自定义关闭状态动作内容 |
| active | 自定义开启状态内容 |
| inactive | 自定义关闭状态内容 |

### Exposes

| 名称 | 说明 | 类型 |
|------|------|------|
| focus | 手动聚焦开关 | `() => void` |
