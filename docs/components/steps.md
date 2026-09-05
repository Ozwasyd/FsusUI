# Steps

Guides users through a process with at least two steps.

> See the [Playground](../playground.md) for runnable component examples.

---

## Basic Usage

Set the active step with `active`, a zero-based numeric index.

```vue
<el-steps :active="active">
  <el-step title="步骤一" />
  <el-step title="步骤二" />
  <el-step title="步骤三" />
</el-steps>
```

## Status Variants

Use `process-status` and `finish-status` for the current and completed step states.

## Vertical Layout

Set `direction="vertical"` for vertical steps.

## Simple Style

Set `simple` for the compact theme; `align-center`, `description`, and related props have no effect.

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
