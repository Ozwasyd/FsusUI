# Collapse 折叠面板

通过折叠/展开来存放内容。

> 💡 **运行示例**：启动 demo-app（`pnpm dev`，端口 5173）查看交互效果。

---

## 基础用法

`v-model` 绑定当前展开的面板名称（非手风琴模式为数组）。

## 手风琴模式

设置 `accordion` 属性，同一时间只能展开一个面板，`v-model` 绑定值为字符串。

## 自定义标题

除了 `title` 属性外，也可通过 `#title` 插槽自定义标题内容（插槽 scope 中可访问 `isActive`）。

## 自定义图标

通过 `icon` 属性或 `#icon` 插槽自定义展开图标；通过 `expand-icon-position` 设置图标位置（`left` / `right`）。

## 阻止折叠

设置 `before-collapse` 钩子，返回 `false` 或 rejected 的 `Promise` 可阻止状态切换。

---

## Collapse API

### Collapse Attributes

| 属性名 | 说明 | 类型 | 默认值 |
|--------|------|------|--------|
| model-value / v-model | 当前展开的面板名称（手风琴模式为 string，否则为 array） | `string \| array` | `[]` |
| accordion | 是否开启手风琴模式 | `boolean` | `false` |
| expand-icon-position | 展开图标位置 | `'left' \| 'right'` | `right` |
| before-collapse | 切换前的钩子（返回 false 或 rejected Promise 阻止切换） | `() => Promise<boolean> \| boolean` | — |

### Collapse Events

| 事件名 | 说明 | 回调参数 |
|--------|------|---------|
| change | 激活面板改变时触发 | `(activeNames: array \| string) => void` |

### Collapse Slots

| 插槽名 | 说明 | 子标签 |
|--------|------|--------|
| default | 自定义内容 | Collapse-Item |

### Collapse Exposes

| 名称 | 说明 | 类型 |
|------|------|------|
| activeNames | 当前展开的面板名称 | `ComputedRef<(string \| number)[]>` |
| setActiveNames | 设置展开的面板 | `(activeNames: (string \| number)[]) => void` |

---

## Collapse-Item API

### Collapse-Item Attributes

| 属性名 | 说明 | 类型 | 默认值 |
|--------|------|------|--------|
| name | 面板唯一标识 | `string \| number` | — |
| title | 面板标题 | `string` | `''` |
| icon | 面板图标 | `string \| Component` | `ArrowRight` |
| disabled | 是否禁用 | `boolean` | `false` |

### Collapse-Item Slots

| 插槽名 | 说明 |
|--------|------|
| default | 面板内容 |
| title | 自定义面板标题（可访问 `isActive`） |
| icon | 自定义面板图标（可访问 `isActive`） |

### Collapse-Item Exposes

| 名称 | 说明 | 类型 |
|------|------|------|
| isActive | 当前面板是否展开 | `ComputedRef<boolean \| undefined>` |
