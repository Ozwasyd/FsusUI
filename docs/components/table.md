# Table

Displays structurally similar records and supports sorting, filtering, comparison, and other custom actions.

## Public Preview

This is a preview public component; the optional WASM path is experimental. See
[API stability](../api-stability.md#stability-levels) and the shared [theme and
motion contracts](../theme/tokens.md). Give each table a contextual heading and
keep selection, expansion, and custom-cell controls keyboard accessible. Index
acceleration covers local `number` and ASCII-string sorting only; locale-aware,
CJK, mixed, custom-comparator, server-side, and paginated sorting use the
semantic JavaScript path.

## WASM Acceleration

FsusUI's large-data path extracts only primitive column data, then returns stable `Uint32Array` row indexes from a persistent WASM buffer in a Worker. Equal values are stably sorted by original index, and full row objects never enter the Worker; objects materialize at the public array boundary only after the latest generation returns. A new sort cancels the prior task, and stale or post-unmount results cannot write to Table; unmount also releases the Worker/WASM session. The strategy records initialization, copy, compute, mapping, and commit timings, then chooses Worker/WASM or yieldable chunked JS dynamically rather than using a fixed 5K threshold.

After WASM memory growth, old TypedArray views become invalid. The implementation therefore persists only pointer/capacity and reads the current heap view for each operation. Releasing the component or pool also releases input/output/index buffers. locale-aware values, CJK, mixed values, `sort-method`, and `sort-by` retain JS semantics; ASCII byte order is never used as a substitute for locale sorting.

> **Note:** WASM acceleration needs no extra configuration. Rebuilding the WASM module from source requires Emscripten 5.0.4.

> See the [Playground](../playground.md) for runnable component examples.

## Large-Data Change Strategy

`data-change-strategy` defines when Table receives consumer data changes:

| 策略       | 刷新条件                      | 适用场景                                    |
| ---------- | ----------------------------- | ------------------------------------------- |
| `identity` | `data` 数组 identity 改变     | 推荐的大数据默认写法；更新后替换数组        |
| `version`  | `data-version` 改变           | 数据容器稳定、由 store/reducer 提交显式版本 |
| `manual`   | 调用 Table 实例的 `refresh()` | 批处理、外部缓存或事务式提交                |
| `deep`     | 数组或任意嵌套行字段改变      | 兼容旧行为；仍是当前默认值                  |

`deep` remains the default so existing applications do not silently stop refreshing after an upgrade; new large-data pages should explicitly choose `identity`. `identity`, `version`, and `manual` use shallow/raw boundaries and do not subscribe to every row object. Content-only commits do not recompute column structure, and repeated commits in one microtask form one layout batch.

```vue
<el-table
  ref="table"
  :data="rows"
  data-change-strategy="version"
  :data-version="rowsVersion"
  row-key="id"
/>
```

Sorting and filtering keep a `Uint32Array` row-index view; selection uses a `row-key` Map. Public boundaries such as `selection-change` and `getSelectionRows()` still return row-object arrays. `getLayoutDiagnostics()` returns the latest layout's `lastReasons`, pending reason, and flush count, distinguishing `data-*`, `sort`, `filter`, `columns`, and `container-resize`.

---

## Basic Usage

Pass the data array through `data`; `el-table-column` uses `prop` for the field, `label` for the column name, and `width` for its width.

## Striped Rows

Set `stripe` to `true` to alternate row colors and distinguish rows.

## With Border

Set `border` to `true` to show vertical borders.

## Fixed Header

Set table height with `height`; the header stays fixed while the content scrolls when it overflows.

## Fixed Columns

Set `fixed` (`true` / `'left'` / `'right'`) on `el-table-column` to fix a column.

## Sorting

Set `sortable` on a column to enable sorting. Use `sort-method` / `sort-by` for custom logic. For server sorting, set `sortable="custom"` and fetch data in response to `sort-change`.

> Worker/WASM activation depends on the device and this session's end-to-end history; row count alone is not a fixed switch.

## Filtering

Set a `filters` array and `filter-method` on `el-table-column` for column filtering.

## Custom Column Templates

Use the `default` slot's `row`, `column`, and `$index` values to render custom content.

## Responsive Column Projection

With `responsive="auto"` or `responsive="priority"`, below `640px` the main row keeps only columns with `priority="primary"`. `secondary` and `detail` columns are not discarded: each row's 40px expand action projects them into a flat label/value detail list. Without an explicit priority, the first ordinary data column is primary and the rest are secondary; selection, index, expand, and other feature columns remain.

Set `responsive="scroll"` to explicitly retain a wide table. The scroller is focusable and named, shows a right-edge fade before the first horizontal scroll, and supports the keyboard left/right keys.

## Multiple Selection

Add a `type="selection"` column for multiple selection; manage state with methods such as `toggleRowSelection` and `clearSelection`.

## Expandable Rows

Add a `type="expand"` column for expandable rows.

## Tree Data

Data with a `children` field renders as a tree (set `row-key`).

## Summary Row

Set `show-summary` to `true` for a summary row; customize it with `summary-method`.

## Merged Rows and Columns

