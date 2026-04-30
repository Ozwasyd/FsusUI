# Tooltip 文字提示

鼠标悬停时显示提示信息。

> 💡 **运行示例**：启动 demo-app（`pnpm dev`，端口 5173）查看交互效果。

---

## 基础用法

通过 `content` 设置显示内容，`placement` 设置弹出位置（共 12 个方向）。

## 主题

通过 `effect` 切换主题：`dark`（默认）或 `light`；也可传入自定义主题名。

## 更多内容

使用 `content` 具名插槽覆盖 `content` 属性，支持多行富文本内容。

## HTML 内容

设置 `raw-content` 为 `true` 后，`content` 将被解析为 HTML 字符串。

> **警告**：确保 `content` 内容可信，防止 XSS 攻击。

## 受控模式

使用 `v-model:visible` 实现受控显示；受控模式下点击外部不会自动关闭。

## 虚拟触发

通过 `virtual-triggering` 和 `virtual-ref` 将触发元素与内容解耦。

---

## API

### Attributes

| 属性名 | 说明 | 类型 | 默认值 |
|--------|------|------|--------|
| content | 显示内容（可被 `#content` 插槽覆盖） | `string` | `''` |
| raw-content | 是否将 content 解析为 HTML | `boolean` | `false` |
| placement | 弹出位置 | `'top' \| 'top-start' \| 'top-end' \| 'bottom' \| 'bottom-start' \| 'bottom-end' \| 'left' \| 'left-start' \| 'left-end' \| 'right' \| 'right-start' \| 'right-end'` | `bottom` |
| visible / v-model:visible | 是否显示 | `boolean` | — |
| disabled | 是否禁用 | `boolean` | — |
| offset | 偏移量 | `number` | `12` |
| trigger | 触发方式 | `'hover' \| 'click' \| 'focus' \| 'contextmenu'` | `hover` |
| show-after | 延迟显示（ms） | `number` | `0` |
| hide-after | 延迟隐藏（ms） | `number` | `200` |
| auto-close | 自动关闭延迟（ms），0 表示不自动关闭 | `number` | `0` |
| show-arrow | 是否显示箭头 | `boolean` | `true` |
| effect | 主题 | `'dark' \| 'light'` | `dark` |
| enterable | 鼠标是否可进入 tooltip | `boolean` | `true` |
| teleported | 是否将 tooltip 挂载到 `append-to` 指定的元素 | `boolean` | `true` |
| append-to | tooltip 挂载的目标元素 | `CSSSelector \| HTMLElement` | — |
| popper-class | 自定义 class | `string` | — |
| persistent | 非激活时是否保留 DOM | `boolean` | — |
| virtual-triggering | 是否启用虚拟触发 | `boolean` | — |
| virtual-ref | 虚拟触发的参考元素 | `HTMLElement` | — |
| transition | 动画名称 | `string` | — |

### Events

| 事件名 | 说明 | 回调参数 |
|--------|------|---------|
| before-show | 显示前触发 | `(event?: Event) => void` |
| show | 显示后触发 | `(event?: Event) => void` |
| before-hide | 隐藏前触发 | `(event?: Event) => void` |
| hide | 隐藏后触发 | `(event?: Event) => void` |

### Slots

| 插槽名 | 说明 |
|--------|------|
| default | 触发 tooltip 的元素（只能有一个根元素） |
| content | 自定义 tooltip 内容 |

### Exposes

| 名称 | 说明 | 类型 |
|------|------|------|
| updatePopper | 更新 popper 实例 | `() => void` |
| onOpen | 控制显示 | `(event?: Event) => void` |
| onClose | 控制隐藏 | `(event?: Event) => void` |
| hide | 隐藏 | `(event?: Event) => void` |

---

## 常见问题

**tooltip 内嵌 input 时无法输入空格？**

设置 `:trigger-keys="[]"` 防止空格键被拦截：

```vue
<el-tooltip content="提示" placement="top" :trigger-keys="[]">
  <el-input v-model="value" />
</el-tooltip>
```
