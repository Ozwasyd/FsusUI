# TreeV2 (Beta)

Uses virtual scrolling for a high-performance tree view with any number of nodes.

> See the [Playground](../playground.md) for runnable component examples.

---

## Basic Usage

```vue
<el-tree-v2
  :data="data"
  :props="{ label: 'name', children: 'children' }"
  :height="300"
/>
```

## Selectable

Set `show-checkbox` for checkboxes. By default, clicking a leaf selects it (`check-on-click-leaf: true`).

## Default Expansion and Selection

Use `default-expanded-keys` and `default-checked-keys` for initially expanded and checked nodes.

## Custom Node Content

Customize node content with the default slot, which exposes `{ node, data }`.

## Node Filtering

Call the instance's `filter(query)` method to filter nodes, together with `filter-method`.

---

## API

### TreeV2 Attributes

| 属性名 | 说明 | 类型 | 默认值 |
|--------|------|------|--------|
| data | 树形数据 | `Array<{ [key: string]: any }>` | — |
| props | 配置项，见下表 | `object` | — |
| height | 树的高度（px） | `number` | `200` |
| empty-text | 数据为空时的文字 | `string` | — |
| highlight-current | 是否高亮当前选中节点 | `boolean` | `false` |
| expand-on-click-node | 点击节点时是否展开/折叠（false 则只有箭头才能触发） | `boolean` | `true` |
| check-on-click-node | 点击节点时是否切换选中（false 则只有复选框才能触发） | `boolean` | `false` |
| check-on-click-leaf | 点击叶子节点时是否选中 | `boolean` | `true` |
| show-checkbox | 是否显示复选框 | `boolean` | `false` |
| check-strictly | 是否严格的遵循父子不互相关联（`show-checkbox` 为 true 时有效） | `boolean` | `false` |
| default-expanded-keys | 默认展开节点的 key 数组 | `(string \| number)[]` | — |
| default-checked-keys | 默认选中节点的 key 数组 | `(string \| number)[]` | — |
| current-node-key | 初始选中节点的 key | `string \| number` | — |
| filter-method | 节点过滤函数，返回 false 隐藏节点 | `(query: string, data: TreeNodeData, node: TreeNode) => boolean` | — |
| indent | 相邻层级的缩进距离（px） | `number` | `16` |
| icon | 自定义节点图标 | `string \| Component` | — |
| item-size | 节点行高（px） | `number` | `26` |
| scrollbar-always-on | 是否始终显示滚动条 | `boolean` | `false` |

### Props Options

| 属性名 | 说明 | 类型 | 默认值 |
|--------|------|------|--------|
| value | 节点唯一标识字段名 | `string` | `id` |
| label | 节点标签字段名 | `string` | `label` |
| children | 子节点字段名 | `string` | `children` |
| disabled | 是否禁用的字段名 | `string` | `disabled` |
| class | 自定义节点 class | `string \| Function` | — |

### TreeV2 Events

| 事件名 | 说明 | 回调参数 |
|--------|------|---------|
| node-click | 节点点击时触发 | `(data, node, e)` |
| node-contextmenu | 节点右键点击时触发 | `(e, data, node)` |
| check-change | 节点选中状态变化时触发 | `(data, checked)` |
| check | 复选框点击后触发 | `(data, info)` |
| current-change | 当前节点变化时触发 | `(data, node)` |
| node-expand | 节点展开时触发 | `(data, node)` |
| node-collapse | 节点折叠时触发 | `(data, node)` |

### TreeV2 Slots

| 插槽名 | 说明 | 参数 |
|--------|------|------|
| default | 自定义节点内容 | `{ node: TreeNode, data: TreeNodeData }` |
| empty | 数据为空时的自定义内容 | — |

### TreeV2 Exposes

| 名称 | 说明 | 参数 |
|------|------|------|
| filter | 过滤节点 | `(query: string)` |
| getCheckedNodes | 获取选中节点数组 | `(leafOnly: boolean)` |
| getCheckedKeys | 获取选中节点 key 数组 | `(leafOnly: boolean)` |
| setCheckedKeys | 设置选中节点 | `(keys: TreeKey[])` |
| setChecked | 设置单个节点选中状态 | `(key, checked, deep?)` |
| setExpandedKeys | 设置展开节点 | `(keys: TreeKey[])` |
| getHalfCheckedNodes | 获取半选中节点数组 | — |
| getHalfCheckedKeys | 获取半选中节点 key 数组 | — |
| getCurrentKey | 获取当前高亮节点的 key | — |
| getCurrentNode | 获取当前高亮节点的数据 | — |
| setCurrentKey | 设置高亮节点 | `(key: TreeKey)` |
| getNode | 通过 key 或数据获取节点 | `(data: TreeKey \| TreeNodeData)` |
| expandNode | 展开指定节点 | `(node: TreeNode)` |
| collapseNode | 折叠指定节点 | `(node: TreeNode)` |
| setData | 直接设置数据（避免大数据量的响应式性能问题） | `(data: TreeData)` |
| scrollTo | 滚动到指定偏移量 | `(offset: number)` |
| scrollToNode | 滚动到指定节点 | `(key, strategy?)` |
