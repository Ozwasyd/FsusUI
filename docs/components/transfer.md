# Transfer

Moves records between two mutually exclusive data sets.

> See the [Playground](../playground.md) for runnable component examples.

---

## Basic Usage

Bind the right-list key array with `v-model`; `data` defines all records and `props` customizes field names.

## Searchable

Set `filterable` to enable search and use `filter-method` for custom filtering.

## Custom Rendering

Customize item rendering with the default slot and footer content with `left-footer` / `right-footer`.

## Data Item Properties

Set `disabled: true` on a record to prevent it from being moved.

## Responsive Direction

`direction` defaults to `auto`. Below `640px` of container width, the lists stack in DOM and visual order as “available list → action buttons → selected list”; the component container, not the global viewport, determines this. Use `horizontal` or `vertical` to force a direction.

Vertical mode uses up/down transfer icons. When a default item is truncated to one line, its full `title` remains available, and transfer-button accessible names include both source and destination list titles.

---

## API

### Attributes

| 属性名 | 说明 | 类型 | 默认值 |
|--------|------|------|--------|
| model-value / v-model | 右侧列表元素的 key 数组 | `Array<string \| number>` | `[]` |
| data | Transfer 的数据源 | `Array<{ key, label, disabled? }>` | `[]` |
| direction | 布局方向；`auto` 在组件容器小于 `640px` 时切换为纵向 | `'horizontal' \| 'vertical' \| 'auto'` | `auto` |
| filterable | 是否可搜索 | `boolean` | `false` |
| filter-placeholder | 搜索框占位符 | `string` | — |
| filter-method | 自定义搜索方法 | `(query: string, item: TransferDataItem) => boolean` | — |
| target-order | 右侧列表已选元素的排列策略（`original`：保持原始顺序；`push`：新移入的排最后；`unshift`：新移入的排最前） | `'original' \| 'push' \| 'unshift'` | `original` |
| titles | 自定义两侧标题 | `[string, string]` | `['列表 1', '列表 2']` |
| button-texts | 两个按钮的文字 | `[string, string]` | `[]` |
| render-content | 自定义数据项渲染函数 | `(h, option) => VNode` | — |
| format | 列表顶部勾选状态文案 | `{ noChecked?: string, hasChecked?: string }` | — |
| props | 数据字段别名 | `{ key?: string, label?: string, disabled?: string }` | — |
| left-default-checked | 初始状态左侧列表已勾选的项目 key 数组 | `Array<string \| number>` | `[]` |
| right-default-checked | 初始状态右侧列表已勾选的项目 key 数组 | `Array<string \| number>` | `[]` |
| validate-event | 是否触发表单校验 | `boolean` | `true` |

### Events

| 事件名 | 说明 | 回调参数 |
|--------|------|---------|
| change | 右侧列表元素变化时触发 | `(value: Array<string \| number>, direction: 'left' \| 'right', movedKeys: Array<string \| number>) => void` |
| left-check-change | 左侧列表元素被选中时触发 | `(value: Array<string \| number>, movedKeys: Array<string \| number>) => void` |
| right-check-change | 右侧列表元素被选中时触发 | `(value: Array<string \| number>, movedKeys: Array<string \| number>) => void` |

### Slots

| 插槽名 | 说明 |
|--------|------|
| default | 自定义数据项内容（可访问 `option`） |
| left-footer | 左侧列表底部内容 |
| right-footer | 右侧列表底部内容 |

### Exposes

| 名称 | 说明 | 类型 |
|------|------|------|
| clearQuery | 清空指定面板的搜索关键词 | `(which: 'left' \| 'right') => void` |
| leftPanel | 左侧面板的 ref | `TransferPanel` |
| rightPanel | 右侧面板的 ref | `TransferPanel` |
