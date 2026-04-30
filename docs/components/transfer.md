# Transfer 穿梭框

在两个互斥数据集之间进行数据移动。

> 💡 **运行示例**：启动 demo-app（`pnpm dev`，端口 5173）查看交互效果。

---

## 基础用法

`v-model` 绑定右侧列表的 key 数组；`data` 定义所有数据；`props` 自定义数据字段名。

## 可搜索

设置 `filterable` 属性启用搜索功能，可通过 `filter-method` 自定义搜索逻辑。

## 自定义渲染

使用默认插槽自定义数据项渲染；使用 `left-footer` / `right-footer` 插槽自定义底部内容。

## 数据项属性

通过给数据项添加 `disabled: true` 禁止该项被移动。

---

## API

### Attributes

| 属性名 | 说明 | 类型 | 默认值 |
|--------|------|------|--------|
| model-value / v-model | 右侧列表元素的 key 数组 | `Array<string \| number>` | `[]` |
| data | Transfer 的数据源 | `Array<{ key, label, disabled? }>` | `[]` |
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
