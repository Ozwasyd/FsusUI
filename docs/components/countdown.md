# Countdown

**Note:** Countdown is part of the Statistic component. See [Statistic](./statistic.md) for the complete numeric-display documentation.

A countdown component that shows the remaining time until a target, with formatting, prefixes, suffixes, and a completion callback.

> See the [Playground](../playground.md) for runnable component examples.

---

## Basic Usage

```vue
<el-countdown title="距活动结束" :value="deadline" format="HH:mm:ss" />
```

`deadline` is a target timestamp in milliseconds or a `dayjs` object:

```ts
import dayjs from 'dayjs'
const deadline = dayjs().add(10, 'minute').valueOf()
```

## Custom Format

`format` supports these placeholders:

| 格式 | 说明 |
|------|------|
| `YYYY` | 年 |
| `MM` | 月 |
| `DD` | 天 |
| `HH` | 小时 |
| `mm` | 分钟 |
| `ss` | 秒 |
| `SSS` | 毫秒 |

> **Tip:** Keep the `format` range at day-level or smaller; larger units are not displayed.

---

## API

### Attributes

| 属性名 | 说明 | 类型 | 默认值 |
|--------|------|------|--------|
| value | 目标时间（毫秒时间戳或 dayjs 对象） | `number \| Dayjs` | `0` |
| format | 倒计时格式字符串 | `string` | `HH:mm:ss` |
| prefix | 前缀文字 | `string` | — |
| suffix | 后缀文字 | `string` | — |
| title | 倒计时标题 | `string` | — |
| value-style | 倒计时数字样式 | `string \| CSSProperties \| CSSProperties[] \| string[]` | — |

### Events

| 事件名 | 说明 | 回调参数 |
|--------|------|---------|
| finish | 倒计时结束时触发 | `() => void` |
| change | 倒计时数值变化时触发 | `(value: number) => void` |

### Slots

| 插槽名 | 说明 |
|--------|------|
| prefix | 自定义前缀 |
| suffix | 自定义后缀 |
| title | 自定义标题 |
