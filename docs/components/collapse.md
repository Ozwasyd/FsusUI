# Collapse

Stores content behind collapsible panels.

> See the [Playground](../playground.md) for runnable component examples.

---

## Basic Usage

Bind the expanded panel name with `v-model`; non-accordion mode uses an array.

## Accordion Mode

Set `accordion` to allow one panel at a time; its `v-model` value is a string.

## Custom Title

In addition to `title`, customize the heading through `#title`, whose slot scope
exposes `isActive`.

## Custom Icons

Customize the expand icon with `icon` or `#icon`, and place it with
`expand-icon-position` (`left` or `right`).

## Prevent Collapse

Use `before-collapse`; returning `false` or a rejected `Promise` prevents the
state change.

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
