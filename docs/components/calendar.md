# Calendar

Displays dates with a single-month view, custom date content, and range limits.

> See the [Playground](../playground.md) for runnable component examples.

---

## Basic Usage

Bind the visible month with `v-model`; the current month is shown by default.

## Custom Content

Customize date cells with the `#date-cell` slot, which exposes the date type,
selection state, and formatted date string.

## Range Limits

Set the displayed range with `range`. The start must be the first day of a week,
the end must be the last day, and the span cannot exceed two months.

## Custom Header

Customize the header with `#header`, which exposes the displayed month string.

## Mobile Header

Calendar uses its own container width. Below `560px`, the month/year heading is
on the first row and the previous/today/next actions form a stable second row.
Previous and next use icons while retaining `aria-label` and the native tooltip.
The heading, actions, and date grid share a roughly 16px baseline, and every
navigation action and date cell remains at least 40px high.

---

## API

### Attributes

| 属性名                | 说明                                          | 类型                                                           | 默认值   |
| --------------------- | --------------------------------------------- | -------------------------------------------------------------- | -------- |
| model-value / v-model | 绑定日期                                      | `Date`                                                         | —        |
| range                 | 显示范围（`[开始日期, 结束日期]`）            | `[Date, Date]`                                                 | —        |
| controller-type       | 头部控制器类型                                | `'button' \| 'select'`                                         | `button` |
| formatter             | 当 `controller-type` 为 `select` 时格式化标签 | `(value: number, type: 'year' \| 'month') => string \| number` | —        |

### Slots

| 插槽名    | 说明             | 参数                                                                                                                |
| --------- | ---------------- | ------------------------------------------------------------------------------------------------------------------- |
| date-cell | 自定义日历格内容 | `{ data: { type: 'prev-month' \| 'current-month' \| 'next-month', isSelected: boolean, day: string, date: Date } }` |
| header    | 自定义头部       | `{ date: string }`                                                                                                  |

### Exposes

| 名称        | 说明               | 类型                               |
| ----------- | ------------------ | ---------------------------------- |
| selectedDay | 当前选中日期       | `ComputedRef<Dayjs \| undefined>`  |
| pickDay     | 选择某天           | `(day: Dayjs) => void`             |
| selectDate  | 跳转到特定日期类型 | `(type: CalendarDateType) => void` |
