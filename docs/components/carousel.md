# Carousel

Cycles through images or text in a bounded space.

> See the [Playground](../playground.md) for runnable component examples.

---

## Basic Usage

Place `el-carousel-item` elements inside `el-carousel`; each item is fully
customizable. Set `trigger="click"` to switch only when an indicator is clicked.

## Motion Blur

Set `motion-blur` to `true` to enable blur during transitions.

## Indicator Position

Use `indicator-position` to place indicators inside (default), `outside`, or
`none` (hidden).

## Arrow Visibility

Use `arrow` to show arrows on `hover` (default), `always`, or `never`.

## Card Mode

Set `type="card"` to enable card mode; side thumbnails are clickable.

## Vertical Direction

Set `direction="vertical"` for a vertical carousel.

---

## Carousel API

### Carousel Attributes

| 属性名 | 说明 | 类型 | 默认值 |
|--------|------|------|--------|
| height | 容器高度（设为 `auto` 自动跟随内容） | `string` | `''` |
| initial-index | 初始激活的条目索引（从 0 开始） | `number` | `0` |
| trigger | 指示器触发方式 | `'hover' \| 'click'` | `hover` |
| autoplay | 是否自动循环 | `boolean` | `true` |
| interval | 自动循环间隔（ms） | `number` | `3000` |
| indicator-position | 指示器位置 | `'' \| 'none' \| 'outside'` | `''` |
| arrow | 箭头显示时机 | `'always' \| 'hover' \| 'never'` | `hover` |
| type | 类型（`card` 为卡片模式） | `'' \| 'card'` | `''` |
| card-scale | 卡片模式下副卡片的缩放比例 | `number` | `0.83` |
| loop | 是否循环展示 | `boolean` | `true` |
| direction | 展示方向 | `'horizontal' \| 'vertical'` | `horizontal` |
| pause-on-hover | 悬停时是否暂停自动播放 | `boolean` | `true` |
| motion-blur | 是否开启运动模糊 | `boolean` | `false` |

### Carousel Events

| 事件名 | 说明 | 回调参数 |
|--------|------|---------|
| change | 切换条目时触发 | `(current: number, prev: number) => void` |

### Carousel Slots

| 插槽名 | 说明 | 子标签 |
|--------|------|--------|
| default | 自定义内容 | Carousel-Item |

### Carousel Exposes

| 名称 | 说明 | 类型 |
|------|------|------|
| activeIndex | 当前激活的条目索引 | `number` |
| setActiveItem | 手动切换到指定条目 | `(index: string \| number) => void` |
| prev | 切换到上一张 | `() => void` |
| next | 切换到下一张 | `() => void` |

---

## Carousel-Item API

### Carousel-Item Attributes

| 属性名 | 说明 | 类型 | 默认值 |
|--------|------|------|--------|
| name | 条目名称（可用于 `setActiveItem`） | `string` | `''` |
| label | 对应指示器的文字内容 | `string \| number` | `''` |

### Carousel-Item Slots

| 插槽名 | 说明 |
|--------|------|
| default | 自定义内容 |
