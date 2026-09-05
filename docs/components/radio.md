# Radio

Select one option from a set of alternatives.

> **Note:** Using `label` as `value` is deprecated. Use the `value` prop instead (requires 2.6.0+).

> See the [Playground](../playground.md) for runnable component examples.

---

## Basic Usage

Keep the number of radio options reasonable. Bind the selected value with `v-model`.

## Disabled State

Use `disabled` to disable a radio.

## Radio Group

Use `el-radio-group` to manage multiple radios through one `v-model` and listen for `change`.

## With Border

Set `border` to add a border.

## Button Style

Replace `el-radio` with `el-radio-button` for a button style. Use `fill` and `text-color` for the active style.

---

## Radio API

### Radio Attributes

| 属性名                | 说明                                         | 类型                              | 默认值  |
| --------------------- | -------------------------------------------- | --------------------------------- | ------- |
| model-value / v-model | 绑定值                                       | `string \| number \| boolean`     | —       |
| value                 | 选中状态的值                                 | `string \| number \| boolean`     | —       |
| label                 | 单选框标签文本（无 value 时作为 value 使用） | `string \| number \| boolean`     | —       |
| disabled              | 是否禁用                                     | `boolean`                         | `false` |
| border                | 是否显示边框                                 | `boolean`                         | `false` |
| size                  | 尺寸（需 `border` 为 true 才有效）           | `'large' \| 'default' \| 'small'` | —       |
| name                  | 原生 `name` 属性                             | `string`                          | —       |

### Radio Events

| 事件名 | 说明             | 回调参数                                       |
| ------ | ---------------- | ---------------------------------------------- |
| change | 绑定值变化时触发 | `(value: string \| number \| boolean) => void` |

### Radio Slots

| 插槽名  | 说明       |
| ------- | ---------- |
| default | 自定义内容 |

---

## RadioGroup API

### RadioGroup Attributes

| 属性名                | 说明                         | 类型                          | 默认值    |
| --------------------- | ---------------------------- | ----------------------------- | --------- |
| model-value / v-model | 绑定值                       | `string \| number \| boolean` | —         |
| size                  | 单选按钮或带边框单选框的尺寸 | `string`                      | `default` |
| disabled              | 是否禁用该组所有单选框       | `boolean`                     | `false`   |
| validate-event        | 是否触发表单校验             | `boolean`                     | `true`    |
| text-color            | 按钮激活时的文字颜色         | `string`                      | `#ffffff` |
| fill                  | 按钮激活时的边框和背景色     | `string`                      | `#409eff` |
| name                  | 原生 `name` 属性             | `string`                      | —         |

### RadioGroup Events

| 事件名 | 说明             | 回调参数                                       |
| ------ | ---------------- | ---------------------------------------------- |
| change | 绑定值变化时触发 | `(value: string \| number \| boolean) => void` |

### RadioGroup Slots

| 插槽名  | 说明       | 子标签              |
| ------- | ---------- | ------------------- |
| default | 自定义内容 | Radio / RadioButton |

---

## RadioButton API

### RadioButton Attributes

| 属性名   | 说明                                   | 类型                          | 默认值  |
| -------- | -------------------------------------- | ----------------------------- | ------- |
| value    | 选中时的值                             | `string \| number \| boolean` | —       |
| label    | 标签文本（无 value 时作为 value 使用） | `string \| number \| boolean` | —       |
| disabled | 是否禁用                               | `boolean`                     | `false` |
| name     | 原生 `name` 属性                       | `string`                      | —       |

### RadioButton Slots

| 插槽名  | 说明       |
| ------- | ---------- |
| default | 自定义内容 |

### 44px Touch Target

To retain the compact weight and horizontal padding of `size="small"` while meeting the mobile 44px touch height, use the public modifier class on `el-radio-group`:

```vue
<el-radio-group class="fsus-radio-group--touch" size="small">
  <el-radio-button value="latest">最新</el-radio-button>
  <el-radio-button value="hot">热门</el-radio-button>
</el-radio-group>
```

This class uses the shared `--fsus-control-height` token for the minimum height and centers content vertically and horizontally. Consumers do not need to override internals with `:deep()` or `.el-radio-button__inner`.
