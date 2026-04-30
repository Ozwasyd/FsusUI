# Checkbox 多选框

一组备选项中进行多选。

> **注意**：`label` 作为 `value` 使用的方式已废弃，推荐使用 `value` 属性（需 2.6.0+）。

> 💡 **运行示例**：启动 demo-app（`pnpm dev`，端口 5173）查看交互效果。

---

## 基础用法

单独使用，通过 `v-model` 绑定 Boolean 值。

## 禁用状态

通过 `disabled` 属性禁用多选框。

## 多选框组

使用 `el-checkbox-group` 组合多个多选框，`v-model` 绑定为数组。

## 全选（中间状态）

通过 `indeterminate` 属性实现"全选"的中间态效果。

## 最多/最少可选数量

使用 `el-checkbox-group` 的 `min` / `max` 属性限制可选数量。

## 按钮样式

将 `el-checkbox` 替换为 `el-checkbox-button` 实现按钮样式。

## 带边框

通过 `border` 属性为多选框添加边框。

---

## Checkbox API

### Checkbox Attributes

| 属性名 | 说明 | 类型 | 默认值 |
|--------|------|------|--------|
| model-value / v-model | 绑定值 | `string \| number \| boolean` | — |
| value | 在 checkbox-group 中使用时的值 | `string \| number \| boolean \| object` | — |
| label | 标签文本（无 value 时作为 value 使用） | `string \| number \| boolean \| object` | — |
| true-value | 勾选时的值 | `string \| number` | — |
| false-value | 未勾选时的值 | `string \| number` | — |
| disabled | 是否禁用 | `boolean` | `false` |
| border | 是否显示边框 | `boolean` | `false` |
| size | 尺寸 | `'large' \| 'default' \| 'small'` | — |
| name | 原生 `name` 属性 | `string` | — |
| checked | 是否被勾选 | `boolean` | `false` |
| indeterminate | 设置中间状态（仅控制样式） | `boolean` | `false` |
| validate-event | 是否触发表单校验 | `boolean` | `true` |
| tabindex | 输入框 tabindex | `string \| number` | — |

### Checkbox Events

| 事件名 | 说明 | 回调参数 |
|--------|------|---------|
| change | 绑定值变化时触发 | `(value: string \| number \| boolean) => void` |

### Checkbox Slots

| 插槽名 | 说明 |
|--------|------|
| default | 自定义内容 |

---

## CheckboxGroup API

### CheckboxGroup Attributes

| 属性名 | 说明 | 类型 | 默认值 |
|--------|------|------|--------|
| model-value / v-model | 绑定值 | `string[] \| number[]` | `[]` |
| size | 尺寸 | `'large' \| 'default' \| 'small'` | — |
| disabled | 是否禁用所有子多选框 | `boolean` | `false` |
| min | 最少勾选数量 | `number` | — |
| max | 最多勾选数量 | `number` | — |
| text-color | 按钮激活时的文字颜色 | `string` | `#ffffff` |
| fill | 按钮激活时的边框和背景色 | `string` | `#409eff` |
| validate-event | 是否触发表单校验 | `boolean` | `true` |

### CheckboxGroup Events

| 事件名 | 说明 | 回调参数 |
|--------|------|---------|
| change | 绑定值变化时触发 | `(value: string[] \| number[]) => void` |

### CheckboxGroup Slots

| 插槽名 | 说明 | 子标签 |
|--------|------|--------|
| default | 自定义内容 | Checkbox / CheckboxButton |
