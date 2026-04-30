# Steps 步骤条

引导用户按照流程完成任务，步骤数量不能少于 2 步。

> 💡 **运行示例**：启动 demo-app（`pnpm dev`，端口 5173）查看交互效果。

---

## 基础用法

通过 `active` 属性（从 0 开始的数字索引）设置当前激活步骤。

```vue
<el-steps :active="active">
  <el-step title="步骤一" />
  <el-step title="步骤二" />
  <el-step title="步骤三" />
</el-steps>
```

## 含状态

通过 `process-status` 和 `finish-status` 设置当前步骤和已完成步骤的状态。

## 垂直排列

设置 `direction="vertical"` 使步骤条垂直排列。

## 简洁样式

设置 `simple` 启用简洁主题（`align-center`、`description` 等属性失效）。

---

## Steps API

### Steps Attributes

| 属性名 | 说明 | 类型 | 默认值 |
|--------|------|------|--------|
| active | 当前激活步骤的索引（从 0 开始） | `number` | `0` |
| space | 每个步骤间距（支持数字 px 或百分比），不设则自适应 | `number \| string` | `''` |
| direction | 排列方向 | `'vertical' \| 'horizontal'` | `horizontal` |
| process-status | 当前步骤的状态 | `'wait' \| 'process' \| 'finish' \| 'error' \| 'success'` | `process` |
| finish-status | 已完成步骤的状态 | `'wait' \| 'process' \| 'finish' \| 'error' \| 'success'` | `finish` |
| align-center | 标题和描述是否居中 | `boolean` | — |
| simple | 是否启用简洁主题 | `boolean` | — |

### Steps Events

| 事件名 | 说明 | 回调参数 |
|--------|------|---------|
| change | 当前步骤变化时触发 | `(newVal: number, oldVal: number) => void` |

### Steps Slots

| 插槽名 | 说明 | 子组件 |
|--------|------|--------|
| default | 步骤列表 | `Step` |

---

## Step API

### Step Attributes

| 属性名 | 说明 | 类型 | 默认值 |
|--------|------|------|--------|
| title | 步骤标题 | `string` | `''` |
| description | 步骤描述 | `string` | `''` |
| icon | 自定义图标 | `string \| Component` | — |
| status | 当前步骤状态（不设则由 Steps 自动确定） | `'' \| 'wait' \| 'process' \| 'finish' \| 'error' \| 'success'` | `''` |

### Step Slots

| 插槽名 | 说明 |
|--------|------|
| icon | 自定义图标 |
| title | 自定义标题 |
| description | 自定义描述 |
