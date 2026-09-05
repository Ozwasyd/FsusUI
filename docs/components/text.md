# Text

A semantic text component.

> See the [Playground](../playground.md) for runnable component examples.

---

## Basic Usage

Use `type` to define the text type.

## Sizes

Set the text size with `size`: `large`, `default`, or `small`.

## Text Truncation

Set `truncated` to show an ellipsis when text exceeds the container or `max-width`.
Use `line-clamp` for multi-line truncation.

## Custom Tag

Use `tag` to override the rendered HTML element (default `span`).

---

## API

### Attributes

| 属性名 | 说明 | 类型 | 默认值 |
|--------|------|------|--------|
| type | 文本类型 | `'primary' \| 'success' \| 'warning' \| 'danger' \| 'info'` | — |
| size | 文本尺寸 | `'large' \| 'default' \| 'small'` | `default` |
| truncated | 是否超出省略 | `boolean` | `false` |
| line-clamp | 最大行数（多行省略） | `string \| number` | — |
| tag | 自定义元素标签 | `string` | `span` |

### Slots

| 插槽名 | 说明 |
|--------|------|
| default | 文本内容 |
