# Table 表格

用于展示多条结构类似的数据，可对数据进行排序、筛选、对比或其他自定义操作。

## Public Preview Notes

| 字段                   | 说明                                                                                                                                   |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| purpose                | 展示结构化数据，支持排序、筛选、选择、展开、树形数据和自定义列模板。                                                                   |
| basic usage            | 通过 `data` 传入数组，用 `el-table-column` 声明列；大数据场景优先评估 TableV2 或虚拟列表。                                             |
| props / events / slots | 本页 `Table API` 和 `Table-column API` 覆盖公开 props、events、slots 和 exposes。                                                      |
| accessibility          | 为业务表格提供明确上下文标题；选择列、展开列和自定义单元格内容应保留键盘可达控件与可读文本。                                           |
| theme token notes      | 跟随公开背景、边框、文本、主色、阴影和 motion control token；WASM 加速不改变视觉 token。                                               |
| known limitations      | 索引加速只覆盖本地 number / ASCII string 排序；locale-aware、CJK、mixed、自定义 comparator、服务端排序和分页继续使用语义正确的原路径。 |
| stability level        | Preview public component；WASM 加速路径属于 Experimental behavior。                                                                    |

## WASM 加速

FsusUI 的大数据路径先提取最小 primitive 列数据，在 Worker 中通过持久 WASM buffer 返回稳定 `Uint32Array` 行索引。重复值按原始 index 稳定排序，完整 row object 不进入 Worker；只有最新 generation 返回后才在公共数组边界 materialize。新的排序会取消仍在执行的旧任务，旧结果或组件卸载后的结果不会写回 Table；卸载同时释放 Worker/WASM session。策略会记录初始化、复制、计算、映射和提交耗时，并动态选择 Worker/WASM 或可让出主线程的分块 JS，不使用固定 5K 阈值。

WASM memory growth 后旧 TypedArray view 会失效，因此实现只持久化 pointer/capacity，每次操作重新读取当前 heap view。组件/pool 释放时同时释放 input/output/index buffer。locale-aware、CJK、mixed values、`sort-method` 和 `sort-by` 保持 JS 语义，不会使用 ASCII 字节序冒充 locale 排序。

> **注意**：开启 WASM 加速无需任何额外配置；如需从源码重新编译 WASM 模块，需要 Emscripten 5.0.4。

> 💡 **运行示例**：启动 demo-app（`pnpm dev`，端口 5173）查看交互效果。

## 大数据变更策略

`data-change-strategy` 明确 Table 何时接收消费者的数据变化：

| 策略       | 刷新条件                      | 适用场景                                    |
| ---------- | ----------------------------- | ------------------------------------------- |
| `identity` | `data` 数组 identity 改变     | 推荐的大数据默认写法；更新后替换数组        |
| `version`  | `data-version` 改变           | 数据容器稳定、由 store/reducer 提交显式版本 |
| `manual`   | 调用 Table 实例的 `refresh()` | 批处理、外部缓存或事务式提交                |
| `deep`     | 数组或任意嵌套行字段改变      | 兼容旧行为；仍是当前默认值                  |

`deep` 保持为默认值是为了避免现有应用在升级后静默停止刷新；新建的大数据页面应显式选择 `identity`。`identity`、`version` 和 `manual` 使用 shallow/raw 边界，不订阅全部行对象。纯内容提交不会重算列结构，同一 microtask 内的重复提交只形成一次 layout batch。

```vue
<el-table
  ref="table"
  :data="rows"
  data-change-strategy="version"
  :data-version="rowsVersion"
  row-key="id"
/>
```

排序和筛选内部保存 `Uint32Array` row index view；selection 使用 `row-key` Map。`selection-change`、`getSelectionRows()` 等公共边界仍返回行对象数组。`getLayoutDiagnostics()` 返回最近一次 layout 的 `lastReasons`、待处理 reason 和 flush 次数，可区分 `data-*`、`sort`、`filter`、`columns` 与 `container-resize`。

---

## 基础用法

通过 `data` 属性传入数据数组；`el-table-column` 的 `prop` 对应数据字段，`label` 为列名，`width` 设置列宽。

## 带斑马纹

设置 `stripe` 为 `true` 让表格隔行换色，更易区分不同行。

## 带边框

设置 `border` 为 `true` 显示纵向边框。

## 固定表头

通过 `height` 属性设置表格高度，超出时表头固定，内容区域滚动。

## 固定列

在 `el-table-column` 上设置 `fixed` 属性（`true` / `'left'` / `'right'`）固定列。

## 排序

在列上设置 `sortable` 开启排序。可通过 `sort-method` / `sort-by` 自定义排序逻辑。后端排序时设置 `sortable="custom"`，监听 `sort-change` 事件自行请求接口。

> 是否启用 Worker/WASM 由当前设备和该会话的端到端历史决定；行数本身不是固定开关。

## 筛选

在 `el-table-column` 上设置 `filters` 数组和 `filter-method` 函数实现列筛选。

## 自定义列模板

通过 `default` 插槽访问 `row`、`column`、`$index` 等数据，插入自定义内容。

## 响应式列投影

设置 `responsive="auto"` 或 `responsive="priority"` 后，组件宽度小于
`640px` 时只在主行保留 `priority="primary"` 的列。`secondary` 与 `detail`
列不会丢弃：每行的 40px 展开动作会将这些字段投影为平坦的 label/value
详情列表。未声明 priority 时，第一个普通数据列为 primary，其余普通列为
secondary；选择、索引、展开等功能列始终保留。

设置 `responsive="scroll"` 可显式保留宽表。滚动区域可聚焦、有可访问名称，
并在首次横向滚动前显示右边缘渐隐提示；键盘左右方向键可以浏览。

## 多选

设置 `type="selection"` 列开启多选；配合 `toggleRowSelection`、`clearSelection` 等方法管理选中状态。

## 展开行

设置 `type="expand"` 列实现展开行功能。

## 树形数据

数据中包含 `children` 字段时自动渲染为树形结构（需设置 `row-key`）。

## 合计行

设置 `show-summary` 为 `true` 显示合计行，可通过 `summary-method` 自定义。

## 合并行列

通过 `span-method` 函数返回 `[rowspan, colspan]` 实现行列合并。

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

## 常见问题

**图片预览时如何让蒙层显示正确？**

```vue
<el-table-column width="180">
  <template #default="scope">
    <el-image preview-teleported :preview-src-list="srcList" />
  </template>
</el-table-column>
```

**使用 DOM 模板时列不渲染？**

这是 HTML 规范限制（非自闭合标签问题），请改用单文件组件（`.vue` 文件）形式。
