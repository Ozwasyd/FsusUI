# Menu

A navigation menu for websites.

> See the [Playground](../playground.md) for runnable component examples.

---

## Top Navigation

Set `mode="horizontal"` for a horizontal menu. Customize colors with `background-color`, `text-color`, and `active-text-color`.

> **Tip:** Override the default menu height with the `--el-menu-horizontal-height` CSS variable.

## Sidebar

The default direction is vertical. Use `el-sub-menu` for nested menus and `el-menu-item-group` for groups.

## Collapse

In vertical mode, set `collapse` to collapse the menu.

## Routing Mode

Set `router` to `true` to enable vue-router mode; each menu item's `index` becomes its route path.

---

## Menu API

### Menu Attributes

| 属性名 | 说明 | 类型 | 默认值 |
|--------|------|------|--------|
| mode | 菜单方向 | `'horizontal' \| 'vertical'` | `vertical` |
| collapse | 是否折叠（仅垂直模式） | `boolean` | `false` |
| ellipsis | 是否折叠多余项（仅水平模式） | `boolean` | `true` |
| default-active | 当前激活菜单的 index | `string` | `''` |
| default-openeds | 默认展开的子菜单 index 数组 | `string[]` | `[]` |
| unique-opened | 是否只允许展开一个子菜单 | `boolean` | `false` |
| menu-trigger | 子菜单触发方式（仅水平模式） | `'hover' \| 'click'` | `hover` |
| router | 是否启用 vue-router 模式 | `boolean` | `false` |
| collapse-transition | 是否开启折叠动画 | `boolean` | `true` |
| popper-effect | 折叠时弹出菜单的主题 | `'dark' \| 'light'` | `dark` |
| close-on-click-outside | 点击外部时是否折叠菜单 | `boolean` | `false` |
| show-timeout | 显示延迟（ms） | `number` | `300` |
| hide-timeout | 隐藏延迟（ms） | `number` | `300` |

### Menu Events

| 事件名 | 说明 | 回调参数 |
|--------|------|---------|
| select | 菜单项激活时回调 | `(index, indexPath, item, routerResult?) => void` |
| open | 子菜单展开时回调 | `(index, indexPath) => void` |
| close | 子菜单折叠时回调 | `(index, indexPath) => void` |

### Menu Slots

| 插槽名 | 说明 | 子标签 |
|--------|------|--------|
| default | 自定义内容 | SubMenu / Menu-Item / Menu-Item-Group |

### Menu Exposes

| 名称 | 说明 | 类型 |
|------|------|------|
| open | 展开指定子菜单 | `(index: string) => void` |
| close | 折叠指定子菜单 | `(index: string) => void` |
| handleResize | 手动触发宽度重算 | `() => void` |
| updateActiveIndex | 设置激活菜单 | `(index: string) => void` |

---

## SubMenu API

### SubMenu Attributes

| 属性名 | 说明 | 类型 | 默认值 |
|--------|------|------|--------|
| index（必填） | 唯一标识 | `string` | — |
| popper-class | 弹出菜单自定义 class | `string` | — |
| show-timeout | 显示延迟（继承 Menu 默认值） | `number` | — |
| hide-timeout | 隐藏延迟（继承 Menu 默认值） | `number` | — |
| disabled | 是否禁用 | `boolean` | `false` |
| teleported | 弹出菜单是否挂载到 body | `boolean` | `undefined` |

### SubMenu Slots

| 插槽名 | 说明 | 子标签 |
|--------|------|--------|
| default | 子菜单内容 | SubMenu / Menu-Item / Menu-Item-Group |
| title | 自定义子菜单标题 | — |

---

## Menu-Item API

### Menu-Item Attributes

| 属性名 | 说明 | 类型 | 默认值 |
|--------|------|------|--------|
| index（必填） | 唯一标识 | `string` | — |
| route | Vue Router 路由对象 | `string \| object` | — |
| disabled | 是否禁用 | `boolean` | `false` |

### Menu-Item Events

| 事件名 | 说明 | 回调参数 |
|--------|------|---------|
| click | 点击菜单项时回调 | `(item: MenuItemRegistered) => void` |

### Menu-Item Slots

| 插槽名 | 说明 |
|--------|------|
| default | 自定义内容 |
| title | 自定义标题（折叠时显示） |

---

## Menu-Item-Group API

### Menu-Item-Group Attributes

| 属性名 | 说明 | 类型 | 默认值 |
|--------|------|------|--------|
| title | 分组标题 | `string` | — |

### Menu-Item-Group Slots

| 插槽名 | 说明 | 子标签 |
|--------|------|--------|
| default | 分组内容 | Menu-Item |
| title | 自定义分组标题 | — |
