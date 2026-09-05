# Input

Accepts character input from a mouse or keyboard.

## Public Preview

This is a preview public component. See [API stability](../api-stability.md#stability-levels)
for the change policy and the shared [theme token contract](../theme/tokens.md).
Give each input a name through an `el-form-item` label, `aria-label`, or
`aria-labelledby`; clear and password-toggle controls must remain focusable and
readable. `formatter` and `parser` apply only to text-like inputs, while
`type="number"` retains browser behavior and is not strict numeric validation.

> See the [Playground](../playground.md) for runnable component examples.

---

## Basic Usage

Bind the input value with `v-model`.

## Disabled State

Use `disabled` to disable the input.

## Clearable

Set `clearable` to add a clear button; `textarea` inputs support it as well.

## Password Input

Set `show-password` to create an input with a password-visibility toggle.

## Inputs with Icons

Add icons with `prefix-icon` / `suffix-icon` or the named `prefix` / `suffix` slots.

## Text Area

Set `type="textarea"` for a native `textarea`; use `rows` for its initial height. Set `autosize` for automatic height and optionally `{ minRows, maxRows }` bounds.

For article, knowledge-base, and similar editing tasks, use
`type="textarea" textarea-variant="editor-title"`. This public variant gives FsusUI
ownership of title size, approved weight, mobile reduction, count placement, and
focus ring. Consumers only map product colors through the public
`--fsus-editor-title-*` variables on the component root; do not override internals
with `:deep()` or `.el-textarea__inner`. The default `default` value keeps the
standard textarea appearance.

## Composite Input

Use `prepend` / `append` slots to add elements such as labels or buttons before or after the input.

## Sizes

Set the size with `size`: `large`, `default`, or `small`.

## Character Count

Set `maxlength`, then enable `show-word-limit` to display a character count. Use `word-limit-position` for `inside` or `outside` placement.

## Formatting

Use `formatter` and `parser` to format and parse displayed values (only for `text` inputs).

---

## API

### Attributes

| 属性名                | 说明                                                                                                               | 类型                                                                                      | 默认值    |
| --------------------- | ------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- | --------- |
| type                  | 输入框类型，参考 MDN                                                                                               | `'text' \| 'textarea' \| 'password' \| 'number' \| 'email' \| 'search' \| 'tel' \| 'url'` | `text`    |
| model-value / v-model | 绑定值                                                                                                             | `string \| number`                                                                        | —         |
| maxlength             | 原生 `maxlength` 属性                                                                                              | `string \| number`                                                                        | —         |
| minlength             | 原生 `minlength` 属性                                                                                              | `string \| number`                                                                        | —         |
| show-word-limit       | 是否显示字数统计（需配合 `maxlength`）                                                                             | `boolean`                                                                                 | `false`   |
| word-limit-position   | 字数统计的显示位置                                                                                                 | `'inside' \| 'outside'`                                                                   | `inside`  |
| placeholder           | 输入框占位符                                                                                                       | `string`                                                                                  | —         |
| clearable             | 是否显示清空按钮                                                                                                   | `boolean`                                                                                 | `false`   |
| formatter             | 输入框显示格式化函数                                                                                               | `(value: string \| number) => string`                                                     | —         |
| parser                | 从格式化输入中提取原始值                                                                                           | `(value: string) => string`                                                               | —         |
| show-password         | 是否显示切换密码图标                                                                                               | `boolean`                                                                                 | `false`   |
| disabled              | 是否禁用                                                                                                           | `boolean`                                                                                 | `false`   |
| size                  | 输入框尺寸（不适用于 textarea）                                                                                    | `'large' \| 'default' \| 'small'`                                                         | —         |
| prefix-icon           | 前缀图标组件                                                                                                       | `string \| Component`                                                                     | —         |
| suffix-icon           | 后缀图标组件                                                                                                       | `string \| Component`                                                                     | —         |
| rows                  | textarea 初始行数                                                                                                  | `number`                                                                                  | `2`       |
| autosize              | textarea 自适应高度                                                                                                | `boolean \| { minRows?: number, maxRows?: number }`                                       | `false`   |
| textarea-variant      | textarea 语义外观；`editor-title` 用于编辑任务标题                                                                 | `'default' \| 'editor-title'`                                                             | `default` |
| autocomplete          | 原生 `autocomplete` 属性                                                                                           | `string`                                                                                  | `off`     |
| name                  | 原生 `name` 属性                                                                                                   | `string`                                                                                  | —         |
| readonly              | 原生 `readonly` 属性                                                                                               | `boolean`                                                                                 | `false`   |
| resize                | textarea 缩放方向                                                                                                  | `'none' \| 'both' \| 'horizontal' \| 'vertical'`                                          | —         |
| autofocus             | 原生 `autofocus` 属性                                                                                              | `boolean`                                                                                 | `false`   |
| tabindex              | 输入框 tabindex                                                                                                    | `string \| number`                                                                        | —         |
| validate-event        | 是否触发表单校验                                                                                                   | `boolean`                                                                                 | `true`    |
| input-style           | 输入框或 textarea 的 style                                                                                         | `string \| CSSProperties \| CSSProperties[]`                                              | `{}`      |
| csp-safe              | 禁止 container/input/textarea/count 的 inline style 绑定；autosize 与自定义 input-style 由 consumer 的静态样式接管 | `boolean`                                                                                 | `false`   |
| count-graphemes       | 自定义字符计数函数（设置后 `maxlength`/`minlength` 不再生效）                                                      | `(value: string) => number`                                                               | —         |

### Events

| 事件名     | 说明                           | 回调参数                            |
| ---------- | ------------------------------ | ----------------------------------- |
| blur       | 失焦时触发                     | `(event: FocusEvent) => void`       |
| focus      | 聚焦时触发                     | `(event: FocusEvent) => void`       |
| change     | 失焦或按回车时触发（值改变时） | `(value: string \| number) => void` |
| input      | 输入值变化时触发               | `(value: string \| number) => void` |
| clear      | 点击清空按钮时触发             | `() => void`                        |
| keydown    | 按键按下时触发                 | `(event: KeyboardEvent) => void`    |
| mouseenter | 鼠标移入时触发                 | `(event: MouseEvent) => void`       |
| mouseleave | 鼠标移出时触发                 | `(event: MouseEvent) => void`       |

### Slots

| 插槽名        | 说明                                               |
| ------------- | -------------------------------------------------- |
| prefix        | 输入框头部内容（非 textarea）                      |
| suffix        | 输入框尾部内容（非 textarea）                      |
| prepend       | 输入框前置内容（非 textarea）                      |
| append        | 输入框后置内容（非 textarea）                      |
| password-icon | 密码可见切换图标（`show-password` 为 true 时有效） |

### Exposes

| 名称            | 说明                   | 类型                                           |
| --------------- | ---------------------- | ---------------------------------------------- |
| blur            | 使输入框失焦           | `() => void`                                   |
| clear           | 清空输入值             | `() => void`                                   |
| focus           | 使输入框聚焦           | `() => void`                                   |
| input           | 原生 input 元素        | `Ref<HTMLInputElement>`                        |
| ref             | input 或 textarea 元素 | `Ref<HTMLInputElement \| HTMLTextAreaElement>` |
| resizeTextarea  | 重新计算 textarea 尺寸 | `() => void`                                   |
| select          | 选中输入框中的文字     | `() => void`                                   |
| textarea        | 原生 textarea 元素     | `Ref<HTMLTextAreaElement>`                     |
| passwordVisible | 密码是否可见           | `Ref<boolean>`                                 |

---

## Frequently Asked Questions

**Why does the input become wider when `clearable` is set?**

`el-input` has no default width, so the clear icon can expand it. Give the input an explicit width:

```vue
<el-input v-model="input" clearable style="width: 200px" />
```
