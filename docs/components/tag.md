# Tag

For labeling and selection.

## Public Preview

This is a preview public component. See [API stability](../api-stability.md#stability-levels)
and the shared [theme and motion contracts](../theme/tokens.md). A closable
tag needs a contextual close control, and a selectable tag must not communicate
selection through color alone. Tag is not a form control; synchronize submitted
values with Checkbox, Select, or application state.

> See the [Playground](../playground.md) for runnable component examples.

---

## Basic Usage

Use `type` for the tag type and `color` for its background.

Tag preserves the supplied text's case and letter spacing, which suits mixed-language (混合语言) and code-like labels such as `状态 APIv2`, `zh-CN Ready`, and `sha-1:AbC123`. For an uppercase appearance, consumers must explicitly add `.is-uppercase` or `data-fsus-tag-uppercase="true"`; default styles must not rewrite user text.

## Removable Tags

Set `closable` to `true` to show a close icon and emit `close` when clicked; set `disable-transitions` to disable animation.

## Dynamic Editing

Listen for `close` to add or remove tags dynamically.

## Sizes

Set the tag size with `size`: `large`, `default`, or `small`.

## Themes

Set `effect` to `light` (default), `dark`, or `plain`.

## Rounded Corners

Set `round` for a pill-shaped tag.

## Selectable Tags (CheckTag)

For selectable tags, use `el-check-tag` and bind selection with `v-model:checked`.

---

## Tag API

### Tag Attributes

| 属性名              | 说明           | 类型                                                        | 默认值    |
| ------------------- | -------------- | ----------------------------------------------------------- | --------- |
| type                | 类型           | `'primary' \| 'success' \| 'info' \| 'warning' \| 'danger'` | `primary` |
| closable            | 是否可关闭     | `boolean`                                                   | `false`   |
| disable-transitions | 是否禁用动画   | `boolean`                                                   | `false`   |
| hit                 | 是否有高亮边框 | `boolean`                                                   | `false`   |
| color               | 背景色         | `string`                                                    | —         |
| size                | 尺寸           | `'large' \| 'default' \| 'small'`                           | —         |
| effect              | 主题           | `'dark' \| 'light' \| 'plain'`                              | `light`   |
| round               | 是否圆角       | `boolean`                                                   | `false`   |

### Tag Events

| 事件名 | 说明               | 回调参数                    |
| ------ | ------------------ | --------------------------- |
| click  | 点击标签时触发     | `(evt: MouseEvent) => void` |
| close  | 点击关闭按钮时触发 | `(evt: MouseEvent) => void` |

### Tag Slots

| 插槽名  | 说明       |
| ------- | ---------- |
| default | 自定义内容 |

---

## CheckTag API

### CheckTag Attributes

| 属性名                    | 说明     | 类型                                                        | 默认值    |
| ------------------------- | -------- | ----------------------------------------------------------- | --------- |
| checked / v-model:checked | 是否选中 | `boolean`                                                   | `false`   |
| disabled                  | 是否禁用 | `boolean`                                                   | `false`   |
| type                      | 类型     | `'primary' \| 'success' \| 'info' \| 'warning' \| 'danger'` | `primary` |

### CheckTag Events

| 事件名 | 说明               | 回调参数                   |
| ------ | ------------------ | -------------------------- |
| change | 选中状态改变时触发 | `(value: boolean) => void` |

### CheckTag Slots

| 插槽名  | 说明       |
| ------- | ---------- |
| default | 自定义内容 |
