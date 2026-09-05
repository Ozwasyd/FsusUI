# Pagination

Use pagination to split large data sets into separate views.

> See the [Playground](../playground.md) for runnable component examples.

---

## Basic Usage

Use the comma-separated `layout` prop to compose modules: `prev`, `pager`, `next`, `jumper`, `total`, `sizes`, and `->` (right-aligned separator).

## Background Color

Set `background` to give the buttons a background.

## Compact Pagination

Set `size="small"` for compact pagination when space is limited.

## Hide When There Is One Page

Set `hide-on-single-page` to hide pagination automatically when there is only one page.

## Container-Driven Responsive Priority

`responsive="auto"` adapts to the component's own width rather than the viewport:

- `<360px`: keep only previous, current/total pages, and next;
- `360–559px`: use a compact pager and put the total in a separate information region;
- `560–767px`: show full navigation, prioritizing total over sizes;
- `>=768px`: show the complete navigation and settings declared by `layout`.

Low-priority controls use `display:none` and leave the Tab order. Navigation DOM always precedes the description and settings regions. Every navigation action remains at least `40×40px`.

## Complete Example

```vue
<el-pagination
  v-model:current-page="currentPage"
  v-model:page-size="pageSize"
  :page-sizes="[10, 20, 50, 100]"
  :total="total"
  layout="total, sizes, prev, pager, next, jumper"
/>
```

---

## API

### Attributes

| 属性名                              | 说明                                          | 类型                                              | 默认值                                 |
| ----------------------------------- | --------------------------------------------- | ------------------------------------------------- | -------------------------------------- |
| current-page / v-model:current-page | 当前页码                                      | `number`                                          | —                                      |
| default-current-page                | 当前页码默认值（未绑定时生效，等同于设置 1）  | `number`                                          | —                                      |
| page-size / v-model:page-size       | 每页条数                                      | `number`                                          | —                                      |
| default-page-size                   | 每页条数默认值（未绑定时生效，等同于设置 10） | `number`                                          | —                                      |
| total                               | 总条目数（`sizes` 显示时必须设置）            | `number`                                          | —                                      |
| page-count                          | 总页数，与 `total` 二选一（page-count 优先）  | `number`                                          | —                                      |
| pager-count                         | 最多显示的页码按钮数，超出时折叠              | `5 \| 7 \| 9 \| 11 \| 13 \| 15 \| 17 \| 19 \| 21` | `7`                                    |
| layout                              | 功能模块布局（逗号分隔）                      | `string`                                          | `prev, pager, next, jumper, ->, total` |
| page-sizes                          | 每页条数选项                                  | `number[]`                                        | `[10, 20, 30, 40, 50, 100]`            |
| prev-text                           | 上一页按钮文字                                | `string`                                          | `''`                                   |
| prev-icon                           | 上一页按钮图标（优先级低于 prev-text）        | `string \| Component`                             | `ArrowLeft`                            |
| next-text                           | 下一页按钮文字                                | `string`                                          | `''`                                   |
| next-icon                           | 下一页按钮图标（优先级低于 next-text）        | `string \| Component`                             | `ArrowRight`                           |
| background                          | 是否给页码按钮加背景色                        | `boolean`                                         | `false`                                |
| disabled                            | 是否禁用                                      | `boolean`                                         | `false`                                |
| size                                | 尺寸                                          | `'large' \| 'default' \| 'small'`                 | `'default'`                            |
| hide-on-single-page                 | 只有一页时是否隐藏                            | `boolean`                                         | `false`                                |
| teleported                          | 下拉框是否挂载到 body                         | `boolean`                                         | `true`                                 |
| responsive                          | 容器驱动的响应式布局                          | `'off' \| 'auto'`                                 | `off`                                  |
| aria-label                          | responsive 导航区可访问名称                   | `string`                                          | `Pagination`                           |

> **Tip:** Define either `total` or `page-count`. When using `v-model:current-page` / `v-model:page-size`, also listen for the matching update event or pagination will not work.

### Events

| 事件名         | 说明                       | 回调参数                                          |
| -------------- | -------------------------- | ------------------------------------------------- |
| size-change    | 每页条数改变时触发         | `(value: number) => void`                         |
| current-change | 当前页改变时触发           | `(value: number) => void`                         |
| change         | 当前页或每页条数改变时触发 | `(currentPage: number, pageSize: number) => void` |
| prev-click     | 点击上一页按钮时触发       | `(value: number) => void`                         |
| next-click     | 点击下一页按钮时触发       | `(value: number) => void`                         |

> **Tip:** Prefer two-way `v-model` binding over the events above.

### Slots

| 插槽名  | 说明                                    |
| ------- | --------------------------------------- |
| default | 自定义内容，需在 `layout` 中声明 `slot` |
