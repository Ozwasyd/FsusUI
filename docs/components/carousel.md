# Carousel 走马灯

在有限的空间内循环展示图片或文字。

> 💡 **运行示例**：启动 demo-app（`pnpm dev`，端口 5173）查看交互效果。

---

## 基础用法

将 `el-carousel-item` 放入 `el-carousel` 中，每个条目内容完全自定义。设置 `trigger="click"` 改为点击指示器才切换。

## 运动模糊

设置 `motion-blur` 为 `true` 开启切换时的模糊动效。

## 指示器位置

通过 `indicator-position` 控制指示器位置：默认内部、`outside`（外部）、`none`（隐藏）。

## 箭头显示

通过 `arrow` 属性控制箭头：`hover`（默认，悬停显示）、`always`、`never`。

## 卡片模式

设置 `type="card"` 启用卡片模式，两侧缩略图可直接点击切换。

## 垂直方向

设置 `direction="vertical"` 使走马灯垂直展示。

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
