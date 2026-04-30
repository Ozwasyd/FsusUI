# TableV2 虚拟化表格（Beta）

利用虚拟滚动技术，实现大数据量表格的高性能渲染。

> **提示**：该组件仍处于测试阶段，API 可能发生变化。当数据量极大时，网络和内存才是真正的瓶颈——请配合分页、过滤等手段使用。

> 💡 **运行示例**：启动 demo-app（`pnpm dev`，端口 5173）查看交互效果。

---

## 与 TableV1 的区别

| 特性 | TableV1 | TableV2 |
|------|---------|---------|
| 渲染方式 | 原生 `<table>` | 虚拟滚动（Canvas Grid） |
| 大数据支持 | ≤5000 行（WASM 加速排序） | 10 万行以上 |
| colspan/rowspan | 原生支持 | 需自定义行渲染器实现 |
| 功能集 | 丰富 | 轻量，按需自定义 |

## 基础用法

必须传入 `width`、`height` 和 `columns` 三个必填属性。

```vue
<el-table-v2
  :columns="columns"
  :data="data"
  :width="700"
  :height="400"
/>
```

## 自动大小

用 `AutoResizer` 组件包裹可自动跟随父容器尺寸变化。

> **提示**：`AutoResizer` 的父容器必须有固定高度。

## 固定列

在列定义中设置 `fixed: true`（或 `FixedDir.LEFT` / `FixedDir.RIGHT`）实现列固定。

## 动态行高

设置 `estimated-row-height` 开启动态行高，系统会在渲染时实时测量每行高度。

---

## API

### TableV2 Attributes

| 属性名 | 说明 | 类型 | 默认值 |
|--------|------|------|--------|
| columns **（必填）** | 列定义数组 | `Column[]` | — |
| data **（必填）** | 数据数组 | `Data[]` | `[]` |
| width **（必填）** | 表格宽度（px） | `number` | — |
| height **（必填）** | 表格高度（px） | `number` | — |
| max-height | 表格最大高度 | `number` | — |
| row-height | 行高（px） | `number` | `50` |
| header-height | 表头高度（px），传数组时渲染多行表头 | `number \| number[]` | `50` |
| footer-height | 页脚高度（px） | `number` | `0` |
| cache | 提前渲染的行数（提升滚动性能） | `number` | `2` |
| estimated-row-height | 动态行高的估计值（px） | `number` | — |
| row-key | 行唯一键字段 | `string \| symbol \| number` | `id` |
| fixed | 是否固定列宽 | `boolean` | `false` |
| scrollbar-always-on | 是否始终显示滚动条 | `boolean` | `false` |
| sort-by | 单列排序指示 | `SortBy` | `{}` |
| sort-state | 多列排序指示 | `SortState` | `undefined` |
| expand-column-key | 可展开列的 key | `string` | — |
| expanded-row-keys / v-model:expanded-row-keys | 已展开行的 key 数组 | `KeyType[]` | — |
| fixed-data | 固定在表头下方的置顶行数据 | `Data` | — |
| row-class | 行自定义 class | `string \| Function` | — |
| row-event-handlers | 行事件处理器集合 | `RowEventHandlers` | — |
| h-scrollbar-size | 水平滚动条宽度（px） | `number` | `6` |
| v-scrollbar-size | 垂直滚动条宽度（px） | `number` | `6` |
| indent-size | 树形数据水平缩进（px） | `number` | `12` |

### Column Attribute

| 属性名 | 说明 | 类型 | 默认值 |
|--------|------|------|--------|
| key **（必填）** | 列唯一标识 | `KeyType` | — |
| dataKey | 从数据行中取值的字段名 | `KeyType` | — |
| width **（必填）** | 列宽（px） | `number` | — |
| title | 表头默认文字 | `string` | — |
| align | 单元格内容对齐 | `'left' \| 'center' \| 'right'` | `left` |
| fixed | 固定方向 | `boolean \| 'left' \| 'right'` | `false` |
| sortable | 是否可排序 | `boolean` | — |
| minWidth | 最小宽度 | `number` | — |
| maxWidth | 最大宽度 | `number` | — |
| flexGrow | CSS flex-grow（非固定表格有效） | `number` | `0` |
| flexShrink | CSS flex-shrink（非固定表格有效） | `number` | `1` |
| hidden | 是否隐藏 | `boolean` | — |
| cellRenderer | 自定义单元格渲染器 | `VueComponent \| (props: CellRenderProps) => VNode` | — |
| headerCellRenderer | 自定义表头渲染器 | `VueComponent \| (props: HeaderRenderProps) => VNode` | — |

### TableV2 Events

| 事件名 | 说明 | 回调参数 |
|--------|------|---------|
| column-sort | 列排序时触发 | `ColumnSortParam` |
| expanded-rows-change | 展开行变化时触发 | `KeyType[]` |
| end-reached | 滚动到末尾时触发 | `(remainDistance: number) => void` |
| scroll | 滚动时触发 | `ScrollParams` |
| rows-rendered | 行渲染完成时触发 | `RowsRenderedParams` |
| row-expand | 树节点展开/折叠时触发 | `RowExpandParams` |

### TableV2 Slots

| 插槽名 | 说明 |
|--------|------|
| cell | 自定义单元格 |
| header | 自定义表头行 |
| header-cell | 自定义表头单元格 |
| row | 自定义行 |
| footer | 自定义页脚 |
| empty | 空数据时展示的内容 |
| overlay | 覆盖层（如 loading） |

### TableV2 Exposes

| 名称 | 说明 | 类型 |
|------|------|------|
| scrollTo | 滚动到指定位置 | `(param: { scrollLeft?: number, scrollTop?: number }) => void` |
| scrollToLeft | 水平滚动到指定位置 | `(scrollLeft: number) => void` |
| scrollToTop | 垂直滚动到指定位置 | `(scrollTop: number) => void` |
| scrollToRow | 滚动到指定行 | `(row: number, strategy?: 'center' \| 'end' \| 'start' \| 'smart') => void` |
