# Select V2 虚拟化选择器

适用于选项数量极多（数万条）的场景，通过虚拟渲染优化性能。

> 💡 **运行示例**：启动 demo-app（`pnpm dev`，端口 5173）查看交互效果。

---

## 基础用法

最简单的选择器，通过 `options` 属性传入选项数据。

## 多选

支持多选，绑定值为数组，配合 `collapse-tags` / `collapse-tags-tooltip` 折叠已选项。

## 禁用

可禁用整个选择器或某个选项项。

## 可清空

设置 `clearable` 属性显示清空按钮。

## 可过滤

设置 `filterable` 启用前端过滤，可通过 `filter-method` 自定义过滤逻辑。

## 选项分组

数据结构支持嵌套分组。

## 自定义选项渲染

通过 `default` 插槽自定义选项内容。

## 远程搜索

同时设置 `filterable` 和 `remote`，配合 `remote-method` 从服务端搜索数据。

## 创建新条目

同时设置 `filterable` 和 `allow-create` 允许用户创建不在选项中的新条目，可使用 `default-first-option` 让 Enter 键直接选中第一个匹配项。

---

## API

### Attributes

| 属性名 | 说明 | 类型 | 默认值 |
|--------|------|------|--------|
| model-value / v-model | 绑定值 | `string \| number \| boolean \| object \| array` | — |
| options | 选项数据（字段名可通过 `props` 自定义） | `Array<{[key: string]: any}>` | — |
| props | 自定义字段别名 | `{ value?: string, label?: string, options?: string, disabled?: string }` | — |
| multiple | 是否多选 | `boolean` | `false` |
| disabled | 是否禁用 | `boolean` | `false` |
| value-key | 对象类型 value 的唯一键名 | `string` | `value` |
| size | 组件尺寸 | `'' \| 'large' \| 'default' \| 'small'` | `''` |
| clearable | 是否可清空 | `boolean` | `false` |
| collapse-tags | 多选时是否折叠 Tag | `boolean` | `false` |
| collapse-tags-tooltip | 悬停折叠文字时显示所有选中项 | `boolean` | `false` |
| multiple-limit | 最多可选数量（0 不限制） | `number` | `0` |
| placeholder | 占位符 | `string` | `请选择` |
| filterable | 是否可过滤 | `boolean` | `false` |
| allow-create | 是否允许创建新条目（需 `filterable` 为 true） | `boolean` | `false` |
| filter-method | 自定义过滤方法 | `(query: string) => void` | — |
| loading | 是否正在加载数据 | `boolean` | `false` |
| loading-text | 加载中显示的文字 | `string` | — |
| reserve-keyword | 多选过滤后是否保留搜索关键词 | `boolean` | `true` |
| default-first-option | 是否按 Enter 选中第一个匹配项 | `boolean` | `false` |
| no-match-text | 无匹配时的提示文字 | `string` | — |
| no-data-text | 无数据时的提示文字 | `string` | `暂无数据` |
| popper-class | 下拉框自定义 class | `string` | `''` |
| teleported | 是否将下拉框挂载到 `append-to` 位置 | `boolean` | `true` |
| append-to | 下拉框挂载目标 | `CSSSelector \| HTMLElement` | — |
| height | 下拉面板高度（px） | `number` | `274` |
| item-height | 每个选项的高度（px） | `number` | `34` |
| scrollbar-always-on | 是否始终显示滚动条 | `boolean` | `false` |
| remote | 是否开启远程搜索 | `boolean` | `false` |
| remote-method | 远程搜索回调 | `(query: string) => void` | — |
| validate-event | 是否触发表单校验 | `boolean` | `true` |
| placement | 下拉框出现位置 | `'bottom-start' \| 'bottom' \| 'top' \| ...` | `bottom-start` |
| tag-type | 多选 Tag 类型 | `'' \| 'success' \| 'info' \| 'warning' \| 'danger'` | `info` |

### Events

| 事件名 | 说明 | 回调参数 |
|--------|------|---------|
| change | 选中值改变时触发 | `(val: any) => void` |
| visible-change | 下拉框出现/消失时触发 | `(visible: boolean) => void` |
| remove-tag | 多选模式下删除 Tag 时触发 | `(tagValue: any) => void` |
| clear | 点击清空按钮时触发 | `() => void` |
| blur | 输入框失焦时触发 | `(event: FocusEvent) => void` |
| focus | 输入框聚焦时触发 | `(event: FocusEvent) => void` |

### Slots

| 插槽名 | 说明 |
|--------|------|
| default | 自定义选项渲染 |
| header | 下拉框顶部内容 |
| footer | 下拉框底部内容 |
| empty | 无选项时的内容 |
| prefix | 前缀内容 |
| tag | 自定义多选 Tag |
| loading | 自定义加载内容 |
| label | 自定义已选项标签 |

### Exposes

| 名称 | 说明 | 类型 |
|------|------|------|
| focus | 使输入框聚焦 | `() => void` |
| blur | 使输入框失焦并收起下拉框 | `() => void` |
| selectedLabel | 获取当前选中的 label | `ComputedRef<string \| string[]>` |
