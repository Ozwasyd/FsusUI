# Dropdown

Groups actions or menus inside a dropdown.

> See the [Playground](../playground.md) for runnable component examples.

---

## Basic Usage

Put the trigger in the default slot and menu content in `#dropdown` (using `el-dropdown-menu`).

```vue
<el-dropdown>
  <span>下拉菜单<el-icon><arrow-down /></el-icon></span>
  <template #dropdown>
    <el-dropdown-menu>
      <el-dropdown-item command="a">操作一</el-dropdown-item>
      <el-dropdown-item command="b">操作二</el-dropdown-item>
      <el-dropdown-item command="c" divided>操作三（带分隔线）</el-dropdown-item>
    </el-dropdown-menu>
  </template>
</el-dropdown>
```

## Triggering

Set `trigger` to `hover` (default), `click`, or `contextmenu`.

## Split Button

Set `split-button` to turn the trigger into a two-part button group.

## Directive Triggering

Use `handleOpen` / `handleClose` to control menu visibility manually.

## Consumer-controlled single selection

Under a `role="menu"` Dropdown (the default), pass a boolean `checked` to each
selectable `DropdownItem`. Defined values render `menuitemradio` with
`aria-checked`; omitting `checked` preserves an ordinary `menuitem`. The consumer
owns exactly one committed selection in each group. Activation emits `command`
and never updates `checked` internally.

```vue
<el-dropdown ref="dropdown" trigger="click" :hide-on-click="false" @command="activate">
  <el-button>{{ committedLabel }}</el-button>
  <template #dropdown>
    <el-dropdown-menu>
      <el-dropdown-item
        v-for="item in items"
        :key="item.id"
        :command="item"
        :checked="item.id === committedId"
        :disabled="item.disabled"
      >
        {{ item.label }}
      </el-dropdown-item>
      <el-dropdown-item v-if="error" command="retry">
        <span role="alert">{{ error }}</span>
        {{ retryLabel }}
      </el-dropdown-item>
    </el-dropdown-menu>
  </template>
</el-dropdown>
```

For async activation, use `:hide-on-click="false"` and keep `checked` bound to
the last committed value while pending or failed. The consumer owns requests,
progress, errors, retry, cancellation, supersession, and committing selection.
Close with `handleClose` when appropriate. Changing `checked` does not move focus
away from a user navigating pending or retry content.

Enter, Space, ArrowDown, and ArrowUp open a click-triggered menu. Keyboard entry
prefers an enabled checked item; the existing roving focus model handles
ArrowUp/Down/Home/End and skips disabled items. Escape returns focus to the
trigger. Use one focusable trigger in the default slot, including compact custom
content, and observe visibility through `visible-change`.

Escape also cancels a pending delayed open. During close, focus restoration is
limited to the current Escape session and yields to newer input, external focus,
or reopening. While that session still owns focus, Dropdown takes responsibility
for the trap release so its generic return to a previously focused input does
not replace the Escape return to the trigger. It does not reclaim focus when
the leave animation finishes.
Release handling uses the menu's current injected trap reference, including
after keyed menu remounts, and matches that exact trap rather than nested traps.

The `command` event receives `(command, instance, event)`. A consumer activation
adapter may navigate an item's URL or start its async command. Enter/Space on
the item emit that command rather than clicking a nested anchor. Avoid a second
keyboard owner or private DOM queries. Keyboard activation prevents the original
key default before emission; `event.defaultPrevented` alone does not invalidate
the command.

## Multiline content and viewport bounds

Opt into `multiline` for wrapping primary content and an optional `description`
slot. The row grows naturally above its existing minimum height. The optional
`suffix` slot reserves space for consumer status content; keep it noninteractive
and mark decorative content `aria-hidden`. A description without `multiline`
does not change ordinary single-line geometry.

