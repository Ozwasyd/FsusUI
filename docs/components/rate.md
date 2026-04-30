# Rate 评分

用于评分。

> 💡 **运行示例**：启动 demo-app（`pnpm dev`，端口 5173）查看交互效果。

---

## 基础用法

评分被划分为多个等级，可通过 `colors` 属性区分颜色（支持 3 元素数组或以阈值为 key 的对象）。使用 `low-threshold` / `high-threshold` 定义等级阈值。

## 半星

设置 `allow-half` 属性允许选择半星。

## 辅助文字

设置 `show-text` 在右侧显示文字；通过 `texts` 数组为不同评分配置文字。

## 可清空

设置 `clearable` 属性，再次点击同一值时将重置为 0。

## 只读

设置 `disabled` 为只读展示模式，可配合 `show-score` 显示当前分值，通过 `score-template` 自定义分值模板（包含 `{value}`）。

---

## API

### Attributes

| 属性名 | 说明 | 类型 | 默认值 |
|--------|------|------|--------|
| model-value / v-model | 绑定值 | `number` | `0` |
| max | 最大评分 | `number` | `5` |
| size | 尺寸 | `'large' \| 'default' \| 'small'` | — |
| disabled | 是否只读 | `boolean` | `false` |
| allow-half | 是否允许半选 | `boolean` | `false` |
| low-threshold | 低等级阈值（含） | `number` | `2` |
| high-threshold | 高等级阈值（含） | `number` | `4` |
| colors | 各等级颜色（3 元素数组或以阈值为 key 的对象） | `string[] \| Record<number, string>` | `['#f7ba2a', '#f7ba2a', '#f7ba2a']` |
| void-color | 未选中图标颜色 | `string` | `#c6d1de` |
| disabled-void-color | 只读状态下未选中图标颜色 | `string` | `#eff2f7` |
| icons | 各等级图标（3 元素数组或以阈值为 key 的对象） | `string[] \| Component[] \| Record<number, string \| Component>` | `[StarFilled, StarFilled, StarFilled]` |
| void-icon | 未选中时的图标 | `string \| Component` | `Star` |
| disabled-void-icon | 只读状态下未选中图标 | `string \| Component` | `StarFilled` |
| show-text | 是否显示辅助文字 | `boolean` | `false` |
| show-score | 是否显示当前分值（与 show-text 互斥） | `boolean` | `false` |
| text-color | 辅助文字颜色 | `string` | `''` |
| texts | 辅助文字数组（长度应等于 max） | `string[]` | `['极差', '失望', '一般', '满意', '惊喜']` |
| score-template | 分值模板（需包含 `{value}`） | `string` | `{value}` |
| clearable | 再次点击同值时是否重置为 0 | `boolean` | `false` |

### Events

| 事件名 | 说明 | 回调参数 |
|--------|------|---------|
| change | 评分改变时触发 | `(value: number) => void` |

### Exposes

| 名称 | 说明 | 类型 |
|------|------|------|
| setCurrentValue | 设置当前值 | `(value: number) => void` |
| resetCurrentValue | 重置当前值 | `() => void` |
