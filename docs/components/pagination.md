# Pagination 分页

当数据量过多时，使用分页将数据分隔展示。

> 💡 **运行示例**：启动 demo-app（`pnpm dev`，端口 5173）查看交互效果。

---

## 基础用法

通过 `layout` 属性组合各功能模块（逗号分隔）：`prev`（上一页）、`pager`（页码列表）、`next`（下一页）、`jumper`（跳转输入框）、`total`（总条数）、`sizes`（每页条数选择器）、`->`（右对齐分隔符）。

## 带背景色

设置 `background` 属性使按钮带有背景色。

## 小型分页

设置 `size="small"` 使用小型分页，适合空间有限的场景。

## 只有一页时隐藏

设置 `hide-on-single-page` 当只有一页时自动隐藏分页组件。

## 容器驱动的响应式优先级

`responsive="auto"` 按组件自身宽度收敛，而不是读取 viewport：

- `<360px` 仅保留上一页、当前页/总页数、下一页；
- `360–559px` 使用紧凑 pager，并将总数放入独立信息区；
- `560–767px` 显示完整导航，并在 total 与 sizes 中优先 total；
- `>=768px` 显示 layout 声明的完整导航与设置。

低优先级控件使用 `display:none` 离开 Tab 顺序；导航 DOM 始终先于说明和
设置区。所有导航动作保持至少 `40×40px`。

## 完整示例

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

> **提示**：必须定义 `total` 或 `page-count` 之一；若使用 `v-model:current-page` / `v-model:page-size`，必须同时监听对应更新事件，否则分页不工作。

### Events

| 事件名         | 说明                       | 回调参数                                          |
| -------------- | -------------------------- | ------------------------------------------------- |
| size-change    | 每页条数改变时触发         | `(value: number) => void`                         |
| current-change | 当前页改变时触发           | `(value: number) => void`                         |
| change         | 当前页或每页条数改变时触发 | `(currentPage: number, pageSize: number) => void` |
| prev-click     | 点击上一页按钮时触发       | `(value: number) => void`                         |
| next-click     | 点击下一页按钮时触发       | `(value: number) => void`                         |

> **提示**：推荐使用 `v-model` 双向绑定而非上述事件。

### Slots

| 插槽名  | 说明                                    |
| ------- | --------------------------------------- |
| default | 自定义内容，需在 `layout` 中声明 `slot` |