Return `[rowspan, colspan]` from `span-method` to merge cells.

---

## Table API

### Table Attributes

| 属性名                   | 说明                                         | 类型                                                                                 | 默认值                                                                       |
| ------------------------ | -------------------------------------------- | ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| data                     | 表格数据                                     | `any[]`                                                                              | `[]`                                                                         |
| data-change-strategy     | 数据变化提交策略                             | `'identity' \| 'version' \| 'manual' \| 'deep'`                                      | `deep`                                                                       |
| data-version             | `version` 策略的显式版本                     | `string \| number`                                                                   | —                                                                            |
| height                   | 表格高度（数字为 px，字符串赋给 CSS height） | `string \| number`                                                                   | —                                                                            |
| max-height               | 最大高度                                     | `string \| number`                                                                   | —                                                                            |
| stripe                   | 是否有斑马纹                                 | `boolean`                                                                            | `false`                                                                      |
| border                   | 是否有纵向边框                               | `boolean`                                                                            | `false`                                                                      |
| size                     | 表格尺寸                                     | `'' \| 'large' \| 'default' \| 'small'`                                              | —                                                                            |
| fit                      | 列宽是否自适应容器                           | `boolean`                                                                            | `true`                                                                       |
| show-header              | 是否显示表头                                 | `boolean`                                                                            | `true`                                                                       |
| highlight-current-row    | 是否高亮当前行                               | `boolean`                                                                            | `false`                                                                      |
| current-row-key          | 当前行的 key（仅设置时有效）                 | `string \| number`                                                                   | —                                                                            |
| row-class-name           | 行 class 名称                                | `(data: { row, rowIndex }) => string \| string`                                      | —                                                                            |
| row-style                | 行样式                                       | `(data: { row, rowIndex }) => CSSProperties \| CSSProperties`                        | —                                                                            |
| cell-class-name          | 单元格 class 名称                            | `(data: { row, column, rowIndex, columnIndex }) => string \| string`                 | —                                                                            |
| row-key                  | 行数据的 key（树形数据和保留选中状态时必填） | `(row) => string \| string`                                                          | —                                                                            |
| empty-text               | 数据为空时的显示文字                         | `string`                                                                             | `暂无数据`                                                                   |
| default-expand-all       | 是否默认展开所有行                           | `boolean`                                                                            | `false`                                                                      |
| default-sort             | 默认排序列和方向                             | `{ prop: string, order: 'ascending' \| 'descending' }`                               | —                                                                            |
| tooltip-effect           | 溢出 tooltip 主题                            | `'dark' \| 'light'`                                                                  | `dark`                                                                       |
| show-summary             | 是否显示合计行                               | `boolean`                                                                            | `false`                                                                      |
| sum-text                 | 合计行首列文字                               | `string`                                                                             | `合计`                                                                       |
| summary-method           | 自定义合计方法                               | `(data: { columns, data }) => (VNode \| string)[]`                                   | —                                                                            |
| span-method              | 合并行列的方法                               | `(data: { row, column, rowIndex, columnIndex }) => number[] \| { rowspan, colspan }` | —                                                                            |
| indent                   | 树形数据每层的缩进（px）                     | `number`                                                                             | `16`                                                                         |
| lazy                     | 是否懒加载子节点                             | `boolean`                                                                            | `false`                                                                      |
| load                     | 懒加载函数（`lazy` 为 true 时必填）          | `(row, treeNode, resolve) => void`                                                   | —                                                                            |
| tree-props               | 树形配置                                     | `{ hasChildren?, children?, checkStrictly? }`                                        | `{ hasChildren: 'hasChildren', children: 'children', checkStrictly: false }` |
| table-layout             | 表格布局算法                                 | `'fixed' \| 'auto'`                                                                  | `fixed`                                                                      |
| scrollbar-always-on      | 是否始终显示滚动条                           | `boolean`                                                                            | `false`                                                                      |
| show-overflow-tooltip    | 是否溢出时显示 tooltip                       | `boolean \| object`                                                                  | —                                                                            |
| responsive               | 响应式策略                                   | `'none' \| 'auto' \| 'priority' \| 'scroll'`                                         | `none`                                                                       |
| responsive-details-label | 行详情按钮可访问名称                         | `string`                                                                             | `Show row details`                                                           |
| scroll-aria-label        | scroll 模式滚动区可访问名称                  | `string`                                                                             | `Scrollable data table`                                                      |

### Table Events

| 事件名           | 说明                     | 回调参数                                  |
| ---------------- | ------------------------ | ----------------------------------------- |
| select           | 用户点击行复选框时触发   | `(selection, row) => void`                |
| select-all       | 用户点击全选复选框时触发 | `(selection) => void`                     |
| selection-change | 选中项改变时触发         | `(newSelection) => void`                  |
| cell-click       | 点击单元格时触发         | `(row, column, cell, event) => void`      |
| row-click        | 点击行时触发             | `(row, column, event) => void`            |
| row-dblclick     | 双击行时触发             | `(row, column, event) => void`            |
| header-click     | 点击列头时触发           | `(column, event) => void`                 |
| sort-change      | 排序条件改变时触发       | `({ column, prop, order }) => void`       |
| filter-change    | 筛选条件改变时触发       | `(newFilters) => void`                    |
| current-change   | 当前行改变时触发         | `(currentRow, oldCurrentRow) => void`     |
| expand-change    | 展开/折叠行时触发        | `(row, expandedRows \| expanded) => void` |
| scroll           | 表格滚动时触发           | `({ scrollLeft, scrollTop }) => void`     |

