# Input 输入框

通过鼠标或键盘输入字符。

> 💡 **运行示例**：启动 demo-app（`pnpm dev`，端口 5173）查看交互效果。

---

## 基础用法

使用 `v-model` 绑定输入值。

## 禁用状态

通过 `disabled` 属性禁用输入框。

## 可清空

通过 `clearable` 属性为输入框添加清空按钮（`textarea` 类型同样支持）。

## 密码框

通过 `show-password` 属性创建可切换显示密码的输入框。

## 带图标的输入框

通过 `prefix-icon` 和 `suffix-icon` 属性，或使用 `prefix` / `suffix` 具名插槽添加图标。

## 文本域

设置 `type="textarea"` 改为原生 `textarea`，通过 `rows` 控制初始行高。使用 `autosize` 可自适应高度，可设置 `{ minRows, maxRows }` 限制行数范围。

## 复合型输入框

使用 `prepend` / `append` 插槽在输入框前后追加元素（标签或按钮）。

## 尺寸

通过 `size` 属性设置尺寸：`large`、`default`、`small`。

## 字数统计

设置 `maxlength` 后，再开启 `show-word-limit` 显示字数统计，可通过 `word-limit-position` 控制显示位置（`inside` / `outside`）。

## 格式化

通过 `formatter` 和 `parser` 属性实现输入值的展示格式化与解析（仅 `text` 类型有效）。

---

## API

### Attributes

| 属性名 | 说明 | 类型 | 默认值 |
|--------|------|------|--------|
| type | 输入框类型，参考 MDN | `'text' \| 'textarea' \| 'password' \| 'number' \| 'email' \| 'search' \| 'tel' \| 'url'` | `text` |
| model-value / v-model | 绑定值 | `string \| number` | — |
| maxlength | 原生 `maxlength` 属性 | `string \| number` | — |
| minlength | 原生 `minlength` 属性 | `string \| number` | — |
| show-word-limit | 是否显示字数统计（需配合 `maxlength`） | `boolean` | `false` |
| word-limit-position | 字数统计的显示位置 | `'inside' \| 'outside'` | `inside` |
| placeholder | 输入框占位符 | `string` | — |
| clearable | 是否显示清空按钮 | `boolean` | `false` |
| formatter | 输入框显示格式化函数 | `(value: string \| number) => string` | — |
| parser | 从格式化输入中提取原始值 | `(value: string) => string` | — |
| show-password | 是否显示切换密码图标 | `boolean` | `false` |
| disabled | 是否禁用 | `boolean` | `false` |
| size | 输入框尺寸（不适用于 textarea） | `'large' \| 'default' \| 'small'` | — |
| prefix-icon | 前缀图标组件 | `string \| Component` | — |
| suffix-icon | 后缀图标组件 | `string \| Component` | — |
| rows | textarea 初始行数 | `number` | `2` |
| autosize | textarea 自适应高度 | `boolean \| { minRows?: number, maxRows?: number }` | `false` |
| autocomplete | 原生 `autocomplete` 属性 | `string` | `off` |
| name | 原生 `name` 属性 | `string` | — |
| readonly | 原生 `readonly` 属性 | `boolean` | `false` |
| resize | textarea 缩放方向 | `'none' \| 'both' \| 'horizontal' \| 'vertical'` | — |
| autofocus | 原生 `autofocus` 属性 | `boolean` | `false` |
| tabindex | 输入框 tabindex | `string \| number` | — |
| validate-event | 是否触发表单校验 | `boolean` | `true` |
| input-style | 输入框或 textarea 的 style | `string \| CSSProperties \| CSSProperties[]` | `{}` |
| count-graphemes | 自定义字符计数函数（设置后 `maxlength`/`minlength` 不再生效） | `(value: string) => number` | — |

### Events

| 事件名 | 说明 | 回调参数 |
|--------|------|---------|
| blur | 失焦时触发 | `(event: FocusEvent) => void` |
| focus | 聚焦时触发 | `(event: FocusEvent) => void` |
| change | 失焦或按回车时触发（值改变时） | `(value: string \| number) => void` |
| input | 输入值变化时触发 | `(value: string \| number) => void` |
| clear | 点击清空按钮时触发 | `() => void` |
| keydown | 按键按下时触发 | `(event: KeyboardEvent) => void` |
| mouseenter | 鼠标移入时触发 | `(event: MouseEvent) => void` |
| mouseleave | 鼠标移出时触发 | `(event: MouseEvent) => void` |

### Slots

| 插槽名 | 说明 |
|--------|------|
| prefix | 输入框头部内容（非 textarea） |
| suffix | 输入框尾部内容（非 textarea） |
| prepend | 输入框前置内容（非 textarea） |
| append | 输入框后置内容（非 textarea） |
| password-icon | 密码可见切换图标（`show-password` 为 true 时有效） |

### Exposes

| 名称 | 说明 | 类型 |
|------|------|------|
| blur | 使输入框失焦 | `() => void` |
| clear | 清空输入值 | `() => void` |
| focus | 使输入框聚焦 | `() => void` |
| input | 原生 input 元素 | `Ref<HTMLInputElement>` |
| ref | input 或 textarea 元素 | `Ref<HTMLInputElement \| HTMLTextAreaElement>` |
| resizeTextarea | 重新计算 textarea 尺寸 | `() => void` |
| select | 选中输入框中的文字 | `() => void` |
| textarea | 原生 textarea 元素 | `Ref<HTMLTextAreaElement>` |
| passwordVisible | 密码是否可见 | `Ref<boolean>` |

---

## 常见问题

**为什么设置 `clearable` 后输入框宽度变宽？**

`el-input` 没有默认宽度，清空图标出现时会撑宽组件。解决方法是为输入框设置明确宽度：

```vue
<el-input v-model="input" clearable style="width: 200px" />
```
