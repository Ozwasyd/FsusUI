# Tree 树形控件

用清晰的层级结构展示信息，可展开或折叠。

> 💡 **运行示例**：启动 demo-app（`pnpm dev`，端口 5173）查看交互效果。

---

## 基础用法

通过 `data` 属性传入树形数组；`node-key` 指定节点唯一标识字段；`props` 配置 label、children 等字段映射。

## 可选择节点

设置 `show-checkbox` 启用节点多选功能；`check-strictly` 控制父子节点选中状态是否关联。

## 懒加载

设置 `lazy` 与 `load` 函数，点击展开时才异步加载子节点。

## 默认展开与选中

使用 `default-expanded-keys` 和 `default-checked-keys` 设置初始展开/选中的节点 key 数组（需配置 `node-key`）。

## 自定义节点内容

通过默认插槽（访问 `node`、`data`）或 `render-content` 渲染函数自定义节点显示内容。

## 节点过滤

调用实例方法 `filter(keyword)` 过滤节点，配合 `filter-node-method` 自定义过滤逻辑。

## 手风琴模式

设置 `accordion` 使同级节点只能同时展开一个。

## 可拖拽

设置 `draggable` 启用节点拖放功能；`allow-drag`、`allow-drop` 函数控制拖放规则。

---

## API

### Attributes

| 属性名 | 说明 | 类型 | 默认值 |
|--------|------|------|--------|
| data | 树形数据 | `Array<{ [key: string]: any }>` | — |
| empty-text | 数据为空时的提示文本 | `string` | — |
| node-key | 节点唯一标识字段名 | `string` | — |
| props | 字段配置，见下方 props 表 | `object` | — |
| render-after-expand | 首次展开后才渲染子节点 | `boolean` | `true` |
| load | 懒加载函数（需 `lazy` 为 true） | `(node, resolve, reject) => void` | — |
| render-content | 自定义节点内容渲染函数 | `(h, { node, data, store }) => VNode` | — |
| highlight-current | 是否高亮当前选中节点 | `boolean` | `false` |
| default-expand-all | 是否默认展开所有节点 | `boolean` | `false` |
| expand-on-click-node | 点击节点时是否展开/折叠（false 时只点箭头才触发） | `boolean` | `true` |
| check-on-click-node | 点击节点时是否选中/取消选中 | `boolean` | `false` |
| check-on-click-leaf | 点击叶子节点时是否勾选 | `boolean` | `true` |
| auto-expand-parent | 子节点展开时是否自动展开父节点 | `boolean` | `true` |
| default-expanded-keys | 默认展开的节点 key 数组 | `(string \| number)[]` | — |
| show-checkbox | 是否显示节点复选框 | `boolean` | `false` |
| check-strictly | 父子节点的选中状态是否互不关联 | `boolean` | `false` |
| default-checked-keys | 默认勾选的节点 key 数组 | `(string \| number)[]` | — |
| current-node-key | 初始选中节点的 key | `string \| number` | — |
| filter-node-method | 节点过滤函数（返回 false 则隐藏该节点） | `(value, data, node) => boolean` | — |
| accordion | 是否开启手风琴模式 | `boolean` | `false` |
| indent | 相邻层级的缩进距离（px） | `number` | `18` |
| icon | 自定义节点图标 | `string \| Component` | — |
| lazy | 是否懒加载子节点 | `boolean` | `false` |
| draggable | 是否开启拖放 | `boolean` | `false` |
| allow-drag | 判断节点能否被拖拽的函数 | `(node) => boolean` | — |
| allow-drop | 判断节点能否被放入的函数 | `(draggingNode, dropNode, type) => boolean` | — |

### props 字段映射

| 属性 | 说明 | 类型 |
|------|------|------|
| label | 节点标签字段名 | `string \| (data, node) => string` |
| children | 子节点字段名 | `string` |
| disabled | 禁用复选框的字段名 | `string \| (data, node) => boolean` |
| isLeaf | 是否为叶子节点的字段名（懒加载时使用） | `string \| (data, node) => boolean` |
| class | 自定义节点 class 字段 | `string \| (data, node) => string` |

### Events

| 事件名 | 说明 | 回调参数 |
|--------|------|---------|
| node-click | 点击节点时触发 | `(data, node, treeNode, event) => void` |
| node-contextmenu | 右键点击节点时触发 | `(event, data, node, treeNode) => void` |
| check-change | 节点选中状态改变时触发 | `(data, checked, indeterminate) => void` |
| check | 点击复选框后触发 | `(data, { checkedNodes, checkedKeys, halfCheckedNodes, halfCheckedKeys }) => void` |
| current-change | 当前节点变化时触发 | `(data, node) => void` |
| node-expand | 节点展开时触发 | `(data, node, treeNode) => void` |
| node-collapse | 节点折叠时触发 | `(data, node, treeNode) => void` |
| node-drag-start | 拖拽开始时触发 | `(node, event) => void` |
| node-drag-end | 拖拽结束时触发 | `(node, endNode, dropType, event) => void` |
| node-drop | 拖拽完成放置后触发 | `(node, droppedNode, dropType, event) => void` |

### Slots

| 插槽名 | 说明 |
|--------|------|
| default | 自定义节点内容（可访问 `node`、`data`） |
| empty | 数据为空时的内容 |

### Exposes

| 名称 | 说明 |
|------|------|
| filter | 过滤节点（传入关键词） |
| getCheckedNodes | 获取当前选中的节点数组（leafOnly, includeHalfChecked） |
| getCheckedKeys | 获取当前选中节点的 key 数组（leafOnly） |
| setCheckedNodes | 设置节点选中状态（nodes, leafOnly） |
| setCheckedKeys | 通过 key 设置节点选中状态（keys, leafOnly） |
| setChecked | 设置单个节点的选中状态（key/data, checked, deep） |
| getHalfCheckedNodes | 获取半选节点数组 |
| getHalfCheckedKeys | 获取半选节点的 key 数组 |
| getCurrentKey | 获取当前高亮节点的 key |
| getCurrentNode | 获取当前高亮节点的数据 |
| setCurrentKey | 通过 key 设置高亮节点 |
| setCurrentNode | 通过节点对象设置高亮节点 |
| getNode | 通过 data 或 key 获取节点 |
| remove | 删除节点 |
| append | 在指定节点下追加子节点 |
| insertBefore | 在指定节点之前插入节点 |
| insertAfter | 在指定节点之后插入节点 |
