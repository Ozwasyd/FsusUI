# Select 选择器

当选项过多时，使用下拉菜单展示并选择内容。

> **提示**：`el-select` 默认宽度为 `100%`。在行内表单中使用时需要设置明确宽度（如 `style="width: 200px"`）。

> 💡 **运行示例**：启动 demo-app（`pnpm dev`，端口 5173）查看交互效果。

---

## 基础用法

`v-model` 绑定 `el-option` 的 `value` 值。

## 禁用选项

将 `el-option` 的 `disabled` 设为 `true` 即可禁用该选项。

## 禁用状态

设置 `el-select` 的 `disabled` 属性禁用整个选择器。

## 可清空

设置 `clearable` 属性后会出现清空图标。

## 多选

设置 `multiple` 属性启用多选，绑定值为数组。可使用 `collapse-tags` 折叠已选项，配合 `collapse-tags-tooltip` 悬停展开。

## 分组选项

使用 `el-option-group` 对选项分组，`label` 为分组名称。

## 可过滤

添加 `filterable` 启用过滤搜索，可通过 `filter-method` 自定义过滤逻辑。

## 远程搜索

`filterable` 和 `remote` 同时设为 `true` 启用远程搜索，配合 `remote-method` 从服务器获取数据。

## 创建新条目

同时设置 `filterable` 和 `allow-create` 后，用户可直接在输入框中创建新条目。

---

## Select API

### Select Attributes

| 属性名 | 说明 | 类型 | 默认值 |
|--------|------|------|--------|
| model-value / v-model | 绑定值 | `string \| number \| boolean \| object \| array` | — |
| multiple | 是否多选 | `boolean` | `false` |
| options | 选项数据（`value`/`label`/`disabled` 字段可通过 `props` 自定义） | `Array<{[key: string]: any}>` | — |
| disabled | 是否禁用 | `boolean` | `false` |
| value-key | 对象类型 value 的唯一键名 | `string` | `value` |
| size | 输入框尺寸 | `'' \| 'large' \| 'default' \| 'small'` | — |
| clearable | 是否可清空 | `boolean` | `false` |
| collapse-tags | 多选时是否折叠 Tag | `boolean` | `false` |
| collapse-tags-tooltip | 悬停折叠文字时显示所有选中项（需 `collapse-tags` 为 true） | `boolean` | `false` |
| multiple-limit | 最多可选数量（0 不限制） | `number` | `0` |
| placeholder | 占位符 | `string` | — |
| filterable | 是否可过滤 | `boolean` | `false` |
| allow-create | 是否允许创建新条目（需 `filterable` 为 true） | `boolean` | `false` |
| filter-method | 自定义过滤方法 | `(query: string) => void` | — |
| remote | 是否从服务器远程搜索 | `boolean` | `false` |
| remote-method | 远程搜索回调 | `(query: string) => void` | — |
| loading | 是否正在从服务器加载数据 | `boolean` | `false` |
| loading-text | 加载时显示的文字 | `string` | — |
| no-match-text | 无匹配数据时显示的文字 | `string` | — |
| no-data-text | 无数据时显示的文字 | `string` | — |
| popper-class | 下拉框的自定义类名 | `string` | `''` |
| teleported | 下拉框是否挂载到 `append-to` | `boolean` | `true` |
| append-to | 下拉框挂载的目标元素 | `CSSSelector \| HTMLElement` | — |
| placement | 下拉框出现位置 | `'bottom-start' \| 'bottom' \| 'top' \| ...` | `bottom-start` |
| tag-type | 多选 Tag 类型 | `'' \| 'success' \| 'info' \| 'warning' \| 'danger'` | `info` |
| validate-event | 是否触发表单校验 | `boolean` | `true` |

### Select Events

| 事件名 | 说明 | 回调参数 |
|--------|------|---------|
| change | 选中值改变时触发 | `(value: any) => void` |
| visible-change | 下拉框出现/消失时触发 | `(visible: boolean) => void` |
| remove-tag | 多选模式下删除 Tag 时触发 | `(tagValue: any) => void` |
| clear | 点击清空图标时触发 | `() => void` |
| blur | 输入框失焦时触发 | `(event: FocusEvent) => void` |
| focus | 输入框聚焦时触发 | `(event: FocusEvent) => void` |
| end-reached | 下拉框滚动到底部时触发 | `(direction: 'top' \| 'bottom' \| 'left' \| 'right') => void` |

### Select Slots

| 插槽名 | 说明 | 子标签 |
|--------|------|--------|
| default | 选项列表 | OptionGroup / Option |
| header | 下拉框顶部内容 | — |
| footer | 下拉框底部内容 | — |
| prefix | 前缀内容 | — |
| empty | 无选项时的内容 | — |
| tag | 自定义多选 Tag | — |
| loading | 自定义加载内容 | — |
| label | 自定义已选项标签 | — |

### Select Exposes

| 名称 | 说明 | 类型 |
|------|------|------|
| focus | 使输入框聚焦 | `() => void` |
| blur | 使输入框失焦并收起下拉框 | `() => void` |
| selectedLabel | 获取当前选中的 label | `ComputedRef<string \| string[]>` |

---

## Option Group API

### Option Group Attributes

| 属性名 | 说明 | 类型 | 默认值 |
|--------|------|------|--------|
| label | 分组名称 | `string` | — |
| disabled | 是否禁用该分组下所有选项 | `boolean` | `false` |

---

## Option API

### Option Attributes

| 属性名 | 说明 | 类型 | 默认值 |
|--------|------|------|--------|
| value | 选项的值 | `string \| number \| boolean \| object` | — |
| label | 选项标签（省略时与 value 相同） | `string \| number` | — |
| disabled | 是否禁用该选项 | `boolean` | `false` |
