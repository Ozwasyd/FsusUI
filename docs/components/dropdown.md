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

## Consumer-owned Single Selection

Set `checked` on every selectable `DropdownItem` under a `role="menu"`
Dropdown. Defined boolean values render `menuitemradio` with `aria-checked`;
omitting `checked` preserves the ordinary `menuitem` command contract. The
consumer supplies exactly one committed checked item in each selection group.
Activation emits `command`; it never mutates `checked` itself.

Use `hide-on-click="false"` for an asynchronous transaction. Keep `checked`
bound to the last committed value while showing pending progress or a visible
error/retry item in the menu. Update that value only after success, and close
through the public `handleClose` method when the consumer decides the
transaction is settled. Failed, interrupted, and superseded transactions remain
consumer-owned. FsusUI does not store preferences, choose locale values, or
perform resource requests.

```vue
<el-dropdown ref="dropdown" trigger="click" :hide-on-click="false">
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
        <span v-if="pendingId === item.id">{{ pendingLabel }}</span>
      </el-dropdown-item>
      <el-dropdown-item v-if="error" command="retry">
        <span role="alert">{{ error }}</span>
        {{ retryLabel }}
      </el-dropdown-item>
    </el-dropdown-menu>
  </template>
</el-dropdown>
```

Enter, Space, ArrowDown, and ArrowUp open a click-triggered dropdown. The
existing roving focus model prefers a focusable checked item on keyboard
entry, handles ArrowUp/Down/Home/End, skips disabled items, and restores focus
to the trigger on Escape. A custom trigger, including compact content, remains
in the default slot; public `visible-change` and `handleOpen` / `handleClose`
provide an observable visibility contract. Changing `checked` does not move
focus away from a user who is navigating pending or retry content.

## URL and Command Activation Adapter

The `command` event receives `(command, instance, event)`. Use a public
consumer adapter to distinguish navigation records from async commands; do
not query component-private DOM or add another keyboard handler. For example:

```ts
function activate(item, _instance, event) {
  if (item.href) {
    window.location.assign(item.href)
    return
  }
  void requestResource(item.id)
}
```

The adapter owns URL and transaction semantics. A nested anchor alone is not
a keyboard activation adapter: Enter/Space on the menu item activate its
public command rather than dispatching the nested anchor's native click.
Choose and test one coherent URL/command adapter for the consumer.
Keyboard activation intentionally prevents the browser's original key default
before emitting `command`; its event can therefore have `defaultPrevented=true`
while still representing a valid command. Do not discard a public keyboard
command solely because that flag is set.

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
| divided | 是否显示上方分割线 | `boolean` | `false` |
| icon | 自定义图标 | `string \| Component` | — |
| checked | Consumer-controlled single-selection state under a menu parent; omit for an ordinary command item | `boolean \| undefined` | `undefined` |
