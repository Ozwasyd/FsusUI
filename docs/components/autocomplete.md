# Autocomplete 自动补全输入框

根据当前输入内容提供输入建议。

> 💡 **运行示例**：启动 demo-app（`pnpm dev`，端口 5173）查看交互效果。

---

## 基础用法

`fetch-suggestions` 属性接收一个方法，当输入内容变化时被调用，通过 `callback(data)` 返回建议列表。

## 自定义模板

通过默认插槽自定义建议项的展示方式，插槽 scope 中可访问 `item`。

## 远程搜索

在 `fetch-suggestions` 中请求后端数据，设置 `debounce` 控制防抖延迟（默认 300ms）。

## 自定义头部和底部

使用 `header` / `footer` 插槽自定义下拉框的顶部和底部内容。

---

## API

### Attributes

| 属性名 | 说明 | 类型 | 默认值 |
|--------|------|------|--------|
| model-value / v-model | 绑定值 | `string` | — |
| placeholder | 占位符 | `string` | — |
| clearable | 是否显示清除按钮 | `boolean` | `false` |
| disabled | 是否禁用 | `boolean` | `false` |
| value-key | 建议对象中用于显示的字段名 | `string` | `value` |
| debounce | 防抖延迟（ms） | `number` | `300` |
| placement | 下拉框弹出位置 | `'top' \| 'top-start' \| 'top-end' \| 'bottom' \| 'bottom-start' \| 'bottom-end'` | `bottom-start` |
| fetch-suggestions | 获取建议列表的方法 | `Array \| (queryString, callback) => void` | — |
| trigger-on-focus | 获得焦点时是否展示建议 | `boolean` | `true` |
| select-when-unmatched | 无匹配时回车是否触发 `select` 事件 | `boolean` | `false` |
| hide-loading | 是否隐藏远程搜索的 loading 图标 | `boolean` | `false` |
| popper-class | 下拉框自定义 class | `string \| object` | `''` |
| teleported | 下拉框是否挂载到 body | `boolean` | `true` |
| highlight-first-item | 是否默认高亮远程搜索的第一个结果 | `boolean` | `false` |
| fit-input-width | 下拉框宽度是否与输入框相同 | `boolean` | `false` |
| loop-navigation | 键盘导航是否循环 | `boolean` | `true` |

### Events

| 事件名 | 说明 | 回调参数 |
|--------|------|---------|
| blur | 失去焦点时触发 | `(event: FocusEvent) => void` |
| focus | 获得焦点时触发 | `(event: FocusEvent) => void` |
| input | 输入值变化时触发 | `(value: string \| number) => void` |
| clear | 点击清除按钮时触发 | `() => void` |
| select | 点击某条建议时触发 | `(item: Record<string, any>) => void` |
| change | 输入框值改变时触发 | `(value: string \| number) => void` |

### Slots

| 插槽名 | 说明 |
|--------|------|
| default | 自定义建议项内容（可访问 `item`） |
| header | 下拉框顶部内容 |
| footer | 下拉框底部内容 |
| prefix | 输入框前缀内容 |
| suffix | 输入框后缀内容 |
| prepend | 输入框前置内容 |
| append | 输入框后置内容 |
| loading | 自定义加载中内容 |

### Exposes

| 名称 | 说明 | 类型 |
|------|------|------|
| activated | 是否处于激活状态 | `Ref<boolean>` |
| blur | 使输入框失焦 | `() => void` |
| close | 折叠建议列表 | `() => void` |
| focus | 使输入框聚焦 | `() => void` |
| handleSelect | 触发选中某条建议 | `(item: any) => Promise<void>` |
| highlightedIndex | 当前高亮项的索引 | `Ref<number>` |
| highlight | 高亮指定索引的建议项 | `(itemIndex: number) => void` |
| inputRef | 内部 el-input 实例 | `Ref<ElInputInstance>` |
| loading | 远程搜索加载中状态 | `Ref<boolean>` |
| suggestions | 当前建议列表 | `Ref<Record<string, any>[]>` |
| getData | 手动触发加载建议列表 | `(queryString: string) => Promise<void>` |
