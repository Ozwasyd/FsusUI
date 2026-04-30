# TreeSelect 树形选择器

下拉树选择器，融合了 `el-tree` 和 `el-select` 的功能。

> 💡 **运行示例**：启动 demo-app（`pnpm dev`，端口 5173）查看交互效果。

---

## 基础用法

通过 `data` 传入树形数据，`v-model` 绑定选中值（默认使用 `value` 字段作为节点 key）。

## 选择任意层级

设置 `check-strictly="true"` 允许选择任意层级的节点；默认只能选叶子节点。

## 多选

设置 `multiple` 开启多选，可配合 `show-checkbox` 显示复选框。

## 可搜索

设置 `filterable` 启用关键词过滤，可通过 `filter-node-method` 自定义节点过滤逻辑。

## 懒加载

设置 `lazy` 与 `load` 函数实现异步加载子节点，适合数据量较大的场景。

## 自定义节点内容

通过 `default` 插槽自定义树节点的展示内容。

---

## API

此组件整合了 `el-tree` 和 `el-select` 的所有属性、事件、插槽与 Expose，请参考：

- [Tree 属性](./tree.md#attributes) / [Tree 事件](./tree.md#events) / [Tree 插槽](./tree.md#slots)
- [Select 属性](./select.md#select-attributes) / [Select 事件](./select.md#select-events) / [Select 插槽](./select.md#select-slots)

### 额外属性

| 属性名 | 说明 | 类型 | 默认值 |
|--------|------|------|--------|
| cache-data | 懒加载节点的缓存数据（用于获取未加载节点的 label） | `CacheOption[]` | `[]` |

### Exposes

| 名称 | 说明 | 类型 |
|------|------|------|
| treeRef | 内部 Tree 组件实例 | `TreeInstance` |
| selectRef | 内部 Select 组件实例 | `SelectInstance` |

> **提示**：其余旧版直接 expose 的树/选择方法（如 `getCheckedNodes`、`filter` 等）已废弃，请通过 `treeRef` 或 `selectRef` 访问。
