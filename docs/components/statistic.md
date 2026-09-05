# Statistic

Highlights a number or key metric such as an amount, rank, or statistic.

> See the [Playground](../playground.md) for runnable component examples.

---

## Basic Usage

```vue
<el-statistic title="活跃用户" :value="98500" />
```

Combine with [VueUse useTransition](https://vueuse.org/core/useTransition/) for animated values.

## Countdown

Use `el-countdown` for a formatted countdown.

---

## Statistic API

### Statistic Attributes

| 属性名 | 说明 | 类型 | 默认值 |
|--------|------|------|--------|
| value | 数值内容 | `number` | `0` |
| decimal-separator | 小数点符号 | `string` | `.` |
| formatter | 自定义数字格式化函数 | `(value: number) => string \| number` | — |
| group-separator | 千位分隔符 | `string` | `,` |
| precision | 数字精度（小数位数） | `number` | `0` |
| prefix | 数字前缀 | `string` | — |
| suffix | 数字后缀 | `string` | — |
| title | 标题 | `string` | — |
| value-style | 数字样式 | `string \| CSSProperties \| CSSProperties[] \| string[]` | — |

### Statistic Slots

| 插槽名 | 说明 |
|--------|------|
| prefix | 自定义前缀 |
| suffix | 自定义后缀 |
| title | 自定义标题 |

### Statistic Exposes

| 名称 | 说明 | 类型 |
|------|------|------|
| displayValue | 当前显示的值 | `Ref<string \| number>` |

---

## Countdown API

### Countdown Attributes

| 属性名 | 说明 | 类型 | 默认值 |
|--------|------|------|--------|
| value | 目标时间 | `number \| Dayjs` | — |
| format | 倒计时格式 | `string` | `HH:mm:ss` |
| prefix | 倒计时前缀 | `string` | — |
| suffix | 倒计时后缀 | `string` | — |
| title | 标题 | `string` | — |
| value-style | 倒计时数字样式 | `string \| CSSProperties \| CSSProperties[] \| string[]` | — |

### Countdown Events

| 事件名 | 说明 | 回调参数 |
|--------|------|---------|
| change | 时间差变化时触发 | `(value: number) => void` |
| finish | 倒计时结束时触发 | `() => void` |

### Countdown Slots

| 插槽名 | 说明 |
|--------|------|
| prefix | 自定义前缀 |
| suffix | 自定义后缀 |
| title | 自定义标题 |
