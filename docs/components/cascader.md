# Cascader 级联选择器

当一个数据集合有清晰的层级结构时，可通过级联选择器逐级查看并选择。

> 💡 **运行示例**：启动 demo-app（`pnpm dev`，端口 5173）查看交互效果。

---

## 基础用法

通过 `options` 传入选项数组。`props.expandTrigger` 设置子选项展开触发方式（`click` / `hover`）。

## 禁用选项

在选项数据中设置 `disabled: true` 禁用该选项。字段名可通过 `props.disabled` 自定义。

## 可清空

设置 `clearable` 属性显示清空按钮。

## 只显示最后一级

设置 `show-all-levels="false"` 输入框中只显示最后一级。

## 多选

通过 `:props="{ multiple: true }"` 开启多选。多选时可设置 `collapse-tags` 折叠已选项。

## 选择任意等级

默认只能选叶子节点。设置 `props.checkStrictly = true` 使父子节点取消关联，可选任意层级。

## 动态加载

设置 `props.lazy = true` 并配合 `props.lazyLoad` 函数实现动态加载子节点。

## 可搜索

设置 `filterable` 开启搜索，可通过 `filter-method` 自定义搜索逻辑。

---

## Cascader API

### Cascader Attributes

| 属性名 | 说明 | 类型 | 默认值 |
|--------|------|------|--------|
| model-value / v-model | 绑定值 | `string \| number \| string[] \| number[] \| any` | — |
| options | 选项数据 | `CascaderOption[]` | — |
| props | 配置项（见 CascaderProps） | `CascaderProps` | — |
| size | 输入框尺寸 | `'large' \| 'default' \| 'small'` | — |
| placeholder | 占位符 | `string` | — |
| disabled | 是否禁用 | `boolean` | — |
| clearable | 是否可清空 | `boolean` | — |
| show-all-levels | 是否在输入框中显示所有层级 | `boolean` | `true` |
| collapse-tags | 多选时是否折叠 Tag | `boolean` | — |
| collapse-tags-tooltip | 悬停折叠 Tag 时是否显示所有选中项 | `boolean` | `false` |
| separator | 选项分隔符 | `string` | `' / '` |
| filterable | 是否可搜索 | `boolean` | — |
| filter-method | 自定义搜索逻辑 | `(node: CascaderNode, keyword: string) => boolean` | — |
| debounce | 过滤防抖延迟（ms） | `number` | `300` |
| before-filter | 过滤前钩子，返回 `false` 或 rejected Promise 时中止过滤 | `(value: string) => boolean` | — |
| teleported | 下拉框是否传送到 body | `boolean` | `true` |
| validate-event | 是否触发表单校验 | `boolean` | `true` |
| tag-type | 多选 Tag 类型 | `'success' \| 'info' \| 'warning' \| 'danger'` | `info` |
| virtual-scroll | 是否开启虚拟滚动（大数据量场景） | `boolean` | `false` |

### CascaderProps（配置项）

| 属性名 | 说明 | 类型 | 默认值 |
|--------|------|------|--------|
| expandTrigger | 子选项展开触发方式 | `'click' \| 'hover'` | `click` |
| multiple | 是否多选 | `boolean` | `false` |
| checkStrictly | 父子节点是否不关联 | `boolean` | `false` |
| emitPath | 选中节点变化时是否返回路径数组 | `boolean` | `true` |
| lazy | 是否动态加载子节点 | `boolean` | `false` |
| lazyLoad | 动态加载函数 | `(node: Node, resolve: Resolve, reject: () => void) => void` | — |
| value | 节点 value 对应的字段名 | `string` | `value` |
| label | 节点标签对应的字段名 | `string` | `label` |
| children | 子节点对应的字段名 | `string` | `children` |
| disabled | 节点禁用对应的字段名 | `string` | `disabled` |
| leaf | 叶子节点标志对应的字段名 | `string` | `leaf` |

### Cascader Events

| 事件名 | 说明 | 回调参数 |
|--------|------|---------|
| change | 绑定值改变时触发 | `(value: CascaderValue) => void` |
| expand-change | 展开选项改变时触发 | `(value: CascaderValue) => void` |
| blur | 失焦时触发 | `(event: FocusEvent) => void` |
| focus | 聚焦时触发 | `(event: FocusEvent) => void` |
| clear | 点击清空时触发 | `() => void` |
| visible-change | 下拉框出现/消失时触发 | `(value: boolean) => void` |
| remove-tag | 多选模式下删除 Tag 时触发 | `(value: CascaderNodeValue) => void` |

### Cascader Slots

| 插槽名 | 说明 |
|--------|------|
| default | 自定义节点内容（可访问 `node` 和 `data`） |
| empty | 无匹配数据时的内容 |
| prefix | 输入框前缀内容 |
| header | 下拉框顶部内容 |
| footer | 下拉框底部内容 |

### Cascader Exposes

| 名称 | 说明 | 类型 |
|------|------|------|
| getCheckedNodes | 获取当前已选节点数组 | `(leafOnly: boolean) => CascaderNode[]` |
| togglePopperVisible | 切换下拉框显示状态 | `(visible?: boolean) => void` |
| focus | 聚焦输入框 | `() => void` |
| blur | 使输入框失焦 | `() => void` |
