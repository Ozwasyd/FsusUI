# Countdown 倒计时

**注意**：Countdown 是 Statistic 组件的一部分。完整的统计数值文档见 [Statistic](./statistic.md)。

倒计时组件，展示目标时间距现在的剩余时长，支持格式化、前后缀和结束回调。

> 💡 **运行示例**：启动 demo-app（`pnpm dev`，端口 5173）查看交互效果。

---

## 基础用法

```vue
<el-countdown title="距活动结束" :value="deadline" format="HH:mm:ss" />
```

其中 `deadline` 为目标时间戳（毫秒）或 `dayjs` 对象：

```ts
import dayjs from 'dayjs'
const deadline = dayjs().add(10, 'minute').valueOf()
```

## 自定义格式

`format` 支持以下占位符：

| 格式 | 说明 |
|------|------|
| `YYYY` | 年 |
| `MM` | 月 |
| `DD` | 天 |
| `HH` | 小时 |
| `mm` | 分钟 |
| `ss` | 秒 |
| `SSS` | 毫秒 |

> **提示**：建议 format 范围不超过天级别，超出部分不会显示。

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
