# TreeSelect

A dropdown tree selector combining `el-tree` and `el-select`.

> See the [Playground](../playground.md) for runnable component examples.

---

## Basic Usage

Pass tree data through `data` and bind the selected value with `v-model`; the `value` field is the default node key.

## Select Any Level

Set `check-strictly="true"` to allow any node level; only leaf nodes are selectable by default.

## Multiple Selection

Set `multiple` for multiple selection and combine it with `show-checkbox` for checkboxes.

## Searchable

Set `filterable` for keyword filtering and use `filter-node-method` for custom node filtering.

## Lazy Loading

Set `lazy` with a `load` function for asynchronous child loading in large data sets.

## Custom Node Content

Customize tree-node content with the `default` slot.

## Row Interaction and Hierarchy

TreeSelect treats the full row as the sole navigation surface: indentation, expand button, checkbox, and content align to fixed columns, with a 44px row height. Hover, current selection, and keyboard focus use row background, selection semantic color, and a 2px inner outline respectively; Select options do not redraw these states.

Non-leaf nodes retain a restrained expand button. Consumers can still use Tree's `indent`, `icon`, and `show-checkbox` props without extra layout overrides.

---

## API

This component combines all `el-tree` and `el-select` attributes, events, slots, and exposes. See:

- [Tree attributes](./tree.md#attributes) / [Tree events](./tree.md#events) / [Tree slots](./tree.md#slots)
- [Select attributes](./select.md#select-attributes) / [Select events](./select.md#select-events) / [Select slots](./select.md#select-slots)

### Additional Attributes

| 属性名     | 说明                                               | 类型            | 默认值 |
| ---------- | -------------------------------------------------- | --------------- | ------ |
| cache-data | 懒加载节点的缓存数据（用于获取未加载节点的 label） | `CacheOption[]` | `[]`   |

### Exposes

| 名称      | 说明                 | 类型             |
| --------- | -------------------- | ---------------- |
| treeRef   | 内部 Tree 组件实例   | `TreeInstance`   |
| selectRef | 内部 Select 组件实例 | `SelectInstance` |

> **Tip:** Other tree/select methods previously exposed directly (such as `getCheckedNodes` and `filter`) are deprecated. Access them through `treeRef` or `selectRef`.