Set `viewport-bounded` on Dropdown to constrain panel width and scrollable height
to the visual viewport. An explicit `max-height` remains an upper bound; an unset
maximum uses the documented menu maximum. For body-teleported panels under root
CSS `zoom`, Dropdown modifiers normalize coordinates for the existing Popper
engine and convert style/arrow output back to CSS coordinates. Popper retains
placement and listener cleanup. Nested or independently zoomed append contexts,
browser page zoom, and assistive technology need separate qualification.
Measured viewport CSS properties are internal, not consumer theme tokens.
Visual viewport resize requests an update from the existing Popper instance;
the listener and measured properties are cleaned up with the modifier effect.

Forced-colors styling supplies an opaque system Canvas popup/arrow surface and
inset keyboard focus borders when box shadows are suppressed. It reuses existing
focus tokens and automatic system color adjustment. Light/dark styling and
reduced-motion transition ownership remain unchanged.

---

## Dropdown API

### Dropdown Attributes

| 属性名 | 说明 | 类型 | 默认值 |
|--------|------|------|--------|
| type | 按钮类型（`split-button` 为 true 时有效） | `'default' \| 'primary' \| 'success' \| 'warning' \| 'info' \| 'danger'` | `''` |
| size | 菜单大小 | `'large' \| 'default' \| 'small'` | `''` |
| split-button | 是否使用分裂按钮 | `boolean` | `false` |
| disabled | 是否禁用 | `boolean` | `false` |
| placement | 弹出位置 | `'top' \| 'top-start' \| 'top-end' \| 'bottom' \| 'bottom-start' \| 'bottom-end'` | `bottom` |
| trigger | 触发方式 | `'click' \| 'hover' \| 'contextmenu'` | `hover` |
| hide-on-click | 点击菜单项后是否关闭菜单 | `boolean` | `true` |
| show-timeout | 显示延迟（ms，`hover` 模式有效） | `number` | `150` |
| hide-timeout | 隐藏延迟（ms，`hover` 模式有效） | `number` | `150` |
| max-height | 菜单最大高度 | `string \| number` | `''` |
| viewport-bounded | Constrain popup geometry to the visual viewport | `boolean` | `false` |
| popper-class | 自定义弹出层 class | `string \| object` | `''` |
| teleported | 是否挂载到 body | `boolean` | `true` |
| persistent | 非激活时是否保留 DOM | `boolean` | `true` |

### Dropdown Events

| 事件名 | 说明 | 回调参数 |
|--------|------|---------|
| click | `split-button` 为 true 时，点击左侧按钮触发 | `(e: MouseEvent) => void` |
| command | 点击菜单项时触发，参数为菜单项的 `command` 值 | `(...args: any[]) => void` |
| visible-change | 菜单显示/隐藏变化时触发 | `(val: boolean) => void` |

### Dropdown Slots

| 插槽名 | 说明 | 子组件 |
|--------|------|--------|
| default | 触发元素（有效 HTML 元素或 FsusUI 组件） | — |
| dropdown | 下拉菜单内容 | `DropdownMenu` |

### Dropdown Exposes

| 名称 | 说明 | 类型 |
|------|------|------|
| handleOpen | 打开下拉菜单 | `() => void` |
| handleClose | 关闭下拉菜单 | `() => void` |

---

## Dropdown-Menu API

### Dropdown-Menu Slots

| 插槽名 | 说明 | 子组件 |
|--------|------|--------|
| default | 菜单项列表 | `DropdownItem` |

---

## Dropdown-Item API

### Dropdown-Item Attributes

| 属性名 | 说明 | 类型 | 默认值 |
|--------|------|------|--------|
| command | 点击时传递给 `command` 事件的值 | `string \| number \| object` | — |
| disabled | 是否禁用 | `boolean` | `false` |
| checked | Consumer-controlled radio state under a menu parent; omit for a command item | `boolean \| undefined` | `undefined` |
| multiline | Wrap primary content and render the description slot | `boolean` | `false` |
| divided | 是否显示上方分割线 | `boolean` | `false` |
| icon | 自定义图标 | `string \| Component` | — |

### Dropdown-Item Slots

| Slot | Description |
|------|-------------|
| default | Primary item content |
| description | Secondary wrapping text when `multiline` is enabled |
| suffix | Noninteractive status content |
