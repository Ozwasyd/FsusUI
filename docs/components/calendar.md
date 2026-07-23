# Calendar 日历

展示日期，支持单月视图、自定义日期内容与范围限制。

> 💡 **运行示例**：启动 demo-app（`pnpm dev`，端口 5173）查看交互效果。

---

## 基础用法

通过 `v-model` 绑定当前显示的月份；不设置时默认显示当月。

## 自定义内容

通过 `#date-cell` 具名插槽自定义日历格内容，可获取日期信息（类型、是否选中、格式化日期字符串）。

## 范围限制

通过 `range` 设置显示范围。开始日期必须是一周的第一天，结束日期必须是最后一天，时间跨度不超过两个月。

## 自定义头部

通过 `#header` 插槽自定义头部区域（可获取当前显示的月份字符串）。

## 移动端头部

Calendar 根据自身容器宽度布局。小于 `560px` 时，月份/年份标题位于第一行，
上一月、今天、下一月位于第二行稳定动作组；上一月和下一月使用图标，但保留
`aria-label` 与原生 tooltip。标题、动作组和日期网格共享 16px 左右基线，
所有导航动作与日期格保持至少 40px 高。

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
