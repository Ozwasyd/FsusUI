# Radio 单选框

在一组备选项中进行单选。

> **注意**：`label` 作为 `value` 使用的方式已废弃，推荐使用 `value` 属性（需 2.6.0+）。

> 💡 **运行示例**：启动 demo-app（`pnpm dev`，端口 5173）查看交互效果。

---

## 基础用法

单选框的选项不宜过多。`v-model` 绑定当前选中的值。

## 禁用状态

通过 `disabled` 属性禁用单选框。

## 单选框组

配合 `el-radio-group` 使用，可通过 `v-model` 统一管理多个单选框，并监听 `change` 事件。

## 带边框

通过 `border` 属性为单选框添加边框。

## 按钮样式

将 `el-radio` 替换为 `el-radio-button` 实现按钮样式。可通过 `fill` 和 `text-color` 设置激活样式。

---

## Radio API

### Radio Attributes

| 属性名 | 说明 | 类型 | 默认值 |
|--------|------|------|--------|
| model-value / v-model | 绑定值 | `string \| number \| boolean` | — |
| value | 选中状态的值 | `string \| number \| boolean` | — |
| label | 单选框标签文本（无 value 时作为 value 使用） | `string \| number \| boolean` | — |
| disabled | 是否禁用 | `boolean` | `false` |
| border | 是否显示边框 | `boolean` | `false` |
| size | 尺寸（需 `border` 为 true 才有效） | `'large' \| 'default' \| 'small'` | — |
| name | 原生 `name` 属性 | `string` | — |

### Radio Events

| 事件名 | 说明 | 回调参数 |
|--------|------|---------|
| change | 绑定值变化时触发 | `(value: string \| number \| boolean) => void` |

### Radio Slots

| 插槽名 | 说明 |
|--------|------|
| default | 自定义内容 |

---

## RadioGroup API

### RadioGroup Attributes

| 属性名 | 说明 | 类型 | 默认值 |
|--------|------|------|--------|
| model-value / v-model | 绑定值 | `string \| number \| boolean` | — |
| size | 单选按钮或带边框单选框的尺寸 | `string` | `default` |
| disabled | 是否禁用该组所有单选框 | `boolean` | `false` |
| validate-event | 是否触发表单校验 | `boolean` | `true` |
| text-color | 按钮激活时的文字颜色 | `string` | `#ffffff` |
| fill | 按钮激活时的边框和背景色 | `string` | `#409eff` |
| name | 原生 `name` 属性 | `string` | — |

### RadioGroup Events

| 事件名 | 说明 | 回调参数 |
|--------|------|---------|
| change | 绑定值变化时触发 | `(value: string \| number \| boolean) => void` |

### RadioGroup Slots

| 插槽名 | 说明 | 子标签 |
|--------|------|--------|
| default | 自定义内容 | Radio / RadioButton |

---

## RadioButton API

### RadioButton Attributes

| 属性名 | 说明 | 类型 | 默认值 |
|--------|------|------|--------|
| value | 选中时的值 | `string \| number \| boolean` | — |
| label | 标签文本（无 value 时作为 value 使用） | `string \| number \| boolean` | — |
| disabled | 是否禁用 | `boolean` | `false` |
| name | 原生 `name` 属性 | `string` | — |

### RadioButton Slots

| 插槽名 | 说明 |
|--------|------|
| default | 自定义内容 |
