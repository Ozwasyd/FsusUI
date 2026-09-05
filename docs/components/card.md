# Card

Groups information in a card container.

> See the [Playground](../playground.md) for runnable component examples.

---

## Basic Usage

Card has `header`, `body`, and `footer` regions. The latter two are optional and
receive content through named slots.

## Simple Card

Without the `header` slot, only the content region is rendered.

## With Images

Use `body-style` to customize the body, for example alongside an image component.

## Shadow

Use `shadow` to show the shadow `always`, on `hover`, or `never`.

---

## API

### Attributes

| 属性名       | 说明                                        | 类型                             | 默认值  |
| ------------ | ------------------------------------------- | -------------------------------- | ------- |
| header       | 卡片标题（也可通过 `#header` 插槽传入）     | `string`                         | —       |
| footer       | 卡片底部内容（也可通过 `#footer` 插槽传入） | `string`                         | —       |
| body-style   | 卡片主体区域的 CSS 样式                     | `CSSProperties`                  | —       |
| header-class | 卡片头部自定义 class                        | `string`                         | —       |
| body-class   | 卡片主体自定义 class                        | `string`                         | —       |
| footer-class | 卡片底部自定义 class                        | `string`                         | —       |
| shadow       | 阴影显示时机                                | `'always' \| 'hover' \| 'never'` | `never` |

### Slots

| 插槽名  | 说明         |
| ------- | ------------ |
| default | 卡片主体内容 |
| header  | 卡片头部内容 |
| footer  | 卡片底部内容 |