### Table Slots

| 插槽名  | 说明                                 | 子标签       |
| ------- | ------------------------------------ | ------------ |
| default | 自定义默认内容                       | Table-column |
| append  | 在最后一行后插入的内容（如无限滚动） | —            |
| empty   | 数据为空时的内容                     | —            |

### Table Exposes

| 名称                 | 说明                           | 类型                                          |
| -------------------- | ------------------------------ | --------------------------------------------- |
| clearSelection       | 清空选中状态（多选）           | `() => void`                                  |
| getSelectionRows     | 获取当前选中行                 | `() => any[]`                                 |
| toggleRowSelection   | 切换某行选中状态               | `(row, selected?, ignoreSelectable?) => void` |
| toggleAllSelection   | 切换全选/全不选                | `() => void`                                  |
| toggleRowExpansion   | 切换某行展开状态               | `(row, expanded?) => void`                    |
| setCurrentRow        | 设置当前行（单选）             | `(row) => void`                               |
| clearSort            | 清除排序                       | `() => void`                                  |
| clearFilter          | 清除筛选                       | `(columnKeys?) => void`                       |
| doLayout             | 刷新布局                       | `() => void`                                  |
| sort                 | 手动排序                       | `(prop, order) => void`                       |
| scrollTo             | 滚动到指定位置                 | `(options, yCoord?) => void`                  |
| setScrollTop         | 设置垂直滚动位置               | `(top?) => void`                              |
| setScrollLeft        | 设置水平滚动位置               | `(left?) => void`                             |
| refresh              | 提交 `manual` 策略的数据更新   | `() => void`                                  |
| getLayoutDiagnostics | 获取最近 layout 合并原因与次数 | `() => TableLayoutDiagnostics`                |

---

## Table-column API

### Table-column Attributes

| 属性名                | 说明                                       | 类型                                                 | 默认值      |
| --------------------- | ------------------------------------------ | ---------------------------------------------------- | ----------- |
| type                  | 列类型                                     | `'default' \| 'selection' \| 'index' \| 'expand'`    | `default`   |
| index                 | 自定义 index 列的序号                      | `number \| (index: number) => number`                | —           |
| label                 | 列名                                       | `string`                                             | —           |
| prop                  | 字段名（alias: property）                  | `string`                                             | —           |
| width                 | 列宽                                       | `string \| number`                                   | `''`        |
| min-width             | 列最小宽度                                 | `string \| number`                                   | `''`        |
| fixed                 | 列固定位置                                 | `'left' \| 'right' \| boolean`                       | `false`     |
| sortable              | 是否可排序（后端排序设为 `'custom'`）      | `boolean \| string`                                  | `false`     |
| sort-method           | 自定义排序方法                             | `(a, b) => number`                                   | —           |
| sort-by               | 排序依据的字段                             | `string \| string[] \| (row, index) => string`       | —           |
| resizable             | 是否可拖动调整列宽（需 `border` 为 true）  | `boolean`                                            | `true`      |
| formatter             | 格式化单元格内容                           | `(row, column, cellValue, index) => VNode \| string` | —           |
| show-overflow-tooltip | 内容溢出时显示 tooltip                     | `boolean \| object`                                  | `undefined` |
| align                 | 内容对齐方式                               | `'left' \| 'center' \| 'right'`                      | `left`      |
| header-align          | 表头对齐方式（默认同 align）               | `'left' \| 'center' \| 'right'`                      | `left`      |
| selectable            | 某行是否可被选择（type='selection'）       | `(row, index) => boolean`                            | —           |
| reserve-selection     | 数据刷新后是否保留选中状态（需 `row-key`） | `boolean`                                            | `false`     |
| filters               | 列筛选选项                                 | `Array<{text: string, value: string}>`               | —           |
| filter-method         | 筛选方法                                   | `(value, row, column) => void`                       | —           |
| filter-multiple       | 是否支持多选筛选                           | `boolean`                                            | `true`      |
| priority              | 响应式列优先级                             | `'primary' \| 'secondary' \| 'detail'`               | —           |

### Table-column Slots

| 插槽名  | 说明                                                 |
| ------- | ---------------------------------------------------- |
| default | 自定义单元格内容（可访问 `row`、`column`、`$index`） |
| header  | 自定义表头内容（可访问 `column`、`$index`）          |

---

## Frequently Asked Questions

**How can the overlay display correctly during image preview?**

```vue
<el-table-column width="180">
  <template #default="scope">
    <el-image preview-teleported :preview-src-list="srcList" />
  </template>
</el-table-column>
```

**Why are columns not rendered with a DOM template?**

This is an HTML specification limitation, not a self-closing-tag issue. Use a single-file component (`.vue` file) instead.
