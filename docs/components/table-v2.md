# TableV2 (Beta)

Uses virtual scrolling for high-performance rendering of large tables.

> **Tip:** This component is still experimental and its API may change. For very large data sets, network and memory are the real bottlenecks; combine it with pagination and filtering.

> See the [Playground](../playground.md) for runnable component examples.

---

## Differences from Table V1

| 特性            | TableV1                                                                  | TableV2                                         |
| --------------- | ------------------------------------------------------------------------ | ----------------------------------------------- |
| 渲染方式        | 原生 `<table>`                                                           | 虚拟滚动（Canvas Grid）                         |
| 大数据支持      | 保留完整 table/slot/tree 语义；显式选择 identity/version/manual 数据边界 | 只渲染可见窗口，适合 DOM 行数成为主要成本的场景 |
| colspan/rowspan | 原生支持                                                                 | 需自定义行渲染器实现                            |
| 功能集          | 丰富                                                                     | 轻量，按需自定义                                |

Do not switch based only on a fixed row count. Use Table's `getLayoutDiagnostics()` and same-machine benchmarks to determine whether cost comes from data tracking, sorting, or DOM/layout; migrate to TableV2 when visible-row DOM and complex cells consistently dominate frame time. Both components should use a stable `row-key`; preserve sort/filter state as keys or row indexes and materialize row objects only at event and render boundaries to avoid two selection semantics during migration.

## Basic Usage

The required props are `width`, `height`, and `columns`.

```vue
<el-table-v2 :columns="columns" :data="data" :width="700" :height="400" />
```

## Auto Size

Wrap it in `AutoResizer` to follow parent-container size changes automatically.

> **Tip:** The `AutoResizer` parent must have a fixed height.

## Fixed Columns

Set `fixed: true` (or `FixedDir.LEFT` / `FixedDir.RIGHT`) in a column definition to fix a column.

## Dynamic Row Height

Set `estimated-row-height` to enable dynamic row heights; the component measures each row while rendering.

---

## API

### TableV2 Attributes

| 属性名                                        | 说明                                 | 类型                         | 默认值      |
| --------------------------------------------- | ------------------------------------ | ---------------------------- | ----------- |
| columns **（必填）**                          | 列定义数组                           | `Column[]`                   | —           |
| data **（必填）**                             | 数据数组                             | `Data[]`                     | `[]`        |
| width **（必填）**                            | 表格宽度（px）                       | `number`                     | —           |
| height **（必填）**                           | 表格高度（px）                       | `number`                     | —           |
| max-height                                    | 表格最大高度                         | `number`                     | —           |
| row-height                                    | 行高（px）                           | `number`                     | `50`        |
| header-height                                 | 表头高度（px），传数组时渲染多行表头 | `number \| number[]`         | `50`        |
| footer-height                                 | 页脚高度（px）                       | `number`                     | `0`         |
| cache                                         | 提前渲染的行数（提升滚动性能）       | `number`                     | `2`         |
| estimated-row-height                          | 动态行高的估计值（px）               | `number`                     | —           |
| row-key                                       | 行唯一键字段                         | `string \| symbol \| number` | `id`        |
| fixed                                         | 是否固定列宽                         | `boolean`                    | `false`     |
| scrollbar-always-on                           | 是否始终显示滚动条                   | `boolean`                    | `false`     |
| sort-by                                       | 单列排序指示                         | `SortBy`                     | `{}`        |
| sort-state                                    | 多列排序指示                         | `SortState`                  | `undefined` |
| expand-column-key                             | 可展开列的 key                       | `string`                     | —           |
| expanded-row-keys / v-model:expanded-row-keys | 已展开行的 key 数组                  | `KeyType[]`                  | —           |
| fixed-data                                    | 固定在表头下方的置顶行数据           | `Data`                       | —           |
| row-class                                     | 行自定义 class                       | `string \| Function`         | —           |
| row-event-handlers                            | 行事件处理器集合                     | `RowEventHandlers`           | —           |
| h-scrollbar-size                              | 水平滚动条宽度（px）                 | `number`                     | `6`         |
| v-scrollbar-size                              | 垂直滚动条宽度（px）                 | `number`                     | `6`         |
| indent-size                                   | 树形数据水平缩进（px）               | `number`                     | `12`        |

### Column Attribute

| 属性名             | 说明                              | 类型                                                  | 默认值  |
| ------------------ | --------------------------------- | ----------------------------------------------------- | ------- |
| key **（必填）**   | 列唯一标识                        | `KeyType`                                             | —       |
| dataKey            | 从数据行中取值的字段名            | `KeyType`                                             | —       |
| width **（必填）** | 列宽（px）                        | `number`                                              | —       |
| title              | 表头默认文字                      | `string`                                              | —       |
| align              | 单元格内容对齐                    | `'left' \| 'center' \| 'right'`                       | `left`  |
| fixed              | 固定方向                          | `boolean \| 'left' \| 'right'`                        | `false` |
| sortable           | 是否可排序                        | `boolean`                                             | —       |
| minWidth           | 最小宽度                          | `number`                                              | —       |
| maxWidth           | 最大宽度                          | `number`                                              | —       |
| flexGrow           | CSS flex-grow（非固定表格有效）   | `number`                                              | `0`     |
| flexShrink         | CSS flex-shrink（非固定表格有效） | `number`                                              | `1`     |
| hidden             | 是否隐藏                          | `boolean`                                             | —       |
| cellRenderer       | 自定义单元格渲染器                | `VueComponent \| (props: CellRenderProps) => VNode`   | —       |
| headerCellRenderer | 自定义表头渲染器                  | `VueComponent \| (props: HeaderRenderProps) => VNode` | —       |

### TableV2 Events

| 事件名               | 说明                  | 回调参数                           |
| -------------------- | --------------------- | ---------------------------------- |
| column-sort          | 列排序时触发          | `ColumnSortParam`                  |
| expanded-rows-change | 展开行变化时触发      | `KeyType[]`                        |
| end-reached          | 滚动到末尾时触发      | `(remainDistance: number) => void` |
| scroll               | 滚动时触发            | `ScrollParams`                     |
| rows-rendered        | 行渲染完成时触发      | `RowsRenderedParams`               |
| row-expand           | 树节点展开/折叠时触发 | `RowExpandParams`                  |

### TableV2 Slots

| 插槽名      | 说明                 |
| ----------- | -------------------- |
| cell        | 自定义单元格         |
| header      | 自定义表头行         |
| header-cell | 自定义表头单元格     |
| row         | 自定义行             |
| footer      | 自定义页脚           |
| empty       | 空数据时展示的内容   |
| overlay     | 覆盖层（如 loading） |

### TableV2 Exposes

| 名称         | 说明               | 类型                                                                        |
| ------------ | ------------------ | --------------------------------------------------------------------------- |
| scrollTo     | 滚动到指定位置     | `(param: { scrollLeft?: number, scrollTop?: number }) => void`              |
| scrollToLeft | 水平滚动到指定位置 | `(scrollLeft: number) => void`                                              |
| scrollToTop  | 垂直滚动到指定位置 | `(scrollTop: number) => void`                                               |
| scrollToRow  | 滚动到指定行       | `(row: number, strategy?: 'center' \| 'end' \| 'start' \| 'smart') => void` |
