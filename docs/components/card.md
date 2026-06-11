# Card 卡片

将信息聚合展示在卡片容器中。

> 💡 **运行示例**：启动 demo-app（`pnpm dev`，端口 5173）查看交互效果。

---

## 基础用法

Card 由 `header`、`body`、`footer` 三部分组成，后两者均可选，通过具名插槽分发内容。

## 简单卡片

省略 `header` 插槽时，卡片只显示内容区域。

## 带图片

通过 `body-style` 属性自定义卡片主体样式，配合图片组件实现图文卡片。

## 阴影效果

通过 `shadow` 属性控制阴影显示时机：`always`（始终显示）、`hover`（悬停时）、`never`（从不显示）。

---

## API

### Attributes

| 属性名       | 说明                                        | 类型                             | 默认值  |
| ------------ | ------------------------------------------- | -------------------------------- | ------- |
| header       | 卡片标题（也可通过 `#header` 插槽传入）     | `string`                         | —       |
| footer       | 卡片底部内容（也可通过 `#footer` 插槽传入） | `string`                         | —       |
| body-style   | 卡片主体区域的 CSS 样式                     | `CSSProperties`                  | —       |
| header-class | 卡片头部自定义 class                        | `string`                         | —       |
| body-class   | 卡片主体自定义 class                        | `string`                         | —       |
| footer-class | 卡片底部自定义 class                        | `string`                         | —       |
| shadow       | 阴影显示时机                                | `'always' \| 'hover' \| 'never'` | `never` |

### Slots

| 插槽名  | 说明         |
| ------- | ------------ |
| default | 卡片主体内容 |
| header  | 卡片头部内容 |
| footer  | 卡片底部内容 |
